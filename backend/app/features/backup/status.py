"""备份状态：本机分支识别、远端分支列表与短时缓存。"""

from __future__ import annotations

import re
import socket
import threading
import time
from typing import Any

from app.core.config import settings
from app.core.errors import AppError
from app.features.backup import repository as repo
from app.features.backup.schemas import (
    BackupBranch,
    BackupConflict,
    BackupLastSync,
    BackupRef,
    BackupStatus,
)
from app.features.review import service as review_service

STATUS_TTL = 2.0
_lock = threading.Lock()
_cache: dict[str, Any] = {"at": 0.0, "key": "", "value": None}


def own_branch() -> str:
    """环境变量优先；否则用主机名生成 `machine/<slug>`，同一台机器永远同一个分支。"""
    if settings.data_sync_branch:
        name = settings.data_sync_branch
    else:
        slug = re.sub(r"[^A-Za-z0-9._-]+", "-", socket.gethostname()).strip("-.").lower()
        name = f"machine/{slug or 'machine'}"
    if not repo.valid_branch(name):
        raise AppError(
            f"本机分支名不合法：{name}，请用 DATA_SYNC_BRANCH 指定",
            code="backup_branch",
            status=500,
        )
    return name


def safe_own_branch() -> str:
    try:
        return own_branch()
    except AppError:
        return ""


def safety_refs() -> list[BackupRef]:
    rows = repo.safety_refs()
    if rows is None:
        raise AppError("无法读取安全引用", code="backup_status_failed", status=502)
    return [BackupRef(**row) for row in rows]


def conflicts() -> list[BackupConflict]:
    paths = repo.unmerged_paths()
    if paths is None:
        raise AppError("无法读取合并冲突列表", code="backup_status_failed", status=502)
    return [
        BackupConflict(path=path, kind="anki" if path.startswith("anki/") else "text")
        for path in paths
    ]


def invalidate() -> None:
    with _lock:
        _cache["value"] = None
        _cache["at"] = 0.0


def read() -> BackupStatus:
    key = str(settings.data_dir)
    with _lock:
        cached = _cache["value"]
        fresh = time.monotonic() - float(_cache["at"]) < STATUS_TTL
        if isinstance(cached, BackupStatus) and _cache["key"] == key and fresh:
            return cached
    value = _build()
    with _lock:
        _cache.update(at=time.monotonic(), key=key, value=value)
    return value


def _build() -> BackupStatus:
    own = safe_own_branch()
    if not repo.repo_ready():
        return BackupStatus(
            repo=False,
            branch="",
            own_branch=own,
            remote="",
            dirty=False,
            merging=False,
            merge_branch="",
            conflicts=[],
            branches=[],
            own_pushed=False,
            own_ahead=0,
            own_behind=0,
            last_sync=None,
            anki_available=review_service.anki_available(),
            suspended=review_service.sync_suspended(),
            message="backend/data 未初始化为独立 git 仓库，数据备份不可用。",
        )

    merging = repo.merge_in_progress()
    state = repo.read_state()
    merge_branch = str(state.get("merge_branch") or "") if merging else ""
    rows = repo.remote_branches()
    refs = repo.safety_refs()
    dirty = repo.is_dirty()
    degraded = rows is None or refs is None or dirty is None
    found: list[BackupConflict] = []
    if merging:
        try:
            found = conflicts()
        except AppError:
            degraded = True
    own_row = next((row for row in (rows or []) if row["name"] == own), None)
    last = state.get("last_sync")
    last_sync = BackupLastSync(**last) if isinstance(last, dict) else None

    message = ""
    if merging:
        message = f"正在合并 {merge_branch or '远端分支'}，合并完成前复习暂停。"
    elif dirty:
        message = "工作区有未提交改动；推送时会连同 blog / study / anki 一起提交。"

    return BackupStatus(
        repo=True,
        branch=repo.current_branch(),
        own_branch=own,
        remote=repo.remote_url(),
        dirty=dirty,
        merging=merging,
        merge_branch=merge_branch,
        conflicts=found,
        branches=[
            BackupBranch(
                name=str(row["name"]),
                sha=str(row["sha"]),
                updated_at=str(row["updated_at"]),
                ahead=int(row["ahead"]),
                behind=int(row["behind"]),
                is_own=str(row["name"]) == own,
            )
            for row in (rows or [])
        ],
        own_pushed=own_row is not None,
        own_ahead=int(own_row["ahead"]) if own_row else 0,
        own_behind=int(own_row["behind"]) if own_row else 0,
        last_sync=last_sync,
        anki_available=review_service.anki_available(),
        suspended=review_service.sync_suspended(),
        message=message,
        degraded=degraded,
        error=(
            "无法读取 git 状态（权限、索引锁或仓库损坏），下面的数字不可信。" if degraded else ""
        ),
        safety_refs=[BackupRef(**row) for row in (refs or [])],
    )
