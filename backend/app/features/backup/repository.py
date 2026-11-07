"""数据仓的 git 操作与同步状态持久化。

所有命令都以 `backend/data`（或 `DEV_LEARN_DATA_DIR`）为工作目录：
它是独立仓库，绝不能向上找到主仓。
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import time
from pathlib import Path
from typing import Any

from app.core.config import settings

STATE_FILE = "dev-learn-backup.json"
GIT_TIMEOUT = 180
_BRANCH = re.compile(r"^[A-Za-z0-9._/-]+$")
_RUNTIME_SUFFIXES = ("-wal", "-shm", "-journal")


class GitError(RuntimeError):
    """git 命令失败；message 必须是可直接展示给用户的真实错误。"""


def _error_text(result: subprocess.CompletedProcess[str]) -> str:
    for stream in (result.stderr, result.stdout):
        lines = [line.strip() for line in stream.splitlines() if line.strip()]
        if lines:
            return lines[-1]
    return f"git 退出码 {result.returncode}"


def _git(*args: str, timeout: int = GIT_TIMEOUT) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["git", "-C", str(settings.data_dir), *args],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError as exc:  # 没有安装 git
        raise GitError("找不到 git 命令，请先安装 git") from exc
    except subprocess.TimeoutExpired as exc:
        raise GitError(f"git 命令超时：{' '.join(args[:2])}") from exc


def _must(*args: str, timeout: int = GIT_TIMEOUT) -> str:
    result = _git(*args, timeout=timeout)
    if result.returncode != 0:
        raise GitError(_error_text(result))
    return result.stdout.strip()


def repo_ready() -> bool:
    if not (settings.data_dir / ".git").exists():
        return False
    result = _git("rev-parse", "--is-inside-work-tree")
    return result.returncode == 0 and result.stdout.strip() == "true"


def current_branch() -> str:
    result = _git("symbolic-ref", "--short", "-q", "HEAD")
    return result.stdout.strip() if result.returncode == 0 else ""


def remote_url() -> str:
    result = _git("remote", "get-url", "origin")
    return result.stdout.strip() if result.returncode == 0 else ""


def is_dirty() -> bool:
    """`git status` 会扫描整个工作区；失败时重试一次，避开瞬时 index.lock。"""
    for attempt in range(2):
        result = _git("status", "--porcelain", "--untracked-files=normal")
        if result.returncode == 0:
            return bool(result.stdout.strip())
        if attempt == 0:
            time.sleep(0.2)
    return False


def head_sha(short: bool = True) -> str:
    return _must("rev-parse", "--short" if short else "--verify", "HEAD")


def _ahead_behind(ref: str) -> tuple[int, int]:
    result = _git("rev-list", "--left-right", "--count", f"HEAD...{ref}")
    if result.returncode != 0:
        return 0, 0
    parts = result.stdout.split()
    if len(parts) != 2:
        return 0, 0
    return int(parts[0]), int(parts[1])


def remote_branch_sha(branch: str) -> str | None:
    result = _git("ls-remote", "--heads", "origin", f"refs/heads/{branch}", timeout=90)
    if result.returncode != 0:
        raise GitError(_error_text(result))
    for line in result.stdout.splitlines():
        sha, _, name = line.partition("\t")
        if name.strip() == f"refs/heads/{branch}":
            return sha.strip()
    return None


def fetch_branch(branch: str) -> None:
    _must(
        "fetch",
        "--quiet",
        "origin",
        f"+refs/heads/{branch}:refs/remotes/origin/{branch}",
        timeout=300,
    )


def fetch_all() -> None:
    _must("fetch", "--prune", "--quiet", "origin", timeout=300)


def remote_branches() -> list[dict[str, Any]]:
    """读远端跟踪分支，不做网络请求；ahead/behind 相对本机 HEAD。"""
    result = _git(
        "for-each-ref",
        "--format=%(refname:short)%09%(objectname:short)%09%(committerdate:iso-strict)",
        "refs/remotes/origin",
    )
    if result.returncode != 0:
        return []
    rows: list[dict[str, Any]] = []
    for line in result.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        ref, sha, updated = parts
        if not ref.startswith("origin/") or ref.endswith("/HEAD"):
            continue
        name = ref[len("origin/") :]
        ahead, behind = _ahead_behind(ref)
        rows.append(
            {
                "name": name,
                "sha": sha,
                "updated_at": updated,
                "ahead": ahead,
                "behind": behind,
            }
        )
    return sorted(rows, key=lambda row: str(row["name"]))


def update_tracking(branch: str) -> None:
    _git("update-ref", f"refs/remotes/origin/{branch}", "HEAD")


def commit_all(message: str) -> tuple[bool, str]:
    """提交工作区全部改动（blog / study / anki）；返回 (是否有提交, 短 sha)。"""
    _must("add", "-A")
    result = _git("diff", "--cached", "--quiet")
    if result.returncode == 0:
        return False, head_sha()
    _must("commit", "-q", "-m", message)
    return True, head_sha()


def push(branch: str, expected: str | None) -> str:
    """只写本机分支；带 lease 的强推，防止误覆盖别人写入的同一分支。"""
    lease = f"--force-with-lease=refs/heads/{branch}:{expected or ''}"
    return _must("push", "--porcelain", lease, "origin", f"HEAD:refs/heads/{branch}", timeout=300)


def merge_in_progress() -> bool:
    return _git("rev-parse", "-q", "--verify", "MERGE_HEAD").returncode == 0


def merge_no_commit(branch: str) -> None:
    result = _git("merge", "--no-ff", "--no-commit", f"origin/{branch}", timeout=300)
    # 有冲突时 git 也返回非零；只要 MERGE_HEAD 存在，就交给解决流程。
    if result.returncode != 0 and not merge_in_progress():
        raise GitError(_error_text(result))


def unmerged_paths() -> list[str]:
    result = _git("diff", "--name-only", "--diff-filter=U")
    if result.returncode != 0:
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def take_side(path: str, side: str) -> None:
    """冲突文件整份取本机或远端；某侧删除该文件时从索引移除。"""
    flag = "--ours" if side == "local" else "--theirs"
    result = _git("checkout", flag, "--", path)
    if result.returncode == 0:
        _must("add", "--", path)
        return
    _must("rm", "-q", "-f", "--", path)


def commit_merge(message: str) -> str:
    _must("commit", "-q", "--no-edit", "-m", message)
    return head_sha()


def abort_merge() -> None:
    _must("merge", "--abort")


def create_safety_ref(name: str) -> str:
    ref = f"refs/backup/{name}"
    _must("update-ref", ref, "HEAD")
    return ref


def reset_hard(ref: str) -> None:
    _must("reset", "--hard", ref, timeout=300)


def clear_anki_runtime_files() -> None:
    base = settings.anki_dir / "collection.anki2"
    for suffix in _RUNTIME_SUFFIXES:
        Path(f"{base}{suffix}").unlink(missing_ok=True)


def _state_path() -> Path:
    result = _git("rev-parse", "--absolute-git-dir")
    folder = Path(result.stdout.strip()) if result.returncode == 0 else settings.data_dir / ".git"
    return folder / STATE_FILE


def read_state() -> dict[str, Any]:
    try:
        data = json.loads(_state_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def write_state(state: dict[str, Any]) -> None:
    target = _state_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_name(f"{target.name}.tmp")
    temp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp, target)


def valid_branch(name: str) -> bool:
    if not name or len(name) > 120:
        return False
    if name.startswith(("-", "/", ".")) or name.endswith(("/", ".", ".lock")):
        return False
    if ".." in name or "//" in name or "@{" in name:
        return False
    return bool(_BRANCH.fullmatch(name))
