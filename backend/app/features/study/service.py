"""题库业务：专题摘要、题目详情、答案高亮与图片尺寸补齐。"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import unquote

from app.core.errors import AppError
from app.features.study import repository
from app.features.study.schemas import (
    EvidenceFile,
    EvidenceGroup,
    QuestionDetail,
    QuestionNav,
    StudyIndexResponse,
    TopicDetail,
    TopicMeta,
    TopicSummary,
)
from app.rendering.answers import highlight_answer
from app.rendering.images import dimensions_of_src

_IMG = re.compile(r"<img\b[^>]*>", re.IGNORECASE)
_SRC = re.compile(r"""\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')""", re.IGNORECASE)
_SIZE_ATTR = re.compile(r"""\s+(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)""", re.IGNORECASE)


def _summary(topic: dict[str, Any]) -> TopicSummary:
    questions = topic.get("questions", [])
    return TopicSummary(
        id=topic["id"],
        no=topic["no"],
        slug=topic["slug"],
        title=topic["title"],
        label=topic["label"],
        subtitle=topic["subtitle"],
        accent=topic["accent"],
        pages=topic["pages"],
        count=topic["count"],
        first_qid=questions[0]["id"] if questions else "",
    )


def list_topics() -> StudyIndexResponse:
    index = repository.load_index()
    meta = TopicMeta(**index["meta"])
    return StudyIndexResponse(meta=meta, topics=[_summary(topic) for topic in index["topics"]])


def index_document() -> dict[str, Any]:
    """检索使用的轻量索引（题目不含答案与证据）。"""
    return repository.load_index()


def topic_document(topic_id: str) -> dict[str, Any] | None:
    """原始专题文档：供同站其他 feature 读取题目结构，不做二次组装。"""
    return repository.load_topic(topic_id)


def topic_detail(topic_id: str) -> TopicDetail:
    topic = repository.load_topic(topic_id)
    if topic is None:
        raise AppError("专题不存在", code="not_found", status=404)
    summary = _summary(topic)
    nav = [
        QuestionNav(
            id=question["id"],
            no=question["no"],
            title=question["title"],
            aliases=question.get("aliases", []),
        )
        for question in topic["questions"]
    ]
    return TopicDetail(
        id=summary.id,
        no=summary.no,
        slug=summary.slug,
        title=summary.title,
        label=summary.label,
        subtitle=summary.subtitle,
        accent=summary.accent,
        pages=summary.pages,
        count=summary.count,
        pdf=topic.get("pdf", ""),
        questions=nav,
    )


def _inject_sizes(body: str) -> str:
    if "<img" not in body:
        return body

    def fix(match: re.Match[str]) -> str:
        tag = match.group(0)
        source = _SRC.search(tag)
        if not source:
            return tag
        dims = dimensions_of_src(source.group(1) or source.group(2) or "")
        if dims is None:
            return tag
        cleaned = _SIZE_ATTR.sub("", tag)
        closing = "/>" if cleaned.endswith("/>") else ">"
        head = cleaned[: -len(closing)].rstrip()
        return f'{head} width="{dims[0]}" height="{dims[1]}"{closing}'

    return _IMG.sub(fix, body)


def _evidence(question: dict[str, Any]) -> list[EvidenceGroup]:
    groups: list[EvidenceGroup] = []
    for group in question.get("evidence", []):
        files = []
        for file in group.get("files", []):
            dims = dimensions_of_src(unquote(file["file"]))
            files.append(
                EvidenceFile(
                    page=file["page"],
                    file=file["file"],
                    width=dims[0] if dims else file.get("width"),
                    height=dims[1] if dims else file.get("height"),
                )
            )
        groups.append(
            EvidenceGroup.model_validate(
                {
                    "label": group["label"],
                    "from": group["from"],
                    "to": group["to"],
                    "files": files,
                }
            )
        )
    return groups


def get_question(topic_id: str, qid: str) -> QuestionDetail:
    topic = repository.load_topic(topic_id)
    if topic is None:
        raise AppError("专题不存在", code="not_found", status=404)
    questions = topic["questions"]
    index = next((i for i, item in enumerate(questions) if item["id"] == qid), -1)
    if index < 0:
        raise AppError("题目不存在", code="not_found", status=404)
    question = questions[index]
    answer = _inject_sizes(highlight_answer(question.get("answer", "")))

    def nav_of(offset: int) -> QuestionNav | None:
        position = index + offset
        if position < 0 or position >= len(questions):
            return None
        item = questions[position]
        return QuestionNav(
            id=item["id"],
            no=item["no"],
            title=item["title"],
            aliases=item.get("aliases", []),
        )

    return QuestionDetail(
        id=question["id"],
        no=question["no"],
        title=question["title"],
        aliases=question.get("aliases", []),
        summary=question.get("summary", []),
        note=question.get("note", ""),
        pages=question.get("pages", ""),
        first_page=question.get("firstPage", 1),
        answer=answer,
        evidence=_evidence(question),
        topic=_summary(topic),
        prev=nav_of(-1),
        next=nav_of(1),
    )


def first_question(topic_id: str) -> str:
    topic = repository.load_topic(topic_id)
    if topic is None:
        raise AppError("专题不存在", code="not_found", status=404)
    questions = topic.get("questions", [])
    return questions[0]["id"] if questions else ""
