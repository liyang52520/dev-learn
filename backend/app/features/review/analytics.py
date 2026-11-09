"""复习统计：热力图、连续天数、到期量与最近答错。

全部按当前 deck（含子 deck）过滤；revlog 用 id 截断走主键索引，不做全表扫。
"""

from __future__ import annotations

import time
from typing import Any

from anki.cards import CardId

from app.features.review import collection, daytime, deck_config


def _placeholders(ids: list[int]) -> str:
    return ",".join("?" * len(ids))


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
        daytime.today_seq(),
        int(time.time()),
        daytime.today_seq(),
    )
    return int(row or 0)


def today_card_counts() -> tuple[int, int, int, int]:
    """今日学过 / 新学 / 复习 / 重学（按卡去重）。

    总数单独按卡去重，不能把三类相加：同一张卡当天先复习、后遗忘重学，
    会在 review 与 relearn 里各出现一次。
    """
    ids = collection.deck_ids()
    marks = _placeholders(ids)
    start = daytime.day_start_ms()
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
    return daytime.rollover_epoch()


def next_due_epoch(today_counts: tuple[int, int, int, int] | None = None) -> int | None:
    """下一张卡真正可以学的时间点（把日限额算进来）。"""
    ids = collection.deck_ids()
    marks = _placeholders(ids)
    today = daytime.today_seq()
    now = int(time.time())
    rollover = next_rollover_epoch()
    cfg = deck_config.get_config()
    _, new_today, review_today, _ = today_counts or today_card_counts()
    review_paused = cfg["rev_per_day"] <= 0
    new_paused = cfg["new_per_day"] <= 0
    # 复习额度与新卡共享：新卡首次作答默认也占一份，判断「今天还能不能学」
    # 必须把 new_today 算进去，否则会给出已经过期的时间点。
    shares_review_quota = not cfg.get("new_ignore_review_limit", False)
    review_quota_used = review_today + (new_today if shares_review_quota else 0)
    review_blocked = review_paused or review_quota_used >= cfg["rev_per_day"]
    new_blocked = (
        new_paused or new_today >= cfg["new_per_day"] or (review_blocked and shares_review_quota)
    )

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
    if review_day is not None and not review_paused:
        due_day = int(review_day)
        if due_day <= today:
            candidates.append(rollover if review_blocked else now)
        else:
            candidates.append(rollover + (due_day - today - 1) * 86400)
    new_left = db.scalar(
        f"select count(*) from cards where queue >= 0 and did in ({marks}) and type = 0",
        *ids,
    )
    # 额度为 0 等于暂停，不存在「明天自动恢复」，不要给出误导性的明日时间。
    if int(new_left or 0) and not new_paused and not review_paused:
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
    with collection.LOCK:
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
