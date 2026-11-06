"""题库接口的输出契约。"""

from __future__ import annotations

from pydantic import Field

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


class EvidenceFile(ApiModel):
    page: int
    file: str
    width: int | None = None
    height: int | None = None


class EvidenceGroup(ApiModel):
    label: str
    from_page: int = Field(alias="from")
    to: int
    files: list[EvidenceFile]


class QuestionDetail(ApiModel):
    id: str
    no: int
    title: str
    aliases: list[str]
    summary: list[str]
    note: str
    pages: str
    first_page: int
    answer: str
    evidence: list[EvidenceGroup]
    topic: TopicSummary
    prev: QuestionNav | None = None
    next: QuestionNav | None = None
