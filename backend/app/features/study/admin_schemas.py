"""后台题库编辑的输入输出契约。"""

from __future__ import annotations

from pydantic import Field

from app.core.pagination import ApiModel


class BankTopicOption(ApiModel):
    id: str
    no: str
    label: str
    title: str
    slug: str
    count: int


class BankQuestionRow(ApiModel):
    key: str
    topic_id: str
    topic_label: str
    id: str
    no: int
    title: str
    pages: str


class BankListResponse(ApiModel):
    topics: list[BankTopicOption]
    questions: list[BankQuestionRow]
    total: int
    limited: bool


class AdminEvidenceFile(ApiModel):
    page: int
    file: str
    width: int | None = None
    height: int | None = None


class AdminEvidenceGroup(ApiModel):
    label: str
    from_page: int = Field(alias="from")
    to: int
    files: list[AdminEvidenceFile]


class AdminQuestion(ApiModel):
    topic_id: str
    topic_label: str
    topic_slug: str
    id: str
    no: int
    key: str
    title: str
    aliases: list[str]
    summary: list[str]
    note: str
    pages: str
    first_page: int
    answer: str
    evidence: list[AdminEvidenceGroup]


class EvidenceFileInput(ApiModel):
    page: int
    file: str


class EvidenceGroupInput(ApiModel):
    label: str = ""
    from_page: int = Field(default=1, alias="from")
    to: int = 1
    files: list[EvidenceFileInput] = Field(default_factory=list)


class QuestionWrite(ApiModel):
    title: str
    aliases: list[str] = Field(default_factory=list)
    summary: list[str] = Field(default_factory=list)
    note: str = ""
    pages: str = ""
    first_page: int | None = None
    answer: str = ""
    evidence: list[EvidenceGroupInput] = Field(default_factory=list)


class CreateQuestionRequest(QuestionWrite):
    topic_id: str


class QuestionMutationResponse(ApiModel):
    question: AdminQuestion
    card_synced: bool
    notice: str = ""


class DeleteQuestionResponse(ApiModel):
    ok: bool = True
    card_deleted: bool
    reindexed: int


class EvidenceUploadResponse(ApiModel):
    file: str
    width: int
    height: int
