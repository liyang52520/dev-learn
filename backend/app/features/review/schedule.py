"""复习调度：取卡、评分、撤销。

调度状态缓存在进程内存，浏览器只回传 card_id + rating，
避免把 Anki 的调度对象序列化到前端。
"""

from __future__ import annotations

import time
from typing import Any, cast

from anki import scheduler_pb2
from anki.utils import int_time

from app.core.errors import AppError
from app.features.review import analytics, collection

MAX_STATES = 64
PENDING_TTL = 30 * 60
STATE_NAMES = {0: "new", 1: "learning", 2: "review", 3: "relearning"}

_pending: dict[int, tuple[Any, float]] = {}


def _clean_label(text: str) -> str:
    return text.replace("\u2068", "").replace("\u2069", "")


def _prune() -> None:
    now = time.time()
    for key, (_, shown_at) in list(_pending.items()):
        if now - shown_at > PENDING_TTL:
            _pending.pop(key, None)


def counts() -> dict[str, int]:
    with collection.LOCK:
        new, learning, review = collection.instance().sched.counts()
        return {"new": new, "learning": learning, "review": review}


def can_undo() -> bool:
    with collection.LOCK:
        try:
            return bool(collection.instance().undo_status().undo)
        except Exception:  # noqa: BLE001
            return False


def queue_view(limit: int = 1) -> dict[str, Any]:
    with collection.LOCK:
        col = collection.instance()
        sched = cast(Any, col.sched)
        collection.deck()
        _prune()
        queued = sched.get_queued_cards(fetch_limit=limit)
        items: list[dict[str, Any]] = []
        for queued_card in queued.cards:
            note = col.get_note(queued_card.card.note_id)
            labels = [_clean_label(text) for text in sched.describe_next_states(queued_card.states)]
            _pending[queued_card.card.id] = (queued_card.states, time.time())
            if len(_pending) > MAX_STATES:
                for key in sorted(_pending, key=lambda k: _pending[k][1])[:-MAX_STATES]:
                    _pending.pop(key, None)
            items.append(
                {
                    "card_id": queued_card.card.id,
                    "qid": note["QID"],
                    "state": STATE_NAMES.get(queued_card.card.ctype, "unknown"),
                    "labels": labels,
                }
            )
        return {
            "cards": items,
            "counts": {
                "new": queued.new_count,
                "learning": queued.learning_count,
                "review": queued.review_count,
            },
            "due_total": analytics.due_total(),
        }


def answer(card_id: int, rating: int) -> dict[str, Any]:
    if rating not in (1, 2, 3, 4):
        raise AppError("rating 必须是 1-4", code="invalid_params", status=400)
    with collection.LOCK:
        cached = _pending.get(card_id)
        if not cached or time.time() - cached[1] > PENDING_TTL:
            _pending.pop(card_id, None)
            raise AppError("这张卡的调度状态已过期，请重新取卡", code="stale_card", status=409)
        states, shown_at = cached
        new_state = {1: states.again, 2: states.hard, 3: states.good, 4: states.easy}[rating]
        elapsed = int((time.time() - shown_at) * 1000)
        sched = cast(Any, collection.instance().sched)
        sched.answer_card(
            scheduler_pb2.CardAnswer(
                card_id=card_id,
                current_state=states.current,
                new_state=new_state,
                # CardAnswer.rating 从 0 开始（AGAIN=0…EASY=3），站点传 1-4，必须减一。
                rating=cast(Any, rating - 1),
                answered_at_millis=int_time(1000),
                milliseconds_taken=max(0, min(elapsed, 120_000)),
            )
        )
        _pending.pop(card_id, None)
        collection.mark_dirty()
        following = queue_view(1)
        return {
            "counts": following["counts"],
            "due_total": following["due_total"],
            "progress": progress(),
            "next": following["cards"][0] if following["cards"] else None,
        }


def undo() -> dict[str, Any]:
    with collection.LOCK:
        if not collection.instance().undo_status().undo:
            raise AppError("没有可撤销的操作", code="conflict", status=409)
        collection.instance().undo()
        _pending.clear()
        collection.mark_dirty()
        return {"counts": counts(), "due_total": analytics.due_total(), "progress": progress()}


def progress() -> dict[str, Any]:
    """评分后立即回传的轻量进度，前端不必再请求一次统计。"""
    cards_today, new_today, review_today, relearn_today = analytics.today_card_counts()
    return {
        "today": cards_today,
        "today_new": new_today,
        "today_review": review_today,
        "today_relearn": relearn_today,
        "new_remaining": analytics.new_remaining(),
        "can_undo": can_undo(),
    }
