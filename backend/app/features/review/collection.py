"""Anki collection 生命周期：延迟打开、快照、git 同步与后台维护。

复习状态不属于站点内容，存放在独立仓库 `anki-svc/data/`（dev-anki）。
本模块只管「库怎么开、怎么备份」，调度细节在 schedule.py。
"""

from __future__ import annotations

import contextlib
import logging
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path

from anki.collection import Collection
from anki.dbproxy import DBProxy
from anki.decks import DeckId

from app.core.config import settings
from app.core.errors import AppError

log = logging.getLogger("app.review")

DECK_NAME = "Java面试"
KEEP_BACKUPS = 30
SNAPSHOT_EVERY = 10 * 60
GIT_SYNC_EVERY = 15 * 60

LOCK = threading.RLock()
_dirty = {"value": False}
_snapshot_due = {"value": False}
_collection: Collection | None = None
_maintenance: threading.Thread | None = None


def collection_path() -> Path:
    return settings.anki_dir / "collection.anki2"


def backup_dir() -> Path:
    return settings.anki_dir / "backups"


def available() -> bool:
    return collection_path().is_file()


def instance() -> Collection:
    """延迟打开：只有第一次真正用到复习时才读 collection。"""
    global _collection
    if _collection is not None:
        return _collection
    path = collection_path()
    if not path.is_file():
        raise AppError(
            "复习数据尚未初始化：请先运行 python anki-svc/import.py",
            code="review_unavailable",
            status=503,
        )
    with LOCK:
        if _collection is None:
            try:
                _collection = Collection(str(path))
            except Exception as exc:  # noqa: BLE001 - 打不开就降级成 503，不把栈漏给前端
                log.exception("打开 collection 失败")
                raise AppError(
                    f"复习服务启动失败：{exc}", code="review_unavailable", status=503
                ) from exc
            _start_maintenance()
    return _collection


def db() -> DBProxy:
    """当前 collection 的数据库句柄；打开失败时 instance() 已抛 503。"""
    proxy = instance().db
    if proxy is None:
        raise AppError("复习库不可用", code="review_unavailable", status=503)
    return proxy


def deck() -> DeckId:
    col = instance()
    did = col.decks.id_for_name(DECK_NAME)
    if did is None:
        raise AppError(
            f"collection 里没有 deck：{DECK_NAME}，请先运行 anki-svc/import.py",
            code="review_unavailable",
            status=503,
        )
    col.decks.select(DeckId(did))
    return DeckId(did)


def deck_ids() -> list[int]:
    return [int(x) for x in instance().decks.deck_and_child_ids(deck())]


def mark_dirty() -> None:
    _dirty["value"] = True
    _snapshot_due["value"] = True


def is_dirty() -> bool:
    return _dirty["value"]


def snapshot(reason: str = "auto", *, force: bool = False) -> Path | None:
    """用 Anki 自带的备份器生成一致性快照。

    不能直接对 collection.anki2 做 sqlite3 在线备份：Anki 的 Rust 后端一直持有
    collection，`Connection.backup()` 遇到 BUSY 会无限重试，进而占死 LOCK，
    所有复习接口都会跟着卡住。
    """
    if not available():
        return None
    with LOCK:
        if not force and reason == "timer" and not _snapshot_due["value"]:
            return None
        col = _collection
        if col is None:
            return None
        target: Path | None = None
        try:
            folder = backup_dir()
            folder.mkdir(parents=True, exist_ok=True)
            before = set(folder.glob("*.colpkg"))
            col.create_backup(backup_folder=str(folder), force=True, wait_for_completion=True)
            created = [path for path in folder.glob("*.colpkg") if path not in before]
            if not created:
                raise RuntimeError("备份没有生成文件")
            target = max(created, key=lambda path: path.stat().st_mtime)
            if target.stat().st_size == 0:
                raise RuntimeError("备份结果为空")
        except Exception as exc:  # noqa: BLE001 - 快照失败不能影响复习
            log.warning("快照失败(%s): %s", reason, exc)
            if target is not None:
                target.unlink(missing_ok=True)
            return None
        _snapshot_due["value"] = False
        for old in sorted(backup_dir().glob("*.colpkg"))[:-KEEP_BACKUPS]:
            old.unlink(missing_ok=True)
        log.info("快照完成：%s", target.name)
        return target


def git_sync(message: str) -> tuple[bool, str]:
    """把 collection 提交并推到 dev-anki；返回真实结果，不假报成功。"""
    repo = str(settings.anki_dir)
    # data 目录必须自己是仓库，否则 git 会一路向上找到主仓库，
    # 把 backend/、frontend/ 等站点代码一起 add 进去。
    if not (settings.anki_dir / ".git").exists():
        return True, "anki-svc/data 未初始化为独立仓库，已跳过 git 同步"
    try:
        col = _collection
        if col is not None:
            proxy = col.db
            if proxy is not None:
                # 只做 PASSIVE 检查点。TRUNCATE 会等待所有读者退出，
                # 而 Anki 自己的连接一直开着，等待可能永不返回并长期占住 LOCK。
                with LOCK, contextlib.suppress(Exception):
                    proxy.all("pragma wal_checkpoint(passive)")
        repo = str(settings.anki_dir)
        subprocess.run(
            ["git", "-C", repo, "add", "-A"], check=True, timeout=60, capture_output=True
        )
        diff = subprocess.run(
            ["git", "-C", repo, "diff", "--cached", "--quiet"], timeout=60, capture_output=True
        )
        if diff.returncode == 0:
            return True, "没有改动，无需推送"
        subprocess.run(
            ["git", "-C", repo, "commit", "-q", "-m", message],
            check=True,
            timeout=60,
            capture_output=True,
        )
        subprocess.run(
            ["git", "-C", repo, "push", "-q", "origin", "HEAD"],
            check=True,
            timeout=120,
            capture_output=True,
        )
        return True, "已提交并推送"
    except subprocess.CalledProcessError as exc:
        raw = exc.stderr or b""
        text = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else str(raw)
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return False, lines[-1] if lines else f"git 退出码 {exc.returncode}"
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)


def _start_maintenance() -> None:
    global _maintenance
    if _maintenance and _maintenance.is_alive():
        return
    _maintenance = threading.Thread(target=_maintenance_loop, daemon=True, name="anki-upkeep")
    _maintenance.start()


def _maintenance_loop() -> None:
    last_snapshot = last_git = last_checkpoint = time.time()
    while True:
        time.sleep(30)
        now = time.time()
        if now - last_snapshot >= SNAPSHOT_EVERY:
            snapshot("timer")
            last_snapshot = now
        if now - last_git >= GIT_SYNC_EVERY and _dirty["value"]:
            _dirty["value"] = False
            git_sync(f"复习 {datetime.now():%Y-%m-%d %H:%M} 自动同步")
            last_git = now
        if now - last_checkpoint >= 300:
            col = _collection
            proxy = col.db if col is not None else None
            if proxy is not None:
                with LOCK, contextlib.suppress(Exception):
                    proxy.all("pragma wal_checkpoint(passive)")
            last_checkpoint = now


def close() -> None:
    """进程退出前的收尾：快照 + 有改动才推送。"""
    global _collection
    with LOCK:
        if _collection is None:
            return
        snapshot("shutdown")
        if _dirty["value"]:
            git_sync(f"复习 {datetime.now():%Y-%m-%d %H:%M} 收尾同步")
        _collection.close()
        _collection = None
