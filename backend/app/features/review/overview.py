"""统计页的深度指标。

与复习页高频轮询的 ReviewStats 分开，只在后台统计页调用；全部按当前 deck
（含子 deck）过滤，revlog 用 id 截断走主键索引。
"""

from __future__ import annotations

import re
import time
from datetime import datetime, timedelta
from typing import Any

from app.features.review import collection, daytime
from app.features.review.schemas import StudyForecastDay, StudyOverview, StudyTopicProgress
from app.features.study import service as study_service

_TOPIC_TAG = re.compile(r"topic::([\w-]+)")


def _placeholders(ids: list[int]) -> str:
    return ",".join("?" * len(ids))


def _learned_by_topic() -> dict[str, int]:
    """每个专题已学过的卡数（type != 0），按 note 上的 topic::<id> 标签归集。"""
    ids = collection.deck_ids()
    rows = collection.db().all(
        "select n.tags, count(*) from notes n join cards c on c.nid = n.id "
        f"where c.type != 0 and c.did in ({_placeholders(ids)}) group by n.tags",
        *ids,
    )
    counts: dict[str, int] = {}
    for tags, count in rows:
        match = _TOPIC_TAG.search(str(tags or ""))
        if match:
            key = match.group(1)
            counts[key] = counts.get(key, 0) + int(count)
    return counts


def _activity(ids: list[int]) -> tuple[int, int]:
    """最近 400 天的活跃天数与历史最长连续天数。"""
    cutoff = int((time.time() - 400 * 86400) * 1000)
    rows = collection.db().all(
        "select distinct date(r.id / 1000, 'unixepoch', 'localtime', ?) as d "
        "from revlog r join cards c on c.id = r.cid "
        f"where r.id >= ? and c.did in ({_placeholders(ids)})",
        daytime.DAY_SHIFT,
        cutoff,
        *ids,
    )
    days = sorted(str(day) for (day,) in rows if day)
    longest = current = 0
    previous: datetime | None = None
    for value in days:
        date = datetime.fromisoformat(value)
        current = current + 1 if previous and (date - previous).days == 1 else 1
        longest = max(longest, current)
        previous = date
    return len(days), longest


def _forecast(ids: list[int], days: int = 14) -> list[dict[str, Any]]:
    """未来 N 天每天到期的卡数；已逾期与学习中到点的卡统一算进今天。"""
    today = daytime.today_seq()
    last = today + days - 1
    rows = collection.db().all(
        "select case when queue = 1 then ? else due end as bucket, count(*) "
        "from cards where queue >= 0 "
        f"and did in ({_placeholders(ids)}) and ("
        "(queue = 1 and due <= ?) or (queue = 3 and due <= ?) "
        "or (type = 2 and queue >= 2 and due <= ?)) group by bucket",
        today,
        *ids,
        int(time.time()),
        last,
        last,
    )
    buckets = {today + offset: 0 for offset in range(days)}
    for bucket, count in rows:
        seq = max(today, int(bucket))
        if seq in buckets:
            buckets[seq] += int(count)
    base = datetime.fromisoformat(daytime.today_key()).date()
    return [
        {"date": (base + timedelta(days=offset)).isoformat(), "count": buckets[today + offset]}
        for offset in range(days)
    ]


def build() -> StudyOverview:
    with collection.LOCK:
        ids = collection.deck_ids()
        marks = _placeholders(ids)
        db = collection.db()

        total_time_ms = int(
            db.scalar(
                "select coalesce(sum(r.time), 0) from revlog r join cards c on c.id = r.cid "
                f"where c.did in ({marks})",
                *ids,
            )
            or 0
        )
        rows = db.all(
            "select "
            "coalesce(sum(case when type = 0 then 1 else 0 end), 0), "
            "coalesce(sum(case when type in (1, 3) then 1 else 0 end), 0), "
            "coalesce(sum(case when type = 2 and ivl < 21 then 1 else 0 end), 0), "
            "coalesce(sum(case when type = 2 and ivl >= 21 then 1 else 0 end), 0), "
            "coalesce(avg(case when type = 2 and ivl > 0 then ivl end), 0), "
            "coalesce(max(case when type = 2 then ivl else 0 end), 0) "
            f"from cards where did in ({marks})",
            *ids,
        )
        new_cards, learning_cards, young_cards, mature_cards, avg_interval, max_interval = rows[0]
        active_days, longest_streak = _activity(ids)
        forecast = _forecast(ids)
        learned = _learned_by_topic()
        index = study_service.list_topics()

    return StudyOverview(
        total_time_ms=total_time_ms,
        new_cards=int(new_cards),
        learning_cards=int(learning_cards),
        young_cards=int(young_cards),
        mature_cards=int(mature_cards),
        avg_interval_days=round(float(avg_interval or 0), 1),
        max_interval_days=int(max_interval or 0),
        active_days=active_days,
        longest_streak=longest_streak,
        forecast=[StudyForecastDay(**row) for row in forecast],
        topics=[
            StudyTopicProgress(
                id=topic.id,
                title=topic.title,
                label=topic.label,
                total=topic.count,
                learned=min(learned.get(topic.id, 0), topic.count),
            )
            for topic in index.topics
        ],
    )
