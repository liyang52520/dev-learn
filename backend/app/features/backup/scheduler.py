"""每日自动推送的后台线程：启动后补跑一次，之后每 10 分钟检查是否到期。"""

from __future__ import annotations

import logging
import threading

from app.features.backup import service

log = logging.getLogger("app.backup")

CHECK_EVERY = 10 * 60
STARTUP_DELAY = 20
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


def _loop() -> None:
    # 启动后稍等，让首批页面请求先完成；补跑逻辑由 last_push_at 判断。
    _stop.wait(STARTUP_DELAY)
    while not _stop.is_set():
        try:
            service.auto_push()
        except Exception:  # noqa: BLE001 - 后台任务不能因为一次异常退出
            log.exception("每日自动推送异常")
        _stop.wait(CHECK_EVERY)
