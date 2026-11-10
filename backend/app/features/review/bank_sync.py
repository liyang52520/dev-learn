"""题库编辑与 Anki 卡片的同步。

只改 note 字段或删 note，不碰调度状态：编辑题目后卡片的学习进度、到期时间都不变；
删除题目才删除对应卡片。题号重排时把 QID 一起迁移，卡片本身仍是同一张。
"""

from __future__ import annotations

from typing import Any

from anki.collection import Collection
from anki.notes import NoteId

from app.features.review import collection, importer, schedule


def _notes_by_qid(col: Collection) -> dict[str, NoteId]:
    if not col.models.by_name(importer.NOTETYPE):
        return {}
    return {
        str(col.get_note(nid)["QID"]): nid for nid in col.find_notes(f"note:{importer.NOTETYPE}")
    }


def _fill(note: Any, topic: dict[str, Any], question: dict[str, Any]) -> None:
    note["QID"] = question["key"]
    note["Question"] = question["title"]
    note["Aliases"] = "；".join(question.get("aliases") or [])
    note["Summary"] = "<br>".join(question.get("summary") or [])
    note["Topic"] = topic["title"]
    note["Pages"] = question.get("pages", "")


def create_question(topic: dict[str, Any], question: dict[str, Any]) -> bool:
    if not collection.available():
        return False
    with collection.LOCK:
        col = collection.instance()
        notetype = importer.ensure_notetype(col)
        deck = importer.ensure_deck(col, f"{importer.PARENT_DECK}::{topic['label']}")
        note = col.new_note(notetype)
        _fill(note, topic, question)
        note.tags = [f"topic::{topic['id']}"]
        col.add_note(note, deck)
        schedule.reset_pending()
    return True


def update_question(topic: dict[str, Any], question: dict[str, Any]) -> bool:
    if not collection.available():
        return False
    with collection.LOCK:
        col = collection.instance()
        notes = _notes_by_qid(col)
        note_id = notes.get(question["key"])
        if note_id is None:
            # 卡片同步曾失败（例如同步期间编辑）时补建，学习状态从新卡开始。
            notetype = importer.ensure_notetype(col)
            deck = importer.ensure_deck(col, f"{importer.PARENT_DECK}::{topic['label']}")
            note = col.new_note(notetype)
            _fill(note, topic, question)
            note.tags = [f"topic::{topic['id']}"]
            col.add_note(note, deck)
        else:
            note = col.get_note(note_id)
            _fill(note, topic, question)
            col.update_note(note)
        schedule.reset_pending()
    return True


def delete_question(qid: str) -> bool:
    if not collection.available():
        return False
    with collection.LOCK:
        col = collection.instance()
        note_id = _notes_by_qid(col).get(qid)
        if note_id is None:
            return False
        col.remove_notes([note_id])
        schedule.reset_pending()
    return True


def reindex_questions(
    topic: dict[str, Any],
    moves: list[tuple[str, str, dict[str, Any]]],
) -> int:
    """删除中间题目后迁移后续 QID，返回实际更新的卡片数。"""
    if not moves or not collection.available():
        return 0
    changed = 0
    with collection.LOCK:
        col = collection.instance()
        notes = _notes_by_qid(col)
        for old_qid, new_qid, question in moves:
            note_id = notes.get(old_qid)
            if note_id is None:
                continue
            note = col.get_note(note_id)
            _fill(note, topic, question)
            note["QID"] = new_qid
            col.update_note(note)
            changed += 1
        if changed:
            schedule.reset_pending()
    return changed
