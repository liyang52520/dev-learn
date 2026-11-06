"""复习统计：热力图、连续天数、到期量与最近答错。

全部按当前 deck（含子 deck）过滤；revlog 用 id 截断走主键索引，不做全表扫。
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Any

from anki.cards import CardId

from app.features.review import collection, deck_config

DAY_SHIFT = "-4 hours"  # Anki 凌晨 4 点换日，SQL 取本地日期前先减 4 小时
HISTORY_TTL = 30
_history: dict[str, Any] = {
    "at": 0.0,
    "deck": None,
    "days": [],
    "reviews": 0,
    "answers": 0,
    "streak": 0,
}


def _placeholders(ids: list[int]) -> str:
    return ",".join("?" * len(ids))


def invalidate_history() -> None:
    """评分/撤销后立即让累计与热力图缓存失效。"""
    _history["at"] = 0.0
    _history["deck"] = None


def today_seq() -> int:
    return int(collection.instance().sched.today)


def day_start_ms() -> int:
    return int(collection.instance().sched.day_cutoff - 86400) * 1000


def day_rows(days: int = 183) -> list[dict[str, Any]]:
    ids = collection.deck_ids()
    cutoff = int((time.time() - days * 86400) * 1000)
    rows = collection.db().all(
        "select date(r.id / 1000, 'unixepoch', 'localtime', ?) as d, count(distinct r.cid) "
        "from revlog r join cards c on c.id = r.cid "
        f"where r.id >= ? and c.did in ({_placeholders(ids)}) group by d order by d",
        DAY_SHIFT,
        cutoff,
        *ids,
    )
    return [{"date": str(day), "count": int(count)} for day, count in rows]


def history() -> tuple[list[dict[str, Any]], int, int, int]:
    ids = collection.deck_ids()
    key = tuple(ids)
    now = time.time()
    if _history["deck"] == key and now - _history["at"] < HISTORY_TTL:
        return _history["days"], _history["reviews"], _history["answers"], _history["streak"]

    rows = day_rows(183)
    db = collection.db()
    marks = _placeholders(ids)
    total_reviews = int(
        db.scalar(
            "select count(*) from revlog r join cards c on c.id = r.cid "
            f"where r.type in (1, 2) and c.did in ({marks})",
            *ids,
        )
        or 0
    )
    total_answers = int(
        db.scalar(
            f"select count(*) from revlog r join cards c on c.id = r.cid where c.did in ({marks})",
            *ids,
        )
        or 0
    )
    active_rows = db.all(
        "select distinct date(r.id / 1000, 'unixepoch', 'localtime', ?) as d "
        "from revlog r join cards c on c.id = r.cid "
        f"where c.did in ({marks})",
        DAY_SHIFT,
        *ids,
    )
    active = {str(day) for (day,) in active_rows}
    cursor = (datetime.now() - timedelta(hours=4)).date()
    if cursor.isoformat() not in active:
        cursor -= timedelta(days=1)
    streak = 0
    while cursor.isoformat() in active:
        streak += 1
        cursor -= timedelta(days=1)

    _history.update(
        at=now,
        deck=key,
        days=rows,
        reviews=total_reviews,
        answers=total_answers,
        streak=streak,
    )
    return rows, total_reviews, total_answers, streak


def due_total() -> int:
    """真正到期、未被日限额截断的卡数（含学习中，不含新卡）。

    queue=1 的 learning 卡 due 是时间戳，queue=3 的跨日 learning 卡 due 是
    天序号；两者必须分开比较，否则会把未来卡算成现在到期。
    """
    ids = collection.deck_ids()
    row = collection.db().scalar(
        "select count(*) from cards where queue >= 0 "
        f"and did in ({_placeholders(ids)}) and ("
        "(type in (1, 3) and ((queue = 3 and due <= ?) or (queue <> 3 and due <= ?))) "
        "or (type = 2 and due <= ?))",
        *ids,
        today_seq(),
        int(time.time()),
        today_seq(),
    )
    return int(row or 0)


def today_card_counts() -> tuple[int, int, int, int]:
    """今日学过 / 新学 / 复习 / 重学（按卡去重）。

    总数单独按卡去重，不能把三类相加：同一张卡当天先复习、后遗忘重学，
    会在 review 与 relearn 里各出现一次。
    """
    ids = collection.deck_ids()
    marks = _placeholders(ids)
    start = day_start_ms()
    db = collection.db()
    total_today = int(
        db.scalar(
            "select count(distinct r.cid) from revlog r join cards c on c.id = r.cid "
            f"where r.id >= ? and c.did in ({marks})",
            start,
            *ids,
        )
        or 0
    )
    new_today = int(
        db.scalar(
            "select count(distinct r.cid) from revlog r join cards c on c.id = r.cid "
            f"where r.type = 0 and r.id >= ? and c.did in ({marks})",
            start,
            *ids,
        )
        or 0
    )
    review_today = int(
        db.scalar(
            "select count(distinct r.cid) from revlog r join cards c on c.id = r.cid "
            f"where r.type = 1 and r.id >= ? and c.did in ({marks}) "
            "and r.cid not in (select cid from revlog where type = 0 and id >= ?)",
            start,
            *ids,
            start,
        )
        or 0
    )
    relearn_today = int(
        db.scalar(
            "select count(distinct r.cid) from revlog r join cards c on c.id = r.cid "
            f"where r.type = 2 and r.id >= ? and c.did in ({marks})",
            start,
            *ids,
        )
        or 0
    )
    return total_today, new_today, review_today, relearn_today


def next_rollover_epoch() -> int:
    return int(collection.instance().sched.day_cutoff)


def next_due_epoch() -> int | None:
    """下一张卡真正可以学的时间点（把日限额算进来）。"""
    ids = collection.deck_ids()
    marks = _placeholders(ids)
    today = today_seq()
    now = int(time.time())
    rollover = next_rollover_epoch()
    cfg = deck_config.get_config()
    _, new_today, review_today, _ = today_card_counts()
    review_blocked = cfg["rev_per_day"] <= 0 or review_today >= cfg["rev_per_day"]
    new_blocked = cfg["new_per_day"] <= 0 or new_today >= cfg["new_per_day"] or review_blocked

    db = collection.db()
    candidates: list[int] = []
    learning_now = db.scalar(
        f"select min(due) from cards where queue = 1 and did in ({marks}) and type in (1, 3)",
        *ids,
    )
    if learning_now:
        candidates.append(int(learning_now))
    learning_day = db.scalar(
        f"select min(due) from cards where queue = 3 and did in ({marks}) and type in (1, 3)",
        *ids,
    )
    if learning_day is not None:
        due_day = int(learning_day)
        if due_day <= today:
            candidates.append(now)
        else:
            candidates.append(rollover + (due_day - today - 1) * 86400)
    review_day = db.scalar(
        f"select min(due) from cards where queue >= 0 and did in ({marks}) and type = 2",
        *ids,
    )
    if review_day is not None:
        due_day = int(review_day)
        if due_day <= today:
            candidates.append(rollover if review_blocked else now)
        else:
            candidates.append(rollover + (due_day - today - 1) * 86400)
    new_left = db.scalar(
        f"select count(*) from cards where queue >= 0 and did in ({marks}) and type = 0",
        *ids,
    )
    if int(new_left or 0):
        candidates.append(rollover if new_blocked else now)
    if not candidates:
        return None
    return max(now, min(candidates))


def new_remaining() -> int:
    ids = collection.deck_ids()
    value = collection.db().scalar(
        "select count(*) from cards where type = 0 and queue >= 0 "
        f"and did in ({_placeholders(ids)})",
        *ids,
    )
    return int(value or 0)


def recent_lapses(limit: int = 6) -> list[dict[str, Any]]:
    ids = collection.deck_ids()
    col = collection.instance()
    db = collection.db()
    cutoff = int((time.time() - 90 * 86400) * 1000)
    rows = db.all(
        "select r.cid, max(r.id) as last from revlog r join cards c on c.id = r.cid "
        f"where r.ease = 1 and r.id >= ? and c.did in ({_placeholders(ids)}) "
        "group by r.cid order by last desc limit ?",
        cutoff,
        *ids,
        max(1, min(limit, 20)),
    )
    items: list[dict[str, Any]] = []
    for cid, _ in rows:
        try:
            card = col.get_card(CardId(int(cid)))
            note = col.get_note(card.nid)
            qid = note["QID"]
        except Exception:  # noqa: BLE001 - 单张卡读不到就跳过
            continue
        items.append({"qid": qid, "card_id": int(cid)})
    return items


def last_backup() -> dict[str, Any] | None:
    # 新快照是 Anki 的 .colpkg；保留对旧 .anki2 快照的识别，方便平滑过渡。
    files = sorted(
        [
            *collection.backup_dir().glob("*.colpkg"),
            *collection.backup_dir().glob("collection-*.anki2"),
        ],
        key=lambda path: path.stat().st_mtime,
    )
    if not files:
        return None
    latest = files[-1]
    stat = latest.stat()
    return {
        "name": latest.name,
        "size": stat.st_size,
        "at": int(stat.st_mtime),
        "count": len(files),
    }
