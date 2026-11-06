"""复习业务：把 Anki 调度结果与站点题库内容拼在一起。"""

from __future__ import annotations

from typing import Any

from app.features.review import analytics, collection, deck_config, schedule
from app.features.review.schemas import (
    AnswerPayload,
    AnswerResult,
    CardAnswer,
    Lapse,
    LapseList,
    ReviewBackup,
    ReviewCard,
    ReviewConfig,
    ReviewConfigUpdate,
    ReviewCounts,
    ReviewDay,
    ReviewProgress,
    ReviewQuestion,
    ReviewQueue,
    ReviewStats,
    SyncResult,
    UndoResult,
)
from app.features.study import service as study_service


def _enrich(raw: dict[str, Any]) -> ReviewCard:
    qid = str(raw.get("qid", ""))
    topic_id, _, question_id = qid.partition("/")
    question: ReviewQuestion | None = None
    topic = study_service.topic_document(topic_id) if topic_id else None
    if topic is not None:
        found = next((item for item in topic["questions"] if item["id"] == question_id), None)
        if found is not None:
            question = ReviewQuestion(
                title=found["title"],
                aliases=found.get("aliases") or [],
                summary=found.get("summary") or [],
                note=found.get("note", ""),
                pages=found.get("pages", ""),
                topic=topic["label"],
                topic_id=topic["id"],
                has_answer=bool(found.get("answer")),
            )
    return ReviewCard(
        card_id=int(raw["card_id"]),
        qid=qid,
        state=str(raw["state"]),
        labels=list(raw["labels"]),
        question=question,
    )


def queue(limit: int = 1) -> ReviewQueue:
    raw = schedule.queue_view(max(1, min(limit, 20)))
    return ReviewQueue(
        cards=[_enrich(card) for card in raw["cards"]],
        counts=ReviewCounts(**raw["counts"]),
        due_total=raw["due_total"],
    )


def answer(payload: AnswerPayload) -> AnswerResult:
    raw = schedule.answer(payload.card_id, payload.rating)
    analytics.invalidate_history()
    return AnswerResult(
        counts=ReviewCounts(**raw["counts"]),
        due_total=raw["due_total"],
        progress=ReviewProgress(**raw["progress"]),
        next=_enrich(raw["next"]) if raw["next"] else None,
    )


def undo() -> UndoResult:
    raw = schedule.undo()
    analytics.invalidate_history()
    return UndoResult(
        counts=ReviewCounts(**raw["counts"]),
        due_total=raw["due_total"],
        progress=ReviewProgress(**raw["progress"]),
    )


def card_answer(qid: str) -> CardAnswer:
    topic_id, _, question_id = qid.partition("/")
    detail = study_service.get_question(topic_id, question_id)
    return CardAnswer(answer_html=detail.answer)


def _marks(ids: list[int]) -> str:
    return ",".join("?" * len(ids))


def stats() -> ReviewStats:
    with collection.LOCK:
        days, total_reviews, total_answers, streak = analytics.history()
        today, today_new, today_review, today_relearn = analytics.today_card_counts()
        config = deck_config.get_config()
        ids = collection.deck_ids()
        marks = _marks(ids)
        col = collection.instance()
        db = collection.db()
        total_cards = int(
            db.scalar(f"select count(*) from cards where did in ({marks})", *ids) or 0
        )
        learned_cards = int(
            db.scalar(f"select count(*) from cards where did in ({marks}) and type != 0", *ids) or 0
        )
        new_remaining = analytics.new_remaining()
        tomorrow_start = int(col.sched.day_cutoff)
        due_tomorrow = int(
            db.scalar(
                "select count(*) from cards where queue >= 0 "
                f"and did in ({marks}) and ("
                "(type = 2 and due = ?) or "
                "(type in (1, 3) and queue = 1 and due >= ? and due < ?) or "
                "(type in (1, 3) and queue = 3 and due = ?))",
                *ids,
                analytics.today_seq() + 1,
                tomorrow_start,
                tomorrow_start + 86400,
                analytics.today_seq() + 1,
            )
            or 0
        )
        backup = analytics.last_backup()
        return ReviewStats(
            counts=ReviewCounts(**schedule.counts()),
            due_total=analytics.due_total(),
            today=today,
            today_new=today_new,
            today_review=today_review,
            today_relearn=today_relearn,
            new_per_day=config["new_per_day"],
            rev_per_day=config["rev_per_day"],
            streak=streak,
            total_reviews=total_reviews,
            total_answers=total_answers,
            total_cards=total_cards,
            learned_cards=min(learned_cards, total_cards),
            due_tomorrow=due_tomorrow,
            next_due_epoch=analytics.next_due_epoch(),
            can_undo=schedule.can_undo(),
            new_remaining=new_remaining,
            last_backup=ReviewBackup(**backup) if backup else None,
            days=[ReviewDay(**row) for row in days],
        )


def lapses() -> LapseList:
    items: list[Lapse] = []
    for item in analytics.recent_lapses():
        qid = str(item["qid"])
        topic_id, _, question_id = qid.partition("/")
        topic = study_service.topic_document(topic_id) if topic_id else None
        found = None
        if topic is not None:
            found = next((q for q in topic["questions"] if q["id"] == question_id), None)
        items.append(
            Lapse(
                qid=qid,
                card_id=item["card_id"],
                topic_id=topic_id,
                question_id=question_id,
                title=found["title"] if found else qid,
                topic=topic["label"] if topic else "",
            )
        )
    return LapseList(items=items)


def config() -> ReviewConfig:
    return ReviewConfig(**deck_config.get_config())


def update_config(payload: ReviewConfigUpdate) -> ReviewConfig:
    return ReviewConfig(**deck_config.set_config(payload.new_per_day, payload.rev_per_day))


def sync() -> SyncResult:
    result = collection.snapshot("manual", force=True)
    if result is None:
        return SyncResult(status="failed", backup=None, message="快照失败，请检查服务日志")
    snap, reused = result
    ok, message = collection.git_sync("手动同步")
    prefix = f"无改动，沿用最近快照 {snap.name}" if reused else f"已快照 {snap.name}"
    if not ok:
        return SyncResult(
            status="partial",
            backup=snap.name,
            message=f"{prefix}，但 git 同步失败：{message}",
        )
    return SyncResult(status="ok", backup=snap.name, message=f"{prefix}；git：{message}")
