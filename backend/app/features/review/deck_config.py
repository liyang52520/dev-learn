"""deck 配置读写：每日上限、学习步骤与出队顺序。"""

from __future__ import annotations

from typing import Any

from app.core.errors import AppError
from app.features.review import collection


def get_config() -> dict[str, Any]:
    with collection.LOCK:
        col = collection.instance()
        cfg = col.decks.config_dict_for_deck_id(collection.deck())
        return {
            "deck": collection.DECK_NAME,
            "new_per_day": cfg["new"]["perDay"],
            "rev_per_day": cfg["rev"]["perDay"],
            "learning_steps": cfg["new"].get("delays"),
            # FSRS 的开关在 collection 全局配置里；desiredRetention 默认就是 0.9，不能拿它判断。
            "fsrs_enabled": bool(
                col.get_config("fsrs", False)
                or cfg.get("fsrsEnabled")
                or cfg.get("fsrsWeights")
                or cfg.get("fsrsParams5")
            ),
            "new_order": cfg.get("newGatherPriority"),
        }


def _parse_limit(value: int | None, label: str) -> int | None:
    if value is None:
        return None
    if value < 0 or value > 9999:
        raise AppError(f"{label} 必须在 0-9999 之间", code="invalid_params", status=400)
    return value


def set_config(new_per_day: int | None, rev_per_day: int | None) -> dict[str, Any]:
    new_limit = _parse_limit(new_per_day, "新卡 / 天")
    rev_limit = _parse_limit(rev_per_day, "复习 / 天")
    with collection.LOCK:
        col = collection.instance()
        cfg = col.decks.config_dict_for_deck_id(collection.deck())
        if new_limit is not None:
            cfg["new"]["perDay"] = new_limit
        if rev_limit is not None:
            cfg["rev"]["perDay"] = rev_limit
        col.decks.update_config(cfg)
        collection.mark_dirty()
    return get_config()


def ensure_queue_order() -> None:
    """新卡按导入顺序出队，避免默认的 deck/随机顺序打乱课程序。"""
    with collection.LOCK:
        col = collection.instance()
        cfg = col.decks.config_dict_for_deck_id(collection.deck())
        if cfg.get("newGatherPriority") == 1 and cfg.get("newSortOrder") == 1:
            return
        cfg["newGatherPriority"] = 1
        cfg["newSortOrder"] = 1
        col.decks.update_config(cfg)
        collection.mark_dirty()
