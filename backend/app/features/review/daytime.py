"""Anki 学习日：凌晨 4 点换日，服务端与前端共用同一个边界。

所有「今天」都必须走这里：直接取自然日会让 0:00–4:00 的评分落到错误的一天，
热力图、连续天数与本轮进度也会互相矛盾。
"""

from __future__ import annotations

from datetime import datetime, timedelta

from app.features.review import collection

DAY_SHIFT = "-4 hours"  # SQL 里先把时间减 4 小时，再取本地日期


def today_seq() -> int:
    """Anki 的「今天」序号，用于比较按天调度的 due。"""
    return int(collection.instance().sched.today)


def day_start_ms() -> int:
    """当前学习日 0 点的毫秒时间戳。"""
    return int(collection.instance().sched.day_cutoff - 86400) * 1000


def rollover_epoch() -> int:
    """下一次换日的秒级时间戳。"""
    return int(collection.instance().sched.day_cutoff)


def today_key() -> str:
    """当前学习日的 YYYY-MM-DD（本地时区），前端用它判断会话是否跨日。"""
    cutoff = rollover_epoch()
    return (datetime.fromtimestamp(cutoff) - timedelta(days=1)).date().isoformat()
