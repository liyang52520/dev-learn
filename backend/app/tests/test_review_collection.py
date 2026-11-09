"""collection 打开时的默认配置兜底。"""

from __future__ import annotations

from anki.collection import Collection

from app.features.review.collection import ensure_fsrs


def test_ensure_fsrs_enables_once(tmp_path):
    col = Collection(str(tmp_path / "collection.anki2"))
    try:
        col.set_config("fsrs", False)
        assert ensure_fsrs(col) is True
        assert bool(col.get_config("fsrs", False)) is True
        assert ensure_fsrs(col) is False
    finally:
        col.close()
