"""Markdown 到纯文本：摘要、阅读时长与检索共用的轻量清洗。"""

from __future__ import annotations

import re


def plain_text(markdown: str) -> str:
    text = re.sub(r"```[\s\S]*?```", " ", markdown)
    text = re.sub(r"`[^`]*`", " ", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"[#>*_~\-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()
