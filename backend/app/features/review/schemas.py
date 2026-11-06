"""复习接口的数据形状（Pydantic → camelCase）。"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.core.pagination import ApiModel


class ReviewCounts(ApiModel):
    new: int
    learning: int
    review: int


class ReviewQuestion(ApiModel):
    title: str
    aliases: list[str]
    summary: list[str]
    note: str
    pages: str
    topic: str
    topic_id: str
    has_answer: bool


class ReviewCard(ApiModel):
    card_id: int
    qid: str
    state: str
    labels: list[str]
    question: ReviewQuestion | None = None


class ReviewQueue(ApiModel):
    cards: list[ReviewCard]
    counts: ReviewCounts
    due_total: int


class ReviewProgress(ApiModel):
    today: int
    today_new: int
    today_review: int
    today_relearn: int
    new_remaining: int
    can_undo: bool


class AnswerResult(ApiModel):
    counts: ReviewCounts
    due_total: int
    progress: ReviewProgress
    next: ReviewCard | None


class UndoResult(ApiModel):
    counts: ReviewCounts
    due_total: int
    progress: ReviewProgress


class CardAnswer(ApiModel):
    answer_html: str


class ReviewDay(ApiModel):
    date: str
    count: int


class ReviewBackup(ApiModel):
    name: str
    size: int
    at: int
    count: int


class ReviewStats(ApiModel):
    counts: ReviewCounts
    due_total: int
    today: int
    today_new: int
    today_review: int
    today_relearn: int
    new_per_day: int
    rev_per_day: int
    streak: int
    total_reviews: int
    total_answers: int
    total_cards: int
    learned_cards: int
    due_tomorrow: int
    next_due_epoch: int | None
    can_undo: bool
    new_remaining: int
    last_backup: ReviewBackup | None
    days: list[ReviewDay]


class ReviewConfig(ApiModel):
    deck: str
    new_per_day: int
    rev_per_day: int
    learning_steps: list[int] | None
    fsrs_enabled: bool
    new_order: int | None


class ReviewConfigUpdate(ApiModel):
    new_per_day: int | None = Field(default=None, ge=0, le=9999)
    rev_per_day: int | None = Field(default=None, ge=0, le=9999)


class AnswerPayload(ApiModel):
    card_id: int
    rating: int = Field(ge=1, le=4)


class Lapse(ApiModel):
    qid: str
    card_id: int
    topic_id: str
    question_id: str
    title: str
    topic: str


class LapseList(ApiModel):
    items: list[Lapse]


class SyncResult(ApiModel):
    status: Literal["ok", "partial", "failed"]
    backup: str | None
    message: str
