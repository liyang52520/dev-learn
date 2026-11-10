"""题库 JSON 读写：索引单例 + 专题按 mtime/size 做 LRU 缓存。"""

from __future__ import annotations

import json
import os
import threading
import time
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


def index_file() -> Path:
    return settings.study_dir / "index.json"


def topic_file(topic_id: str) -> Path:
    try:
        return safe_join(settings.study_dir, f"{topic_id}.json")
    except ValueError as exc:
        raise AppError("专题不存在", code="not_found", status=404) from exc


def load_index() -> dict[str, Any]:
    global _index_cache
    with _lock:
        if _index_cache is None:
            _index_cache = json.loads(index_file().read_text(encoding="utf-8"))
        return _index_cache


def load_topic(topic_id: str) -> dict[str, Any] | None:
    file = topic_file(topic_id)
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


def fingerprint() -> str:
    """index.json 的 mtime + size：供检索缓存判断题库是否被后台改动。"""
    try:
        stat = index_file().stat()
    except OSError:
        return ""
    return f"{stat.st_mtime_ns}:{stat.st_size}"


def _write_json(file: Path, data: dict[str, Any]) -> None:
    file.parent.mkdir(parents=True, exist_ok=True)
    temp = file.with_name(f"{file.name}.tmp-{os.getpid()}-{time.time_ns()}")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp, file)


def write_topic(topic_id: str, data: dict[str, Any]) -> None:
    file = topic_file(topic_id)
    with _lock:
        _write_json(file, data)
        stat = file.stat()
        _topic_cache[str(file)] = ((stat.st_mtime_ns, stat.st_size), data)
        _topic_cache.move_to_end(str(file))
        while len(_topic_cache) > _TOPIC_LIMIT:
            _topic_cache.popitem(last=False)


def write_index(data: dict[str, Any]) -> None:
    global _index_cache
    with _lock:
        _write_json(index_file(), data)
        _index_cache = data


def reset() -> None:
    """测试用：清空缓存。"""
    global _index_cache
    with _lock:
        _index_cache = None
        _topic_cache.clear()
