"""题库读取链路：索引 → 专题导航 → 题目详情（高亮与图片尺寸）。"""

from __future__ import annotations

import pytest

from app.core.errors import AppError
from app.features.study import repository, service


@pytest.fixture(autouse=True)
def fresh_cache() -> None:
    repository.reset()


def test_index_matches_meta() -> None:
    index = service.list_topics()
    assert len(index.topics) >= 40
    assert index.meta.topics == len(index.topics)
    assert index.meta.count == sum(topic.count for topic in index.topics)
    first = index.topics[0]
    assert first.id and first.slug and first.count >= 1
    assert first.first_qid


def test_topic_detail_nav_is_lightweight() -> None:
    topic_id = service.list_topics().topics[0].id
    detail = service.topic_detail(topic_id)
    assert len(detail.questions) == detail.count
    item = detail.questions[0]
    assert item.id and item.no and item.title
    assert "answer" not in item.model_dump(by_alias=True)


def test_question_detail_has_answer_and_notes() -> None:
    topic_id = service.list_topics().topics[0].id
    qid = service.first_question(topic_id)
    question = service.get_question(topic_id, qid)
    assert question.id == qid
    assert question.answer.strip()
    assert question.notes, "每题至少一条笔记（旧数据的截图组按图笔记读取）"
    images = [note for note in question.notes if note.kind == "images"]
    assert images, "旧 evidence 结构应被读成图片笔记"
    assert all(file.file.startswith("/study/") for note in images for file in note.files)
    assert all(file.width and file.height for note in images for file in note.files), (
        "笔记截图必须带宽高，避免 CLS"
    )


def test_markdown_note_renders_to_html() -> None:
    notes = service._notes(
        {"notes": [{"label": "", "kind": "markdown", "markdown": "### 手写\n\n- 要点"}]}
    )
    assert notes[0].label == "笔记1"
    assert notes[0].kind == "markdown"
    assert notes[0].files == []
    assert "<h3" in notes[0].html and "<li>" in notes[0].html


def test_question_prev_next_walk_all() -> None:
    topic = service.topic_detail(service.list_topics().topics[0].id)
    first = service.get_question(topic.id, topic.questions[0].id)
    assert first.prev is None
    if len(topic.questions) > 1:
        assert first.next is not None
        second = service.get_question(topic.id, topic.questions[1].id)
        assert second.prev is not None and second.prev.id == first.id
    last = service.get_question(topic.id, topic.questions[-1].id)
    assert last.next is None


def test_unknown_topic_and_question_raise_404() -> None:
    with pytest.raises(AppError) as topic_error:
        service.topic_detail("no-such-topic")
    assert topic_error.value.status == 404

    topic_id = service.list_topics().topics[0].id
    with pytest.raises(AppError) as question_error:
        service.get_question(topic_id, "no-such-question")
    assert question_error.value.status == 404


def test_traversal_in_topic_id_is_rejected() -> None:
    with pytest.raises(AppError) as error:
        service.topic_detail("..%2Findex")
    assert error.value.status == 404
