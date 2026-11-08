"""每日自动推送：判断是否到期并执行，配合后台线程每 10 分钟检查一次。"""

from __future__ import annotations

import logging
import threading
import time

from app.core.errors import AppError
from app.features.backup import repository as repo
from app.features.backup import service, state

log = logging.getLogger("app.backup")

CHECK_EVERY = 10 * 60
STARTUP_DELAY = 20
DAILY_SECONDS = 24 * 60 * 60
RETRY_SECONDS = 60 * 60
_stop = threading.Event()
_thread: threading.Thread | None = None


def start() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, daemon=True, name="data-backup")
    _thread.start()


def stop() -> None:
    _stop.set()


def auto_push() -> None:
    """每日一次：提交全部改动并推送本机分支；失败一小时后重试。"""
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
    try:
        result = service.push()
        log.info("每日自动推送完成：%s", result.message)
    except (AppError, OSError) as exc:
        log.warning("每日自动推送失败：%s", exc)


def _loop() -> None:
    # 启动后稍等，让首批页面请求先完成；补跑逻辑由 last_push_at 判断。
    _stop.wait(STARTUP_DELAY)
    while not _stop.is_set():
        try:
            auto_push()
        except Exception:  # noqa: BLE001 - 后台任务不能因为一次异常退出
            log.exception("每日自动推送异常")
        _stop.wait(CHECK_EVERY)
