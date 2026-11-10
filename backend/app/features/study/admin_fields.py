"""后台题库编辑的字段校验：清洗文本、解析证据路径、拦截不安全 HTML。"""

from __future__ import annotations

import html
import re
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from app.core.config import settings
from app.core.errors import AppError
from app.core.paths import safe_join
from app.features.study.admin_schemas import QuestionWrite
from app.rendering.images import dimensions_of_src

_FIGCAPTION = re.compile(r"<figcaption[\s\S]*?</figcaption>", re.IGNORECASE)
_HTML_TAG = re.compile(
    r"</?(?:p|ul|ol|li|figure|figcaption|img|pre|code|table|thead|tbody|tr|td|th"
    r"|h[1-6]|div|span|br|strong|em|a|blockquote)\b[^>]*>",
    re.IGNORECASE,
)
_FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})[^\n]*\n([\s\S]*?)^ {0,3}\1[ \t]*$", re.MULTILINE)
_MD_IMAGE = re.compile(r"(?<!\\)!\[[^\]]*\]\([^)]*\)")
_MD_LINK = re.compile(r"(?<!\\)\[([^\]]*)\]\([^)]*\)")
_MD_MARKER = re.compile(r"^ {0,3}(?:#{1,6}[ \t]+|> ?|[-*+][ \t]+|\d{1,9}[.)][ \t]+)", re.MULTILINE)
_MD_CODE = re.compile(r"(`+)([^`\n]*?)\1")
_MD_SEPARATOR = re.compile(r"^[ \t]*\|(?:[ \t]*:?-+:?[ \t]*\|)+[ \t]*$", re.MULTILINE)
_MD_TABLE_ROW = re.compile(r"^[ \t]*\|.*\|[ \t]*$", re.MULTILINE)
_MD_ESCAPE = re.compile(r"\\([\\`*_{}\[\]()#+\-.!<>|~&$])")
_ENTITY = re.compile(r"&(?:#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);")
_UNSAFE = re.compile(
    r"<\s*(?:script|iframe|object|embed)\b|\son[a-z]+\s*=|\bjavascript\s*:",
    re.IGNORECASE,
)
EVIDENCE_LIMIT = 32


def plain_for_search(markup: str) -> str:
    """答案 Markdown（兼容遗留 HTML）→ 纯文本：丢图片、留代码与正文。"""
    codes: list[str] = []

    def stash(match: re.Match[str]) -> str:
        codes.append(match.group(2))
        return f"\x00{len(codes) - 1}\x00"

    def table_row(match: re.Match[str]) -> str:
        # 表格行里未转义的 `|` 是单元格分隔符；`\|` 是正文里的字面竖线，留给后面的反转义。
        cells = re.split(r"(?<!\\)\|", match.group(0))
        return " " + " ".join(cell.strip() for cell in cells) + " "

    text = markup.replace("\x00", "")
    text = _FIGCAPTION.sub(" ", text)
    text = _FENCE.sub(stash, text)
    text = _MD_IMAGE.sub(" ", text)
    text = _MD_LINK.sub(lambda match: match.group(1), text)
    text = _MD_MARKER.sub("", text)
    text = _MD_SEPARATOR.sub("", text)
    text = _MD_TABLE_ROW.sub(table_row, text)
    text = text.replace("\\`", "\x01")
    text = _MD_CODE.sub(lambda match: match.group(2), text)
    text = text.replace("\x01", "`")
    text = _HTML_TAG.sub(" ", text)
    text = _MD_ESCAPE.sub(lambda match: match.group(1), text)
    text = re.sub(r"\x00(\d+)\x00", lambda match: codes[int(match.group(1))], text)
    text = _ENTITY.sub(lambda match: html.unescape(match.group(0)), text)
    return re.sub(r"\s+", " ", text).strip()


def search_field(question: dict[str, Any]) -> str:
    return " ".join(
        [
            question.get("title", ""),
            " ".join(question.get("aliases") or []),
            " ".join(question.get("summary") or []),
            question.get("note", ""),
            plain_for_search(question.get("answer", "")),
        ]
    )


def public_file(topic: dict[str, Any], public: str) -> Path:
    prefix = f"/study/{topic['slug']}/"
    clean = unquote(public.split("?", 1)[0].split("#", 1)[0])
    if not clean.startswith(prefix):
        raise AppError(
            "证据截图必须位于当前专题的 /study/ 目录下", code="invalid_params", status=400
        )
    relative = clean[len(prefix) :]
    try:
        return safe_join(settings.study_dir, topic["slug"], *relative.split("/"))
    except ValueError as exc:
        raise AppError("证据截图路径非法", code="invalid_params", status=400) from exc


def clean_text_list(values: list[str]) -> list[str]:
    return [value.strip() for value in values if value.strip()]


def validate_question(topic: dict[str, Any], payload: QuestionWrite) -> dict[str, Any]:
    title = payload.title.strip()
    answer = payload.answer.strip()
    if not title:
        raise AppError(
            "题目标题不能为空", code="invalid_params", status=400, fields={"title": "必填"}
        )
    if not answer:
        raise AppError(
            "题目答案不能为空", code="invalid_params", status=400, fields={"answer": "必填"}
        )
    if _UNSAFE.search(answer):
        raise AppError(
            "答案里不能包含脚本、内联事件或 javascript: 链接",
            code="invalid_params",
            status=400,
            fields={"answer": "包含不安全 HTML"},
        )

    groups: list[dict[str, Any]] = []
    for group in payload.evidence[:EVIDENCE_LIMIT]:
        if not group.files:
            continue
        from_page = max(1, int(group.from_page))
        to_page = max(from_page, int(group.to))
        files: list[dict[str, Any]] = []
        for file in group.files:
            page = int(file.page)
            if page < 1:
                raise AppError("证据页码必须大于 0", code="invalid_params", status=400)
            path = public_file(topic, file.file)
            if not path.is_file() or dimensions_of_src(file.file) is None:
                raise AppError(
                    f"证据截图不存在：{file.file}",
                    code="invalid_params",
                    status=400,
                    fields={"evidence": "截图文件缺失"},
                )
            files.append({"page": page, "file": file.file})
        if not files:
            continue
        label = group.label.strip() or ("原文出处" if not groups else f"出处 {len(groups) + 1}")
        groups.append({"label": label, "from": from_page, "to": to_page, "files": files})

    pages = payload.pages.strip()
    first_page = payload.first_page
    if groups:
        start = min(group["from"] for group in groups)
        end = max(group["to"] for group in groups)
        pages = pages or (f"p{start}" if start == end else f"p{start}–{end}")
        first_page = first_page or groups[0]["from"]
    first_page = first_page or 1
    question: dict[str, Any] = {
        "title": title,
        "aliases": clean_text_list(payload.aliases),
        "summary": clean_text_list(payload.summary),
        "note": payload.note.strip(),
        "pages": pages,
        "firstPage": first_page,
        "answer": answer,
        "evidence": groups,
    }
    question["search"] = search_field(question)
    return question
