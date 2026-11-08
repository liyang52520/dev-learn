"""复习历史统计：热力图、累计作答与连续天数。

全历史只在首次或撤销后算一次，之后按 revlog 主键增量累加，
避免每次打开学习页都扫完整张表。collection 重开后 generation 变化，自动回到全量。
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Any

from app.features.review import collection, daytime

HISTORY_TTL = 30
ACTIVE_DAYS = 400
_history: dict[str, Any] = {
    "at": 0.0,
    "deck": None,
    "gen": -1,
    "day": "",
    "last_id": 0,
    "days": [],
    "reviews": 0,
    "answers": 0,
    "streak": 0,
    "active": set(),
}


def _placeholders(ids: list[int]) -> str:
    return ",".join("?" * len(ids))


def invalidate(*, full: bool = False) -> None:
    """评分后让热力图失效；撤销会删 revlog，必须整体重算。"""
    _history["at"] = 0.0
    if full:
        _history["last_id"] = 0


def _streak(active: set[str]) -> int:
    cursor = (datetime.now() - timedelta(hours=4)).date()
    if cursor.isoformat() not in active:
        cursor -= timedelta(days=1)
    streak = 0
    while cursor.isoformat() in active:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _active_days(rows: list[Any]) -> set[str]:
    return {str(day) for (day,) in rows}


def build() -> tuple[list[dict[str, Any]], int, int, int]:
    """返回 (每日卡片数、复习次数、累计作答、连续天数)。"""
    ids = collection.deck_ids()
    key = tuple(ids)
    gen = collection.generation()
    now = time.time()
    today = daytime.today_key()
    # 跨过凌晨 4 点后不能再用增量：换日前最后一条记录可能还没写进缓存。
    same_deck = _history["deck"] == key and _history["gen"] == gen and _history["day"] == today
    if same_deck and now - _history["at"] < HISTORY_TTL:
        return _history["days"], _history["reviews"], _history["answers"], _history["streak"]

    db = collection.db()
    marks = _placeholders(ids)
    last_id = int(_history["last_id"] or 0) if same_deck else 0
    # 有增量游标时只刷新今天一格，避免每次评分都重扫 183 天热力图。
    rows = _today_rows(_history["days"], ids) if last_id > 0 else _day_rows(ids)
    if last_id > 0:
        reviews = int(_history["reviews"]) + int(
            db.scalar(
                "select count(*) from revlog r join cards c on c.id = r.cid "
                f"where r.type in (1, 2) and r.id > ? and c.did in ({marks})",
                last_id,
                *ids,
            )
            or 0
        )
        answers = int(_history["answers"]) + int(
            db.scalar(
                "select count(*) from revlog r join cards c on c.id = r.cid "
                f"where r.id > ? and c.did in ({marks})",
                last_id,
                *ids,
            )
            or 0
        )
        active = set(_history["active"])
        active |= _active_days(
            db.all(
                "select distinct date(r.id / 1000, 'unixepoch', 'localtime', ?) as d "
                "from revlog r join cards c on c.id = r.cid "
                f"where r.id > ? and c.did in ({marks})",
                daytime.DAY_SHIFT,
                last_id,
                *ids,
            )
        )
    else:
        reviews = int(
            db.scalar(
                "select count(*) from revlog r join cards c on c.id = r.cid "
                f"where r.type in (1, 2) and c.did in ({marks})",
                *ids,
            )
            or 0
        )
        answers = int(
            db.scalar(
                "select count(*) from revlog r join cards c on c.id = r.cid "
                f"where c.did in ({marks})",
                *ids,
            )
            or 0
        )
        active = _active_days(
            db.all(
                "select distinct date(r.id / 1000, 'unixepoch', 'localtime', ?) as d "
                "from revlog r join cards c on c.id = r.cid "
                f"where r.id >= ? and c.did in ({marks})",
                daytime.DAY_SHIFT,
                int((now - ACTIVE_DAYS * 86400) * 1000),
                *ids,
            )
        )

    # 连续天数不可能超过 ACTIVE_DAYS；顺手裁掉过期日期，集合不会无限增长。
    floor = (datetime.now() - timedelta(days=ACTIVE_DAYS)).date().isoformat()
    active = {day for day in active if day >= floor}
    newest = int(db.scalar("select max(id) from revlog") or 0)
    streak = _streak(active)
    _history.update(
        at=now,
        deck=key,
        gen=gen,
        day=today,
        last_id=newest,
        days=rows,
        reviews=reviews,
        answers=answers,
        streak=streak,
        active=active,
    )
    return rows, reviews, answers, streak


def _today_rows(rows: list[Any], ids: list[int], days: int = 183) -> list[dict[str, Any]]:
    """增量构建时只重算今天，其余日期沿用缓存。"""
    today = daytime.today_key()
    count = int(
        collection.db().scalar(
            "select count(distinct r.cid) from revlog r join cards c on c.id = r.cid "
            f"where r.id >= ? and c.did in ({_placeholders(ids)})",
            daytime.day_start_ms(),
            *ids,
        )
        or 0
    )
    floor = (datetime.now() - timedelta(days=days)).date().isoformat()
    updated = [dict(row) for row in rows if str(row["date"]) >= floor and str(row["date"]) != today]
    if count:
        updated.append({"date": today, "count": count})
        updated.sort(key=lambda row: str(row["date"]))
    return updated


def _day_rows(ids: list[int], days: int = 183) -> list[dict[str, Any]]:
    cutoff = int((time.time() - days * 86400) * 1000)
    rows = collection.db().all(
        "select date(r.id / 1000, 'unixepoch', 'localtime', ?) as d, count(distinct r.cid) "
        "from revlog r join cards c on c.id = r.cid "
        f"where r.id >= ? and c.did in ({_placeholders(ids)}) group by d order by d",
        daytime.DAY_SHIFT,
        cutoff,
        *ids,
    )
    return [{"date": str(day), "count": int(count)} for day, count in rows]
