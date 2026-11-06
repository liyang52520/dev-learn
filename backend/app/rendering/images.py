"""图片尺寸：只读文件头，按 mtime + size 缓存。"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import unquote

from PIL import Image

from app.core.config import settings
from app.core.paths import safe_join

_cache: dict[str, tuple[float, int, tuple[int, int] | None]] = {}


def _public_file(src: str) -> Path | None:
    if not src.startswith("/study/"):
        return None
    clean = unquote(src.split("?", 1)[0].split("#", 1)[0])
    parts = [part for part in clean.split("/") if part]
    try:
        return safe_join(settings.public_dir, *parts)
    except ValueError:
        return None


def dimensions_of_src(src: str) -> tuple[int, int] | None:
    file = _public_file(src)
    if file is None:
        return None
    try:
        stat = file.stat()
    except OSError:
        return None
    key = str(file)
    cached = _cache.get(key)
    if cached and cached[0] == stat.st_mtime and cached[1] == stat.st_size:
        return cached[2]
    dims: tuple[int, int] | None
    try:
        with Image.open(file) as image:
            dims = image.size
    except Exception:
        dims = None
    _cache[key] = (stat.st_mtime, stat.st_size, dims)
    return dims
