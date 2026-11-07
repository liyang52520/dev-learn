"""同步状态文件：最近推送、每日补跑时间与未完成的合并分支。"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any

from app.features.backup import repository as repo

log = logging.getLogger("app.backup")


def stamp() -> str:
    return f"{datetime.now():%Y-%m-%d %H:%M}"


def write_safe(state: dict[str, Any]) -> None:
    try:
        repo.write_state(state)
    except OSError as exc:
        log.warning("写入同步状态失败：%s", exc)


def record_sync(branch: str, ok: bool, message: str) -> None:
    state = repo.read_state()
    state["last_sync"] = {
        "at": f"{datetime.now():%Y-%m-%d %H:%M:%S}",
        "branch": branch,
        "ok": ok,
        "message": message,
    }
    if ok:
        state["last_push_at"] = int(time.time())
        state.pop("merge_branch", None)
    write_safe(state)


def set_merge(branch: str) -> None:
    state = repo.read_state()
    state["merge_branch"] = branch
    write_safe(state)


def clear_merge() -> None:
    state = repo.read_state()
    state.pop("merge_branch", None)
    write_safe(state)


def merge_branch() -> str:
    return str(repo.read_state().get("merge_branch") or "")
