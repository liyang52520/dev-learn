"""Markdown 渲染入口：纯函数，不读文件、不依赖业务模块。"""

from __future__ import annotations

import threading
from dataclasses import dataclass

from markdown_it import MarkdownIt

from app.rendering.plugins import build_markdown, postprocess
from app.rendering.toc import TocItem, apply_heading_ids

_local = threading.local()


def _markdown() -> MarkdownIt:
    """线程局部复用解析器实例；渲染 token 时才写入状态，不跨请求共享。"""
    instance = getattr(_local, "markdown", None)
    if instance is None:
        instance = build_markdown()
        _local.markdown = instance
    return instance


@dataclass(frozen=True)
class Rendered:
    html: str
    toc: list[TocItem]


def render_markdown(source: str) -> Rendered:
    md = _markdown()
    env: dict[str, object] = {}
    tokens = md.parse(source, env)
    toc = apply_heading_ids(tokens)
    body = md.renderer.render(tokens, md.options, env)
    return Rendered(html=postprocess(body), toc=toc)
