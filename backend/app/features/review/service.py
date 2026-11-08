"""复习业务：把 Anki 调度结果与站点题库内容拼在一起。"""

from __future__ import annotations

from typing import Any

from app.features.review import analytics, collection, daytime, deck_config, history, schedule
from app.features.review.schemas import (
    AnswerPayload,
    AnswerResult,
    CardActionPayload,
    CardActionResult,
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
    TouchPayload,
    TouchResult,
    UndoPayload,
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
        flag=int(raw.get("flag") or 0),
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
    raw = schedule.answer(payload.card_id, payload.rating, payload.client_id)
    history.invalidate()
    return AnswerResult(
        counts=ReviewCounts(**raw["counts"]),
        due_total=raw["due_total"],
        progress=ReviewProgress(**raw["progress"]),
        next=_enrich(raw["next"]) if raw["next"] else None,
        undo_token=str(raw["undo_token"]),
    )


def touch(payload: TouchPayload) -> TouchResult:
    return TouchResult(**schedule.touch(payload.card_id))


def undo(payload: UndoPayload) -> UndoResult:
    raw = schedule.undo(payload.token, payload.client_id)
    history.invalidate(full=True)
    return UndoResult(
        counts=ReviewCounts(**raw["counts"]),
        due_total=raw["due_total"],
        progress=ReviewProgress(**raw["progress"]),
    )


def card_action(payload: CardActionPayload) -> CardActionResult:
    raw = schedule.card_action(payload.card_id, payload.action, payload.client_id, payload.flag)
    return CardActionResult(
        counts=ReviewCounts(**raw["counts"]),
        due_total=raw["due_total"],
        progress=ReviewProgress(**raw["progress"]),
        next=_enrich(raw["next"]) if raw["next"] else None,
    )


def card_answer(qid: str) -> CardAnswer:
    topic_id, _, question_id = qid.partition("/")
    detail = study_service.get_question(topic_id, question_id)
    return CardAnswer(answer_html=detail.answer)


def _marks(ids: list[int]) -> str:
    return ",".join("?" * len(ids))


def stats(client_id: str = "") -> ReviewStats:
    with collection.LOCK:
        days, total_reviews, total_answers, streak = history.build()
        today, today_new, today_review, today_relearn = analytics.today_card_counts()
        undo_token = schedule.undo_token(client_id)
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
        due_total = analytics.due_total()
        counts = schedule.counts()
        tomorrow_start = int(col.sched.day_cutoff)
        due_tomorrow = int(
            db.scalar(
                "select count(*) from cards where queue >= 0 "
                f"and did in ({marks}) and ("
                # 到明天结束前应到期的卡：包含已经逾期、今天没清掉的卡。
                "(type = 2 and due <= ?) or "
                "(type in (1, 3) and queue = 1 and due < ?) or "
                "(type in (1, 3) and queue = 3 and due <= ?))",
                *ids,
                daytime.today_seq() + 1,
                tomorrow_start + 86400,
                daytime.today_seq() + 1,
            )
            or 0
        )
        backup = analytics.last_backup()
        return ReviewStats(
            counts=ReviewCounts(**counts),
            due_total=due_total,
            phase=_phase(config, counts, today_new, today_review, due_total, new_remaining),
            today_key=daytime.today_key(),
            today=today,
            today_new=today_new,
            today_review=today_review,
            today_relearn=today_relearn,
            new_per_day=config["new_per_day"],
            rev_per_day=config["rev_per_day"],
            new_paused=config["new_per_day"] <= 0,
            review_paused=config["rev_per_day"] <= 0,
            new_limit_hit=_new_limit_hit(config, today_new, new_remaining),
            review_limit_hit=_review_limit_hit(config, counts, today_review, due_total),
            streak=streak,
            total_reviews=total_reviews,
            total_answers=total_answers,
            total_cards=total_cards,
            learned_cards=min(learned_cards, total_cards),
            due_tomorrow=due_tomorrow,
            next_due_epoch=analytics.next_due_epoch(
                (today, today_new, today_review, today_relearn)
            ),
            can_undo=undo_token is not None,
            undo_token=undo_token,
            new_remaining=new_remaining,
            last_backup=ReviewBackup(**backup) if backup else None,
            days=[ReviewDay(**row) for row in days],
        )


def _review_limit_hit(
    config: dict[str, Any], counts: dict[str, int], today_review: int, due_total: int
) -> bool:
    overflow = max(0, due_total - (counts["learning"] + counts["review"]))
    return config["rev_per_day"] > 0 and today_review >= config["rev_per_day"] and overflow > 0


def _new_limit_hit(config: dict[str, Any], today_new: int, new_remaining: int) -> bool:
    return config["new_per_day"] > 0 and today_new >= config["new_per_day"] and new_remaining > 0


def _phase(
    config: dict[str, Any],
    counts: dict[str, int],
    today_new: int,
    today_review: int,
    due_total: int,
    new_remaining: int,
) -> str:
    """统一学习状态：review / review_quota / new_quota / paused / done。"""
    available = counts["new"] + counts["learning"] + counts["review"]
    if available > 0:
        return "review"
    review_paused = config["rev_per_day"] <= 0
    new_paused = config["new_per_day"] <= 0
    if review_paused and (due_total > 0 or new_remaining > 0):
        return "paused"
    if _review_limit_hit(config, counts, today_review, due_total):
        return "review_quota"
    if new_remaining > 0 and (
        _new_limit_hit(config, today_new, new_remaining)
        or _review_limit_hit(config, counts, today_review, due_total)
    ):
        return "new_quota"
    if new_paused and new_remaining > 0:
        return "paused"
    return "done"


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
    config = deck_config.set_config(payload.new_per_day, payload.rev_per_day)
    # 改额度也是一次写操作，Anki 的撤销栈已经指向它，旧评分凭证必须作废。
    schedule.clear_undo()
    return ReviewConfig(**config)


def prepare_sync() -> str | None:
    """git 提交前生成一致性快照并落盘 WAL；返回快照文件名。"""
    result = collection.snapshot("manual", force=True)
    collection.checkpoint()
    return result[0].name if result else None


def close_for_sync() -> None:
    """git 改写工作区前关闭 collection。"""
    collection.suspend()


def resume_after_sync() -> None:
    """同步结束：清掉可能过期的 WAL / SHM，下次访问时按需重开。"""
    collection.clear_runtime_files()
    collection.resume()


def sync_suspended() -> bool:
    return collection.is_suspended()


def anki_available() -> bool:
    return collection.available()
