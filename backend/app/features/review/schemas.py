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
    flag: int = 0
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
    undo_token: str | None = None


class AnswerResult(ApiModel):
    counts: ReviewCounts
    due_total: int
    progress: ReviewProgress
    next: ReviewCard | None
    undo_token: str


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
    phase: str
    today_key: str
    today: int
    today_new: int
    today_review: int
    today_relearn: int
    new_per_day: int
    rev_per_day: int
    new_paused: bool
    review_paused: bool
    new_limit_hit: bool
    review_limit_hit: bool
    streak: int
    total_reviews: int
    total_answers: int
    total_cards: int
    learned_cards: int
    due_tomorrow: int
    next_due_epoch: int | None
    can_undo: bool
    undo_token: str | None
    new_remaining: int
    last_backup: ReviewBackup | None
    days: list[ReviewDay]


class StudyForecastDay(ApiModel):
    date: str
    count: int


class StudyTopicProgress(ApiModel):
    id: str
    title: str
    label: str
    total: int
    learned: int


class StudyOverview(ApiModel):
    """统计页专用的深度指标；与复习页高频调用的 ReviewStats 分开，避免拖慢取卡。"""

    total_time_ms: int
    new_cards: int
    learning_cards: int
    young_cards: int
    mature_cards: int
    avg_interval_days: float
    max_interval_days: int
    active_days: int
    longest_streak: int
    forecast: list[StudyForecastDay]
    topics: list[StudyTopicProgress]


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
    # 标签页标识：撤销凭证按标签页隔离，避免两个标签页互相抢占。
    client_id: str = Field(default="", max_length=64)


class UndoPayload(ApiModel):
    token: str = Field(min_length=1, max_length=200)
    client_id: str = Field(default="", max_length=64)


class CardActionPayload(ApiModel):
    card_id: int
    action: Literal["bury", "suspend", "flag"]
    flag: int | None = Field(default=None, ge=0, le=7)
    client_id: str = Field(default="", max_length=64)


class CardActionResult(ApiModel):
    counts: ReviewCounts
    due_total: int
    progress: ReviewProgress
    next: ReviewCard | None


class TouchPayload(ApiModel):
    card_id: int


class TouchResult(ApiModel):
    ok: bool


class Lapse(ApiModel):
    qid: str
    card_id: int
    topic_id: str
    question_id: str
    title: str
    topic: str


class LapseList(ApiModel):
    items: list[Lapse]
