"""仓库路径解析与安全拼接。所有文件读写都必须经过这里。"""

from __future__ import annotations

import re
from pathlib import Path

_SAFE_SEGMENT = re.compile(r"^[^/\\\0]+$")


def repo_root() -> Path:
    """backend/app/core/paths.py → 仓库根。"""
    return Path(__file__).resolve().parents[3]


def safe_join(base: Path, *segments: str) -> Path:
    """把若干路径片段拼到 base 下，并保证结果仍在 base 内。

    任一片段包含路径分隔符、为空、或以 . 开头（隐藏文件）时直接拒绝。
    """
    for segment in segments:
        if not segment or not _SAFE_SEGMENT.match(segment) or segment in {".", ".."}:
            raise ValueError(f"非法路径片段: {segment!r}")
        if segment.startswith("."):
            raise ValueError(f"非法路径片段: {segment!r}")
    target = base.joinpath(*segments).resolve()
    root = base.resolve()
    if target != root and root not in target.parents:
        raise ValueError("路径越界")
    return target
