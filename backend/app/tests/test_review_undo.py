"""复习撤销凭证的绑定规则。

Anki 的撤销栈是全局的：只要中间发生过评分、埋藏、标记或改配置，
旧凭证就必须失效，否则撤销的会是别的操作。
"""

from __future__ import annotations

import time
from contextlib import nullcontext
from types import SimpleNamespace

import pytest

from app.core.errors import AppError
from app.features.review import schedule


@pytest.fixture(autouse=True)
def isolated_state(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(schedule.collection, "LOCK", nullcontext())
    monkeypatch.setattr(schedule.collection, "mark_dirty", lambda: None)
    monkeypatch.setattr(schedule, "counts", lambda: {"new": 0, "learning": 0, "review": 0})
    monkeypatch.setattr(schedule.analytics, "due_total", lambda: 0)
    monkeypatch.setattr(
        schedule,
        "progress",
        lambda client_id="": {"today": 1, "can_undo": False, "undo_token": None},
    )
    schedule._pending = {}
    schedule._active_undo = None
    yield
    schedule._pending = {}
    schedule._active_undo = None


def fake_collection(monkeypatch: pytest.MonkeyPatch, *, undoable: bool = True):
    calls: list[str] = []
    fake = SimpleNamespace(
        undo_status=lambda: SimpleNamespace(undo=undoable),
        undo=lambda: calls.append("undo"),
    )
    monkeypatch.setattr(schedule.collection, "instance", lambda: fake)
    return calls


def test_undo_token_is_bound_to_tab(monkeypatch: pytest.MonkeyPatch):
    fake_collection(monkeypatch)
    schedule._active_undo = {"token": "tok", "client_id": "tab-a", "card_id": 7, "at": time.time()}

    assert schedule.can_undo("tab-a")
    assert not schedule.can_undo("tab-b")


def test_any_written_operation_clears_the_token(monkeypatch: pytest.MonkeyPatch):
    fake_collection(monkeypatch)
    schedule._active_undo = {"token": "tok", "client_id": "tab-a", "card_id": 7, "at": time.time()}

    schedule.clear_undo()

    assert not schedule.can_undo("tab-a")


def test_reset_pending_drops_cards_and_undo(monkeypatch: pytest.MonkeyPatch):
    fake_collection(monkeypatch)
    schedule._pending = {7: (None, 0.0, time.time() + 60)}
    schedule._active_undo = {"token": "tok", "client_id": "tab-a", "card_id": 7, "at": time.time()}

    schedule.reset_pending()

    assert schedule._pending == {}
    assert not schedule.can_undo("tab-a")


def test_new_rating_replaces_the_previous_token(monkeypatch: pytest.MonkeyPatch):
    fake_collection(monkeypatch)
    schedule._active_undo = {"token": "old", "client_id": "tab-a", "card_id": 7, "at": time.time()}
    schedule._active_undo = {"token": "new", "client_id": "tab-a", "card_id": 8, "at": time.time()}

    with pytest.raises(AppError):
        schedule.undo("old", "tab-a")
    assert schedule.undo_token("tab-a") == "new"


def test_undo_rejects_other_tab_and_only_drops_that_card(monkeypatch: pytest.MonkeyPatch):
    calls = fake_collection(monkeypatch)
    schedule._pending = {7: (None, 0.0, time.time() + 60), 8: (None, 0.0, time.time() + 60)}
    schedule._active_undo = {"token": "tok", "client_id": "tab-a", "card_id": 7, "at": time.time()}

    with pytest.raises(AppError):
        schedule.undo("tok", "tab-b")
    assert calls == []

    schedule.undo("tok", "tab-a")
    assert calls == ["undo"]
    assert 8 in schedule._pending
    assert not schedule.can_undo("tab-a")


def test_expired_token_is_rejected(monkeypatch: pytest.MonkeyPatch):
    fake_collection(monkeypatch)
    schedule._active_undo = {
        "token": "tok",
        "client_id": "tab-a",
        "card_id": 7,
        "at": time.time() - schedule.UNDO_TTL - 1,
    }

    assert not schedule.can_undo("tab-a")


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("<1m", "<1 分钟"),
        ("<10m", "<10 分钟"),
        ("2h", "2 小时"),
        ("9d", "9 天"),
        ("4mo", "4 个月"),
        ("1.2y", "1.2 年"),
        ("unknown", "unknown"),
    ],
)
def test_interval_labels_are_localized(raw: str, expected: str):
    assert schedule._clean_label(raw) == expected


def test_interval_label_strips_bidi_marks():
    assert schedule._clean_label("\u2068<1m\u2069") == "<1 分钟"


def test_phase_values_are_snake_case():
    from app.features.review.analytics import phase

    config = {"new_per_day": 20, "rev_per_day": 100}
    counts = {"new": 0, "learning": 0, "review": 0}

    assert phase(config, {"new": 1, "learning": 0, "review": 0}, 0, 0, 0, 5) == "review"
    assert phase(config, counts, 0, 100, 10, 0) == "review_quota"
    # 复习额度用尽后 Anki 同时停发新卡：没有逾期卡但有新卡，也不能算 done。
    assert phase(config, counts, 0, 100, 0, 5) == "review_quota"
    assert phase(config, counts, 20, 10, 0, 5) == "new_quota"
    assert phase({"new_per_day": 0, "rev_per_day": 100}, counts, 0, 0, 0, 5) == "paused"
    assert phase(config, counts, 0, 0, 0, 0) == "done"


def test_new_cards_share_the_review_quota():
    from app.features.review.analytics import review_limit_hit

    counts = {"new": 0, "learning": 0, "review": 0}
    config = {"rev_per_day": 10}
    # 新学 3 + 复习 7 正好用满共享额度；还有新卡没学 → 命中。
    assert review_limit_hit(config, counts, 3, 7, 0, 1) is True
    assert review_limit_hit(config, counts, 3, 6, 0, 1) is False
    # 到期卡被复习额度挡住时同样算命中。
    assert review_limit_hit(config, counts, 2, 8, 4, 0) is True


def test_ignore_review_limit_keeps_new_cards_out_of_the_quota():
    from app.features.review.analytics import review_limit_hit

    counts = {"new": 0, "learning": 0, "review": 0}
    config = {"rev_per_day": 10, "new_ignore_review_limit": True}
    assert review_limit_hit(config, counts, 3, 7, 5, 0) is False
    assert review_limit_hit(config, counts, 3, 10, 5, 0) is True


def test_phase_prefers_review_quota_when_new_cards_used_it_up():
    from app.features.review.analytics import phase

    config = {"new_per_day": 20, "rev_per_day": 10}
    counts = {"new": 0, "learning": 0, "review": 0}
    # 新学 3 + 复习 7 用满共享额度，新卡额度还没用完、也还有新卡没学：
    # 不能误报成「新卡额度用完」，真正的原因是复习额度。
    assert phase(config, counts, 3, 7, 0, 5) == "review_quota"
