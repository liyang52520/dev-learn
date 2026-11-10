"""题库答案渲染：Markdown 转 HTML，并兼容遗留的 <pre class='code'> 片段。

答案在数据里存 Markdown；这里把图片还原成带图注的 <figure class="pdf-img">，
附录的原始 HTML 代码块仍交给 highlight_answer 兜底。
"""

from __future__ import annotations

import hashlib
import html
import re
import threading
from collections import OrderedDict
from typing import Any

from app.rendering.highlight import highlight_code
from app.rendering.plugins import build_markdown, postprocess

_PRE = re.compile(r"<pre class='code' data-lang='([^']*)'><code>([\s\S]*?)</code></pre>")
_IMAGE_PARAGRAPH = re.compile(
    r"<p>\s*((?:<figure class=\"pdf-img\">[\s\S]*?</figure>)|(?:<img\b[^>]*>))\s*</p>"
)
_ENTITIES = {"lt": "<", "gt": ">", "amp": "&", "quot": '"', "#39": "'"}
_LIMIT = 240
_MAX_BYTES = 8 * 1024 * 1024

_cache: OrderedDict[str, str] = OrderedDict()
_cache_bytes = 0


def _decode(text: str) -> str:
    return re.sub(r"&(lt|gt|amp|quot|#39);", lambda m: _ENTITIES[m.group(1)], text)


def _cache_get(key: str) -> str | None:
    value = _cache.get(key)
    if value is None:
        return None
    _cache.move_to_end(key)
    return value


def _cache_set(key: str, value: str) -> None:
    global _cache_bytes
    size = len(value.encode())
    _cache[key] = value
    _cache.move_to_end(key)
    _cache_bytes += size
    while _cache and (len(_cache) > _LIMIT or _cache_bytes > _MAX_BYTES):
        _, old = _cache.popitem(last=False)
        _cache_bytes -= len(old.encode())


def highlight_answer(answer: str) -> str:
    if "<pre class='code'" not in answer:
        return answer

    key = hashlib.sha1(answer.encode()).hexdigest()  # noqa: S324 - 仅作缓存键
    cached = _cache_get(key)
    if cached is not None:
        return cached

    def replace(match: re.Match[str]) -> str:
        lang = match.group(1) or "text"
        code = _decode(match.group(2))
        if not code.strip():
            return match.group(0)
        return highlight_code(code, lang)

    result = _PRE.sub(replace, answer)
    _cache_set(key, result)
    return result


def _figure_image(
    _renderer: Any, tokens: list[Any], idx: int, _options: dict[str, Any], _env: dict[str, Any]
) -> str:
    """题库图片：`![alt](src "图注")` → figure + figcaption，保留原文图注。"""
    token = tokens[idx]
    src = token.attrGet("src") or ""
    alt = token.content or ""
    caption = token.attrGet("title") or ""
    image = (
        f'<img src="{html.escape(src, quote=True)}" alt="{html.escape(alt, quote=True)}"'
        ' loading="lazy" decoding="async">'
    )
    text = caption or alt
    if not text:
        return image
    return f'<figure class="pdf-img">{image}<figcaption>{html.escape(text)}</figcaption></figure>'


_local = threading.local()


def _markdown() -> Any:
    instance = getattr(_local, "markdown", None)
    if instance is None:
        instance = build_markdown(math=False, tasks=False)
        instance.add_render_rule("image", _figure_image)
        _local.markdown = instance
    return instance


def render_answer(source: str) -> str:
    """答案 Markdown → HTML；代码块由 fence 规则高亮，表格由 postprocess 包裹。"""
    md = _markdown()
    env: dict[str, object] = {}
    tokens = md.parse(source, env)
    body = md.renderer.render(tokens, md.options, env)
    body = postprocess(body)
    # Markdown 图片只能是行内元素，独占一段时把外层 <p> 拆掉，保持块级 figure。
    body = _IMAGE_PARAGRAPH.sub(lambda match: match.group(1), body)
    return highlight_answer(body)
