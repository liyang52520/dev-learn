"""文章文件读写：唯一允许直接碰 content/ 的地方。"""

from __future__ import annotations

import os
import shutil
import threading
import time
from pathlib import Path

from app.core.config import settings
from app.core.paths import safe_join
from app.features.posts.schemas import PostType

_write_lock = threading.Lock()


def content_dir(post_type: PostType) -> Path:
    return settings.content_dir / post_type


def file_of(post_type: PostType, slug: str) -> Path:
    return safe_join(content_dir(post_type), f"{slug}.md")


def list_names(post_type: PostType) -> list[str]:
    directory = content_dir(post_type)
    if not directory.is_dir():
        return []
    names = sorted(
        (path.name for path in directory.iterdir() if path.suffix == ".md"),
        key=lambda name: name.lower(),
    )
    return names


def slug_of(filename: str) -> str:
    return filename[:-3] if filename.endswith(".md") else filename


def read(post_type: PostType, slug: str) -> str | None:
    file = file_of(post_type, slug)
    try:
        return file.read_text(encoding="utf-8")
    except OSError:
        return None


def stamp_of(post_type: PostType, slug: str) -> tuple[int, int] | None:
    try:
        stat = file_of(post_type, slug).stat()
    except OSError:
        return None
    return (stat.st_mtime_ns, stat.st_size)


def fingerprint(post_type: PostType) -> str:
    directory = content_dir(post_type)
    if not directory.is_dir():
        return ""
    parts: list[str] = []
    for file in sorted(directory.glob("*.md"), key=lambda item: item.name.lower()):
        try:
            stat = file.stat()
        except OSError:
            parts.append(f"{file.name}:missing")
            continue
        parts.append(f"{file.name}:{stat.st_mtime_ns}:{stat.st_size}")
    return "|".join(parts)


def write(post_type: PostType, slug: str, raw: str) -> Path:
    directory = content_dir(post_type)
    directory.mkdir(parents=True, exist_ok=True)
    file = file_of(post_type, slug)
    with _write_lock:
        temp = file.with_name(f"{file.name}.tmp-{os.getpid()}-{time.time_ns()}")
        temp.write_text(raw, encoding="utf-8")
        os.replace(temp, file)
    return file


def delete(post_type: PostType, slug: str) -> bool:
    file = file_of(post_type, slug)
    if not file.exists():
        return False
    trash = settings.trash_dir / post_type
    trash.mkdir(parents=True, exist_ok=True)
    target = trash / f"{time.time_ns()}-{slug}.md"
    with _write_lock:
        shutil.move(str(file), str(target))
    return True


def move(from_type: PostType, to_type: PostType, slug: str) -> str | None:
    source = file_of(from_type, slug)
    if not source.exists():
        return None
    target_dir = content_dir(to_type)
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{slug}.md"
    final_slug = slug
    if target.exists():
        final_slug = f"{slug}-{time.time_ns()}"
        target = target_dir / f"{final_slug}.md"
    with _write_lock:
        shutil.move(str(source), str(target))
    return final_slug
