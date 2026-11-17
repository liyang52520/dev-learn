"""后台题库编辑的输入输出契约。"""

from __future__ import annotations

from typing import Literal

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


class BankListResponse(ApiModel):
    topics: list[BankTopicOption]
    questions: list[BankQuestionRow]
    total: int
    limited: bool


class AdminNoteFile(ApiModel):
    file: str
    width: int | None = None
    height: int | None = None


class AdminNote(ApiModel):
    label: str
    kind: Literal["images", "markdown"]
    files: list[AdminNoteFile]
    markdown: str = ""


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
    answer: str
    notes: list[AdminNote]


class NoteFileInput(ApiModel):
    file: str


class NoteInput(ApiModel):
    label: str = ""
    kind: Literal["images", "markdown"] = "images"
    files: list[NoteFileInput] = Field(default_factory=list)
    markdown: str = ""


class QuestionWrite(ApiModel):
    title: str
    aliases: list[str] = Field(default_factory=list)
    summary: list[str] = Field(default_factory=list)
    note: str = ""
    answer: str = ""
    notes: list[NoteInput] = Field(default_factory=list)


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


class NoteUploadResponse(ApiModel):
    file: str
    width: int
    height: int
