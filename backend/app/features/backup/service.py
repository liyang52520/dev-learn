"""数据备份操作：推送、合并、冲突解决、整机覆盖与每日自动推送。

模型：远端 `dev-anki` 上每台机器只写自己的分支（`machine/<主机名>`），
本地检出分支保持原样；推送时把本机 HEAD 推到自己的远端分支。
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime
from typing import Literal, cast

from app.core.errors import AppError
from app.features.backup import repository as repo
from app.features.backup import state, status
from app.features.backup.schemas import BackupResult
from app.features.review import service as review_service

log = logging.getLogger("app.backup")

DAILY_SECONDS = 24 * 60 * 60
RETRY_SECONDS = 60 * 60
_OP = threading.Lock()
Side = Literal["local", "remote"]


def _begin() -> None:
    if not _OP.acquire(blocking=False):
        raise AppError("已有同步操作在进行，请稍后再试", code="backup_busy", status=409)


def _end() -> None:
    _OP.release()


def _ensure_idle() -> None:
    if repo.merge_in_progress():
        raise AppError("有未完成的合并，请先完成或取消合并", code="backup_merging", status=409)


def _ensure_repo() -> None:
    if not repo.repo_ready():
        raise AppError(
            "backend/data 还不是独立 git 仓库，无法同步",
            code="backup_repo",
            status=400,
        )


def _validate_branch(raw: str) -> str:
    name = raw.strip()
    if name.startswith("origin/"):
        name = name[len("origin/") :]
    if not repo.valid_branch(name):
        raise AppError("分支名不合法", code="invalid_params", status=400)
    return name


def fetch_remote() -> BackupResult:
    """只更新远端跟踪分支，不改工作区，因此不用关闭 Anki。"""
    _begin()
    try:
        _ensure_repo()
        try:
            repo.fetch_all()
        except repo.GitError as exc:
            raise AppError(
                f"获取远端分支失败：{exc}", code="backup_fetch_failed", status=502
            ) from exc
        message = "已获取远端分支列表。"
        return BackupResult(ok=True, status="fetched", branch=status.own_branch(), message=message)
    finally:
        _end()
        status.invalidate()


def push() -> BackupResult:
    _ensure_idle()
    _begin()
    try:
        return _push()
    finally:
        _end()
        status.invalidate()


def _push() -> BackupResult:
    _ensure_repo()
    branch = status.own_branch()
    try:
        review_service.prepare_sync()
        changed, commit = repo.commit_all(f"同步 {branch} {state.stamp()}")
        repo.push(branch, repo.remote_branch_sha(branch))
        repo.update_tracking(branch)
    except repo.GitError as exc:
        state.record_sync(branch, False, str(exc))
        raise AppError(f"推送失败：{exc}", code="backup_push_failed", status=502) from exc

    head = "已提交并推送" if changed else "没有新改动，已推送当前提交"
    message = f"{head}（{branch}）"
    state.record_sync(branch, True, message)
    return BackupResult(ok=True, status="pushed", branch=branch, message=message, commit=commit)


def merge(branch: str) -> BackupResult:
    branch = _validate_branch(branch)
    if branch == status.own_branch():
        raise AppError("不能合并本机推送分支", code="invalid_params", status=400)
    _ensure_idle()
    _begin()
    suspended = False
    try:
        _ensure_repo()
        review_service.prepare_sync()
        repo.commit_all(f"合并前保存本机 {state.stamp()}")
        review_service.close_for_sync()
        suspended = True
        try:
            repo.fetch_branch(branch)
            repo.merge_no_commit(branch)
        except repo.GitError as exc:
            raise AppError(f"合并失败：{exc}", code="backup_merge_failed", status=502) from exc

        found = status.conflicts()
        if found:
            state.set_merge(branch)
            suspended = False  # 交给解决或取消流程恢复复习
            return BackupResult(
                ok=False,
                status="conflict",
                branch=branch,
                message=f"有 {len(found)} 个文件冲突，请逐个选择保留本机还是采用对方。",
                conflicts=found,
            )
        if not repo.merge_in_progress():
            review_service.resume_after_sync()
            suspended = False
            message = f"本机已经包含 {branch} 的全部内容，无需合并。"
            state.record_sync(branch, True, message)
            return BackupResult(status="up-to-date", branch=branch, message=message)

        commit = repo.commit_merge(f"合并 {branch} {state.stamp()}")
        review_service.resume_after_sync()
        suspended = False
        message = f"已合并 {branch}，改动还在本机；确认无误后点「推送本机」。"
        state.record_sync(branch, True, message)
        return BackupResult(ok=True, status="merged", branch=branch, message=message, commit=commit)
    finally:
        if suspended:
            review_service.resume_after_sync()
        _end()
        status.invalidate()


def resolve(resolutions: dict[str, str]) -> BackupResult:
    _begin()
    try:
        if not repo.merge_in_progress():
            raise AppError("没有进行中的合并", code="backup_merge_missing", status=409)
        found = status.conflicts()
        missing = [item.path for item in found if item.path not in resolutions]
        if missing:
            raise AppError(
                f"还有 {len(missing)} 个冲突未选择",
                code="backup_unresolved",
                status=400,
                fields={path: "请选择保留本机或采用对方" for path in missing},
            )
        branch = state.merge_branch()
        for item in found:
            side = cast(Side, resolutions[item.path])
            if side not in ("local", "remote"):
                raise AppError("冲突选择必须是 local 或 remote", code="invalid_params", status=400)
            repo.take_side(item.path, side)
            if item.kind == "anki":
                repo.clear_anki_runtime_files()
        remaining = repo.unmerged_paths()
        if remaining:
            raise AppError(
                "仍有未解决的冲突：" + "、".join(remaining),
                code="backup_unresolved",
                status=400,
            )
        commit = repo.commit_merge(f"合并 {branch} {state.stamp()}")
        state.clear_merge()
        repo.clear_anki_runtime_files()
        review_service.resume_after_sync()
        message = f"已合并 {branch}，改动还在本机；确认无误后点「推送本机」。"
        state.record_sync(branch, True, message)
        return BackupResult(ok=True, status="merged", branch=branch, message=message, commit=commit)
    finally:
        _end()
        status.invalidate()


def abort() -> BackupResult:
    _begin()
    try:
        branch = state.merge_branch()
        if repo.repo_ready() and repo.merge_in_progress():
            try:
                repo.abort_merge()
            except repo.GitError as exc:
                raise AppError(
                    f"取消合并失败：{exc}", code="backup_abort_failed", status=500
                ) from exc
        state.clear_merge()
        repo.clear_anki_runtime_files()
        review_service.resume_after_sync()
        message = "已取消合并，本机数据保持合并前的状态。"
        return BackupResult(ok=True, status="aborted", branch=branch, message=message)
    finally:
        _end()
        status.invalidate()


def overwrite(branch: str) -> BackupResult:
    branch = _validate_branch(branch)
    own = status.own_branch()
    if branch == own:
        raise AppError("不能用本机推送分支覆盖本机", code="invalid_params", status=400)
    _ensure_idle()
    _begin()
    suspended = False
    try:
        _ensure_repo()
        review_service.prepare_sync()
        repo.commit_all(f"覆盖前保存本机 {state.stamp()}")
        safety = repo.create_safety_ref(f"{own.replace('/', '-')}-{datetime.now():%Y%m%d-%H%M%S}")
        try:
            review_service.close_for_sync()
            suspended = True
            repo.fetch_branch(branch)
            repo.reset_hard(f"origin/{branch}")
            repo.clear_anki_runtime_files()
        except repo.GitError as exc:
            raise AppError(f"覆盖失败：{exc}", code="backup_overwrite_failed", status=502) from exc
        finally:
            review_service.resume_after_sync()
            suspended = False
        message = (
            f"已用 {branch} 覆盖本机，安全引用保存在 {safety}。"
            "需要把本机分支也更新时，点「推送本机」。"
        )
        state.record_sync(branch, True, message)
        return BackupResult(
            ok=True, status="overwritten", branch=branch, message=message, commit=repo.head_sha()
        )
    finally:
        if suspended:
            review_service.resume_after_sync()
        _end()
        status.invalidate()


def auto_push() -> None:
    """每日一次：快照 anki → 提交全部改动 → 推送本机分支。失败一小时后重试。"""
    if repo.merge_in_progress() or not repo.repo_ready():
        return
    data = repo.read_state()
    now = int(time.time())
    if now - int(data.get("last_push_at") or 0) < DAILY_SECONDS:
        return
    if now - int(data.get("last_attempt_at") or 0) < RETRY_SECONDS:
        return
    data["last_attempt_at"] = now
    state.write_safe(data)
    if not _OP.acquire(blocking=False):
        return
    try:
        result = _push()
        log.info("每日自动推送完成：%s", result.message)
    except (AppError, OSError) as exc:
        log.warning("每日自动推送失败：%s", exc)
    finally:
        _end()
        status.invalidate()
