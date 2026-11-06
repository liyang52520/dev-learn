"""标题锚点与目录。锚点规则与 github-slugger 对齐，保证旧链接不失效。"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

_SPACE = re.compile(r"\s+")
_HTML_TAG = re.compile(r"<[^>]+>")


@dataclass(frozen=True)
class TocItem:
    depth: int
    text: str
    id: str


class Slugger:
    """同一份文档内去重：重复标题依次加 -1、-2。"""

    def __init__(self) -> None:
        self._seen: dict[str, int] = {}

    def slug(self, text: str) -> str:
        base = _slugify(text)
        count = self._seen.get(base)
        if count is None:
            self._seen[base] = 0
            return base
        count += 1
        self._seen[base] = count
        return f"{base}-{count}"


def _slugify(text: str) -> str:
    text = _HTML_TAG.sub("", text).strip().lower()
    chars: list[str] = []
    for char in text:
        if char.isalnum() or char in {"-", "_"}:
            chars.append(char)
        elif char.isspace():
            chars.append("-")
    return "".join(chars)


def inline_text(token: Any) -> str:
    """取 inline token 的纯文本（代码、链接、强调都按文字计入）。"""
    parts: list[str] = []
    for child in token.children or []:
        kind = child.type
        if kind in {"text", "code_inline", "math_inline"}:
            parts.append(child.content)
        elif kind == "softbreak":
            parts.append(" ")
    return _SPACE.sub(" ", "".join(parts)).strip()


def apply_heading_ids(tokens: list[Any]) -> list[TocItem]:
    """给 heading_open 补 id，并收集 h2/h3 目录项。"""
    slugger = Slugger()
    items: list[TocItem] = []
    for index, token in enumerate(tokens):
        if token.type != "heading_open":
            continue
        inline = tokens[index + 1] if index + 1 < len(tokens) else None
        text = inline_text(inline) if inline is not None else ""
        if not text:
            continue
        anchor = slugger.slug(text)
        token.attrSet("id", anchor)
        depth = int(token.tag[1:])
        if depth in (2, 3):
            items.append(TocItem(depth=depth, text=text, id=anchor))
    return items
