"""题库接口的输出契约。"""

from __future__ import annotations

from typing import Literal

from app.core.pagination import ApiModel


class TopicMeta(ApiModel):
    title: str
    subtitle: str
    pages: int
    topics: int
    count: int


class QuestionNav(ApiModel):
    id: str
    no: int
    title: str
    aliases: list[str]


class TopicSummary(ApiModel):
    id: str
    no: str
    slug: str
    title: str
    label: str
    subtitle: str
    accent: str
    pages: int
    count: int
    first_qid: str


class StudyIndexResponse(ApiModel):
    meta: TopicMeta
    topics: list[TopicSummary]


class TopicDetail(ApiModel):
    id: str
    no: str
    slug: str
    title: str
    label: str
    subtitle: str
    accent: str
    pages: int
    count: int
    pdf: str
    questions: list[QuestionNav]


class NoteFile(ApiModel):
    file: str
    width: int | None = None
    height: int | None = None


class Note(ApiModel):
    label: str
    kind: Literal["images", "markdown"]
    files: list[NoteFile]
    html: str = ""


class QuestionDetail(ApiModel):
    id: str
    no: int
    title: str
    aliases: list[str]
    summary: list[str]
    note: str
    answer: str
    notes: list[Note]
    topic: TopicSummary
    prev: QuestionNav | None = None
    next: QuestionNav | None = None
