"""题库 JSON 读取：索引单例 + 专题按 mtime/size 做 LRU 缓存。"""

from __future__ import annotations

import json
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.errors import AppError
from app.core.paths import safe_join

_lock = threading.RLock()
_index_cache: dict[str, Any] | None = None
_topic_cache: OrderedDict[str, tuple[tuple[int, int], dict[str, Any]]] = OrderedDict()
_TOPIC_LIMIT = 6


def load_index() -> dict[str, Any]:
    global _index_cache
    with _lock:
        if _index_cache is None:
            file = settings.study_dir / "index.json"
            _index_cache = json.loads(file.read_text(encoding="utf-8"))
        return _index_cache


def load_topic(topic_id: str) -> dict[str, Any] | None:
    try:
        file: Path = safe_join(settings.study_dir, f"{topic_id}.json")
    except ValueError as exc:
        raise AppError("专题不存在", code="not_found", status=404) from exc
    if not file.is_file():
        return None
    stat = file.stat()
    stamp = (stat.st_mtime_ns, stat.st_size)
    key = str(file)
    with _lock:
        cached = _topic_cache.get(key)
        if cached and cached[0] == stamp:
            _topic_cache.move_to_end(key)
            return cached[1]
    data: dict[str, Any] = json.loads(file.read_text(encoding="utf-8"))
    with _lock:
        _topic_cache[key] = (stamp, data)
        _topic_cache.move_to_end(key)
        while len(_topic_cache) > _TOPIC_LIMIT:
            _topic_cache.popitem(last=False)
    return data


def topic_ids() -> list[str]:
    return [topic["id"] for topic in load_index()["topics"]]


def reset() -> None:
    """测试用：清空缓存。"""
    global _index_cache
    with _lock:
        _index_cache = None
        _topic_cache.clear()
