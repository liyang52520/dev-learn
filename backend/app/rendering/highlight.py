"""Pygments 代码高亮：文章页与题库答案共用同一套 DOM 与样式。"""

from __future__ import annotations

import html

from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import TextLexer, get_lexer_by_name
from pygments.util import ClassNotFound

_ALIASES = {
    "js": "javascript",
    "jsx": "javascript",
    "ts": "typescript",
    "tsx": "typescript",
    "sh": "bash",
    "shell": "bash",
    "zsh": "bash",
    "yml": "yaml",
    "py": "python",
    "kt": "kotlin",
    "docker": "docker",
    "properties": "properties",
    "ini": "ini",
    "log": "text",
    "text": "text",
    "http": "http",
}

_FORMATTER = HtmlFormatter(nowrap=True)


def normalize_lang(lang: str) -> str:
    key = (lang or "text").strip().lower()
    return _ALIASES.get(key, key)


def label_of(lang: str) -> str:
    return normalize_lang(lang).upper() or "TEXT"


def _lexer(lang: str):  # type: ignore[no-untyped-def]
    name = normalize_lang(lang)
    if name == "text":
        return TextLexer()
    try:
        return get_lexer_by_name(name, stripnl=False)
    except ClassNotFound:
        return TextLexer()


def code_wrapper(inner_html: str, lang: str) -> str:
    label = html.escape(label_of(lang))
    return (
        '<div class="code-block">'
        '<div class="code-bar">'
        '<span class="code-dots"><i></i><i></i><i></i></span>'
        f'<span class="code-lang">{label}</span>'
        '<button type="button" class="code-copy" data-code-copy>复制</button>'
        "</div>"
        f'<pre class="pyg"><code>{inner_html}</code></pre>'
        "</div>"
    )


def highlight_code(code: str, lang: str) -> str:
    if not code.strip():
        return code_wrapper(html.escape(code), lang)
    inner = highlight(code, _lexer(lang), _FORMATTER).rstrip("\n")
    return code_wrapper(inner, lang)
