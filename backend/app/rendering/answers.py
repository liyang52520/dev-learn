"""把题库 answer 里的 <pre class='code' data-lang='java'> 换成高亮结构。"""

from __future__ import annotations

import hashlib
import re
from collections import OrderedDict

from app.rendering.highlight import highlight_code

_PRE = re.compile(r"<pre class='code' data-lang='([^']*)'><code>([\s\S]*?)</code></pre>")
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
