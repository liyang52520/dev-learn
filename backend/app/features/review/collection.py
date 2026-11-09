"""Anki collection 生命周期：延迟打开、快照与后台维护。

复习状态属于站点数据，和 blog / study 一起放在独立仓库 `backend/data/`（dev-anki）。
git 同步由 `features/backup` 负责；本模块只管「库怎么开、怎么关、怎么备份」。
"""

from __future__ import annotations

import contextlib
import logging
import threading
import time
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

LOCK = threading.RLock()
_snapshot_due = {"value": False}
_suspended = {"value": False}
_generation = {"value": 0}
_collection: Collection | None = None
_maintenance: threading.Thread | None = None


def generation() -> int:
    """collection 每次打开/关闭都递增；统计缓存据此判断是否必须重算。"""
    return _generation["value"]


def collection_path() -> Path:
    return settings.anki_dir / "collection.anki2"


def backup_dir() -> Path:
    return settings.anki_dir / "backups"


def available() -> bool:
    return collection_path().is_file()


def ensure_fsrs(col: Collection) -> bool:
    """统一用 FSRS 调度：打开 collection 时自动补上全局开关。

    Anki 把 FSRS 开关存在 collection 全局配置里，老库默认没有这个键。
    新机器部署后不该再手工打开，所以这里做一次幂等的兜底。
    """
    if col.get_config("fsrs", False):
        return False
    col.set_config("fsrs", True)
    return True


def _merge_pending() -> bool:
    """跨重启也要拦住复习：残留的 merge 会改 anki 文件，绝不能在库打开时进行。"""
    return (settings.data_dir / ".git" / "MERGE_HEAD").exists()


def instance() -> Collection:
    """延迟打开：只有第一次真正用到复习时才读 collection。"""
    global _collection
    if _merge_pending():
        raise AppError(
            "备份合并尚未完成，复习已暂停；请到「数据备份」解决或取消合并",
            code="backup_merge_pending",
            status=503,
        )
    if _suspended["value"]:
        raise AppError(
            "数据同步进行中，复习暂时不可用，请稍后刷新",
            code="sync_in_progress",
            status=503,
        )
    if _collection is not None:
        return _collection
    path = collection_path()
    if not path.is_file():
        raise AppError(
            "复习数据尚未初始化：请先运行 python -m app.features.review.importer",
            code="review_unavailable",
            status=503,
        )
    with LOCK:
        if _suspended["value"]:
            raise AppError(
                "数据同步进行中，复习暂时不可用，请稍后刷新",
                code="sync_in_progress",
                status=503,
            )
        if _collection is None:
            try:
                _collection = Collection(str(path))
            except Exception as exc:  # noqa: BLE001 - 打不开就降级成 503，不把栈漏给前端
                log.exception("打开 collection 失败")
                raise AppError(
                    f"复习服务启动失败：{exc}", code="review_unavailable", status=503
                ) from exc
            _generation["value"] += 1
            if ensure_fsrs(_collection):
                _snapshot_due["value"] = True
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
            f"collection 里没有 deck：{DECK_NAME}，请先运行 python -m app.features.review.importer",
            code="review_unavailable",
            status=503,
        )
    col.decks.select(DeckId(did))
    return DeckId(did)


def deck_ids() -> list[int]:
    return [int(x) for x in instance().decks.deck_and_child_ids(deck())]


def mark_dirty() -> None:
    _snapshot_due["value"] = True


def snapshot(reason: str = "auto", *, force: bool = False) -> tuple[Path, bool] | None:
    """用 Anki 自带的备份器生成一致性快照。

    不能直接对 collection.anki2 做 sqlite3 在线备份：Anki 的 Rust 后端一直持有
    collection，`Connection.backup()` 遇到 BUSY 会无限重试，进而占死 LOCK，
    所有复习接口都会跟着卡住。

    返回值第二项表示是否复用了已有快照：Anki 在 collection 没有改动时不会生成
    新文件，这不是失败，手动同步和退出收尾都应继续走 git。
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
        reused = False
        try:
            folder = backup_dir()
            folder.mkdir(parents=True, exist_ok=True)
            before = set(folder.glob("*.colpkg"))
            created_ok = col.create_backup(
                backup_folder=str(folder), force=True, wait_for_completion=True
            )
            created = [path for path in folder.glob("*.colpkg") if path not in before]
            if created:
                target = max(created, key=lambda path: path.stat().st_mtime)
            else:
                existing = sorted(folder.glob("*.colpkg"), key=lambda path: path.stat().st_mtime)
                if created_ok or not existing:
                    raise RuntimeError("备份没有生成文件")
                target = existing[-1]
                reused = True
            if target.stat().st_size == 0:
                raise RuntimeError("备份结果为空")
        except Exception as exc:  # noqa: BLE001 - 快照失败不能影响复习
            log.warning("快照失败(%s): %s", reason, exc)
            if not reused and target is not None:
                target.unlink(missing_ok=True)
            return None
        _snapshot_due["value"] = False
        # 新旧两代快照统一保留最近 KEEP_BACKUPS 份，避免旧 .anki2 一直堆积。
        files = [
            *backup_dir().glob("*.colpkg"),
            *backup_dir().glob("collection-*.anki2"),
        ]
        for old in sorted(files, key=lambda path: path.stat().st_mtime)[:-KEEP_BACKUPS]:
            old.unlink(missing_ok=True)
        if reused:
            log.info("快照跳过(%s)：collection 无改动，沿用 %s", reason, target.name)
        else:
            log.info("快照完成：%s", target.name)
        return target, reused


def checkpoint() -> None:
    """只做 PASSIVE 检查点。

    TRUNCATE 会等待所有读者退出，而 Anki 自己的连接一直开着，
    等待可能永不返回并长期占住 LOCK。
    """
    with LOCK:
        col = _collection
        proxy = col.db if col is not None else None
        if proxy is not None:
            with contextlib.suppress(Exception):
                proxy.all("pragma wal_checkpoint(passive)")


def suspend() -> None:
    """同步前关闭 collection：git 改动工作区前必须先让它松手。"""
    global _collection
    with LOCK:
        _suspended["value"] = True
        if _collection is not None:
            with contextlib.suppress(Exception):
                _collection.close()
            _collection = None
            _generation["value"] += 1


def resume() -> None:
    """同步结束；下次访问复习接口时按需重新打开。"""
    with LOCK:
        _suspended["value"] = False


def is_suspended() -> bool:
    return _suspended["value"]


def clear_runtime_files() -> None:
    """工作区被 git 改写后，旧的 WAL / SHM 不能再交给新库。"""
    base = collection_path()
    for suffix in ("-wal", "-shm", "-journal"):
        Path(f"{base}{suffix}").unlink(missing_ok=True)


def _start_maintenance() -> None:
    global _maintenance
    if _maintenance and _maintenance.is_alive():
        return
    _maintenance = threading.Thread(target=_maintenance_loop, daemon=True, name="anki-upkeep")
    _maintenance.start()


def _maintenance_loop() -> None:
    last_snapshot = last_checkpoint = time.time()
    while True:
        time.sleep(30)
        now = time.time()
        if now - last_snapshot >= SNAPSHOT_EVERY:
            snapshot("timer")
            last_snapshot = now
        if now - last_checkpoint >= 300:
            checkpoint()
            last_checkpoint = now


def close() -> None:
    """进程退出前的收尾：快照后关闭；git 同步由备份模块负责。"""
    global _collection
    with LOCK:
        if _collection is None:
            return
        snapshot("shutdown")
        checkpoint()
        _collection.close()
        _collection = None
