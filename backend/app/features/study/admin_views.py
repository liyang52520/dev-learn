"""后台题库编辑的视图组装：列表行、详情 DTO 与 index.json 同步。"""

from __future__ import annotations

from typing import Any
from urllib.parse import unquote

from app.features.study.admin_schemas import (
    AdminEvidenceFile,
    AdminEvidenceGroup,
    AdminQuestion,
    BankTopicOption,
)
from app.rendering.images import dimensions_of_src


def topic_option(topic: dict[str, Any]) -> BankTopicOption:
    return BankTopicOption(
        id=topic["id"],
        no=topic["no"],
        label=topic["label"],
        title=topic["title"],
        slug=topic["slug"],
        count=topic["count"],
    )


def index_question(question: dict[str, Any]) -> dict[str, Any]:
    return {
        "key": question["key"],
        "no": question["no"],
        "id": question["id"],
        "title": question["title"],
        "aliases": question.get("aliases") or [],
        "summary": question.get("summary") or [],
        "note": question.get("note", ""),
        "pages": question.get("pages", ""),
        "firstPage": question.get("firstPage", 1),
        "search": question.get("search", ""),
    }


def refresh_index(index: dict[str, Any], topic: dict[str, Any]) -> None:
    for entry in index["topics"]:
        if entry["id"] != topic["id"]:
            continue
        entry["count"] = topic["count"]
        entry["questions"] = [index_question(question) for question in topic["questions"]]
        break
    index["meta"]["count"] = sum(entry["count"] for entry in index["topics"])


def question_detail(topic: dict[str, Any], question: dict[str, Any]) -> AdminQuestion:
    evidence: list[AdminEvidenceGroup] = []
    for group in question.get("evidence", []):
        files = []
        for file in group.get("files", []):
            dims = dimensions_of_src(unquote(file["file"]))
            files.append(
                AdminEvidenceFile(
                    page=file["page"],
                    file=file["file"],
                    width=dims[0] if dims else None,
                    height=dims[1] if dims else None,
                )
            )
        evidence.append(
            AdminEvidenceGroup.model_validate(
                {"label": group["label"], "from": group["from"], "to": group["to"], "files": files}
            )
        )
    return AdminQuestion(
        topic_id=topic["id"],
        topic_label=topic["label"],
        topic_slug=topic["slug"],
        id=question["id"],
        no=question["no"],
        key=question["key"],
        title=question["title"],
        aliases=question.get("aliases") or [],
        summary=question.get("summary") or [],
        note=question.get("note", ""),
        pages=question.get("pages", ""),
        first_page=question.get("firstPage", 1),
        answer=question.get("answer", ""),
        evidence=evidence,
    )
