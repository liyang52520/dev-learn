"""markdown-it 插件与渲染规则：公式占位、代码块包裹、表格包裹、图片属性。"""

from __future__ import annotations

import html
import re
from typing import Any

from markdown_it import MarkdownIt
from mdit_py_plugins.dollarmath import dollarmath_plugin
from mdit_py_plugins.tasklists import tasklists_plugin

from app.rendering.highlight import highlight_code

_TABLE = re.compile(r"<table\b.*?</table>", re.DOTALL)
_IMG = re.compile(r"<img\b[^>]*>", re.IGNORECASE)


def _escape_attr(value: str) -> str:
    return html.escape(value, quote=True)


def _fence(
    _renderer: Any, tokens: list[Any], idx: int, options: dict[str, Any], env: dict[str, Any]
) -> str:
    token = tokens[idx]
    info = (token.info or "").strip().split(maxsplit=1)
    lang = info[0] if info else "text"
    return highlight_code(token.content, lang)


def _math_inline(
    _renderer: Any, tokens: list[Any], idx: int, options: dict[str, Any], env: dict[str, Any]
) -> str:
    tex = tokens[idx].content
    return f'<span class="math-inline" data-tex="{_escape_attr(tex)}">{html.escape(tex)}</span>'


def _math_block(
    _renderer: Any, tokens: list[Any], idx: int, options: dict[str, Any], env: dict[str, Any]
) -> str:
    tex = tokens[idx].content
    return (
        f'<div class="math-block" data-tex="{_escape_attr(tex)}" role="math">'
        f"{html.escape(tex)}</div>"
    )


def _image(
    _renderer: Any, tokens: list[Any], idx: int, options: dict[str, Any], env: dict[str, Any]
) -> str:
    token = tokens[idx]
    src = token.attrGet("src") or ""
    alt = token.content or ""
    title = token.attrGet("title")
    title_attr = f' title="{_escape_attr(title)}"' if title else ""
    return (
        f'<img src="{_escape_attr(src)}" alt="{_escape_attr(alt)}"{title_attr} '
        'loading="lazy" decoding="async">'
    )


def _add_attrs_to_raw_images(body: str) -> str:
    def fix(match: re.Match[str]) -> str:
        tag = match.group(0)
        if "loading=" not in tag:
            tag = tag[:-1] + ' loading="lazy">'
        if "decoding=" not in tag:
            tag = tag[:-1] + ' decoding="async">'
        return tag

    return _IMG.sub(fix, body)


def _wrap_tables(body: str) -> str:
    def wrap(match: re.Match[str]) -> str:
        table = match.group(0)
        if table.startswith('<div class="table-wrap"'):
            return table
        return f'<div class="table-wrap">{table}</div>'

    return _TABLE.sub(wrap, body)


def build_markdown(*, math: bool = True, tasks: bool = True) -> MarkdownIt:
    """博客用默认参数；题库答案关闭公式与任务列表，避免 `$变量$`、`- [ ]` 被误解析。"""
    md = MarkdownIt(
        "commonmark",
        {"html": True, "linkify": False, "typographer": False, "breaks": False},
    )
    md.enable(["table", "strikethrough"])
    if tasks:
        md.use(tasklists_plugin)
    if math:
        md.use(dollarmath_plugin, allow_space=True)
        md.add_render_rule("math_inline", _math_inline)
        md.add_render_rule("math_block", _math_block)
    md.add_render_rule("fence", _fence)
    md.add_render_rule("image", _image)
    return md


def postprocess(body: str) -> str:
    return _wrap_tables(_add_attrs_to_raw_images(body))
