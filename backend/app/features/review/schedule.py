"""复习调度：取卡、评分、撤销。

调度状态缓存在进程内存，浏览器只回传 card_id + rating，
避免把 Anki 的调度对象序列化到前端。
"""

from __future__ import annotations

import secrets
import time
from typing import Any, cast

from anki import scheduler_pb2
from anki.cards import CardId
from anki.utils import int_time

from app.core.errors import AppError
from app.features.review import analytics, collection

MAX_STATES = 64
PENDING_TTL = 30 * 60
UNDO_TTL = 10 * 60
STATE_NAMES = {0: "new", 1: "learning", 2: "review", 3: "relearning"}

# card_id -> (各评分对应的状态, 首次展示时间, 过期时间)
_pending: dict[int, tuple[Any, float, float]] = {}
# 全局唯一的「可撤销评分」：Anki 的撤销栈是全局的，
# 只要中间发生过任何写操作（评分/埋藏/标记/改配置），旧凭证就必须作废，
# 否则撤销的会是别人的操作。
_active_undo: dict[str, Any] | None = None
BURY_MODES = {
    "bury": scheduler_pb2.BuryOrSuspendCardsRequest.BURY_USER,
    "suspend": scheduler_pb2.BuryOrSuspendCardsRequest.SUSPEND,
}


def _clean_label(text: str) -> str:
    return text.replace("\u2068", "").replace("\u2069", "")


def _prune() -> None:
    now = time.time()
    for key, (_, _, expires_at) in list(_pending.items()):
        if now > expires_at:
            _pending.pop(key, None)


def counts() -> dict[str, int]:
    with collection.LOCK:
        new, learning, review = collection.instance().sched.counts()
        return {"new": new, "learning": learning, "review": review}


def _clear_undo() -> None:
    global _active_undo
    _active_undo = None


def _valid_undo_token(client_id: str = "") -> str | None:
    record = _active_undo
    if not record or record["client_id"] != client_id:
        return None
    if time.time() - float(record["at"]) > UNDO_TTL:
        _clear_undo()
        return None
    with collection.LOCK:
        try:
            if not collection.instance().undo_status().undo:
                return None
        except Exception:  # noqa: BLE001
            return None
    return str(record["token"])


def clear_undo() -> None:
    """外部写操作（如修改每日额度）后调用，避免撤销到别的操作。"""
    _clear_undo()


def undo_token(client_id: str = "") -> str | None:
    return _valid_undo_token(client_id)


def can_undo(client_id: str = "") -> bool:
    return _valid_undo_token(client_id) is not None


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
            now = time.time()
            _pending[queued_card.card.id] = (queued_card.states, now, now + PENDING_TTL)
            if len(_pending) > MAX_STATES:
                for key in sorted(_pending, key=lambda k: _pending[k][1])[:-MAX_STATES]:
                    _pending.pop(key, None)
            items.append(
                {
                    "card_id": queued_card.card.id,
                    "qid": note["QID"],
                    "state": STATE_NAMES.get(queued_card.card.ctype, "unknown"),
                    "labels": labels,
                    # 队列里的 card 是 protobuf 快照，没有 user_flag，要回库读。
                    "flag": int(col.get_card(queued_card.card.id).user_flag() or 0),
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


def touch(card_id: int) -> dict[str, Any]:
    """显示答案时续期，避免「思考超过 30 分钟」在评分前过期。"""
    with collection.LOCK:
        cached = _pending.get(card_id)
        if not cached:
            raise AppError(
                "这张卡已被其他标签页处理或服务已重启，请重新取卡",
                code="card_not_pending",
                status=409,
            )
        states, shown_at, _ = cached
        _pending[card_id] = (states, shown_at, time.time() + PENDING_TTL)
    return {"ok": True}


def answer(card_id: int, rating: int, client_id: str = "") -> dict[str, Any]:
    global _active_undo
    if rating not in (1, 2, 3, 4):
        raise AppError("rating 必须是 1-4", code="invalid_params", status=400)
    with collection.LOCK:
        cached = _pending.get(card_id)
        if not cached:
            raise AppError(
                "这张卡已被其他标签页处理或服务已重启，请重新取卡",
                code="card_not_pending",
                status=409,
            )
        states, shown_at, expires_at = cached
        if time.time() > expires_at:
            _pending.pop(card_id, None)
            raise AppError(
                "思考时间超过 30 分钟，这张卡已重新排队，请重新取卡",
                code="stale_card",
                status=409,
            )
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
        token = secrets.token_urlsafe(18)
        _active_undo = {
            "token": token,
            "client_id": client_id,
            "card_id": card_id,
            "at": time.time(),
        }
        collection.mark_dirty()
        following = queue_view(1)
        return {
            "counts": following["counts"],
            "due_total": following["due_total"],
            "progress": progress(client_id),
            "next": following["cards"][0] if following["cards"] else None,
            "undo_token": token,
        }


def undo(token: str, client_id: str = "") -> dict[str, Any]:
    global _active_undo
    with collection.LOCK:
        expected = _valid_undo_token(client_id)
        if not expected or token != expected:
            raise AppError(
                "这次撤销已失效：只能撤销本标签页最近一次评分，且需在 10 分钟内",
                code="undo_expired",
                status=409,
            )
        record = _active_undo or {}
        card_id = int(record.get("card_id") or 0)
        collection.instance().undo()
        _active_undo = None
        # 只让被撤销的卡重新排队，其他标签页已取到的卡仍然有效。
        if card_id:
            _pending.pop(card_id, None)
        collection.mark_dirty()
        return {
            "counts": counts(),
            "due_total": analytics.due_total(),
            "progress": progress(client_id),
        }


def card_action(
    card_id: int, action: str, client_id: str = "", flag: int | None = None
) -> dict[str, Any]:
    """埋藏、暂停或标记当前卡，然后直接给出下一张。"""
    if action == "flag":
        if flag is None or flag < 0 or flag > 7:
            raise AppError("flag 必须是 0-7", code="invalid_params", status=400)
    elif action not in BURY_MODES:
        raise AppError("不支持的卡片操作", code="invalid_params", status=400)
    with collection.LOCK:
        col = collection.instance()
        # 任何写操作都会让 Anki 的全局撤销栈指向它，旧评分不能再撤销。
        _clear_undo()
        if action == "flag":
            col.set_user_flag_for_cards(flag or 0, [CardId(card_id)])
            collection.mark_dirty()
            # 标记不改变到期时间，不要重新取卡，否则会丢掉已显示的答案、重置计时。
            return {
                "counts": counts(),
                "due_total": analytics.due_total(),
                "progress": progress(client_id),
                "next": None,
            }
        col._backend.bury_or_suspend_cards(card_ids=[card_id], note_ids=[], mode=BURY_MODES[action])
        _pending.pop(card_id, None)
        collection.mark_dirty()
        following = queue_view(1)
        return {
            "counts": following["counts"],
            "due_total": following["due_total"],
            "progress": progress(client_id),
            "next": following["cards"][0] if following["cards"] else None,
        }


def progress(client_id: str = "") -> dict[str, Any]:
    """评分后立即回传的轻量进度，前端不必再请求一次统计。"""
    cards_today, new_today, review_today, relearn_today = analytics.today_card_counts()
    token = _valid_undo_token(client_id)
    return {
        "today": cards_today,
        "today_new": new_today,
        "today_review": review_today,
        "today_relearn": relearn_today,
        "new_remaining": analytics.new_remaining(),
        "can_undo": token is not None,
        "undo_token": token,
    }
