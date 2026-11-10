"""后台题库编辑：文件、索引、search 与卡片同步调用的最小闭环。"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.core.errors import AppError
from app.features.study import admin_fields, admin_service, admin_views, repository
from app.features.study.admin_schemas import (
    CreateQuestionRequest,
    EvidenceFileInput,
    EvidenceGroupInput,
    QuestionWrite,
)


class _Settings:
    def __init__(self, study_dir: Path) -> None:
        self.study_dir = study_dir


def _question(no: int, title: str, page: int) -> dict[str, Any]:
    qid = f"q{no:03d}"
    return {
        "key": f"demo/{qid}",
        "no": no,
        "id": qid,
        "title": title,
        "aliases": [],
        "summary": ["要点"],
        "note": "",
        "pages": f"p{page}",
        "firstPage": page,
        "answer": f"<p>{title} 的答案</p>",
        "evidence": [
            {
                "label": "原文出处",
                "from": page,
                "to": page,
                "files": [
                    {"page": page, "file": f"/study/topic-01-demo/assets/ev/{qid}_0_{page}.jpg"}
                ],
            }
        ],
        "search": f"{title} 的答案",
    }


@pytest.fixture()
def bank(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Path, list[tuple[str, str]]]:
    study_dir = tmp_path / "study"
    (study_dir / "topic-01-demo" / "assets" / "ev").mkdir(parents=True)
    questions = [_question(1, "第一题", 3), _question(2, "第二题", 4), _question(3, "第三题", 5)]
    for question in questions:
        for group in question["evidence"]:
            for file in group["files"]:
                (
                    study_dir / "topic-01-demo" / "assets" / "ev" / Path(file["file"]).name
                ).write_bytes(b"img")
    topic = {
        "id": "demo",
        "no": "01",
        "slug": "topic-01-demo",
        "title": "演示专题",
        "label": "演示",
        "subtitle": "Topic-01 · 3 页原文",
        "accent": "#123456",
        "pages": 3,
        "count": 3,
        "pdf": "",
        "questions": questions,
    }
    index = {
        "meta": {"pages": 3, "topics": 1, "count": 3},
        "topics": [
            {
                "id": "demo",
                "no": "01",
                "slug": "topic-01-demo",
                "title": "演示专题",
                "label": "演示",
                "subtitle": "Topic-01 · 3 页原文",
                "accent": "#123456",
                "pages": 3,
                "count": 3,
                "questions": [
                    {
                        key: value
                        for key, value in question.items()
                        if key != "answer" and key != "evidence"
                    }
                    for question in questions
                ],
            }
        ],
    }
    (study_dir / "demo.json").write_text(
        json.dumps(topic, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (study_dir / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    fake = _Settings(study_dir)
    monkeypatch.setattr(repository, "settings", fake)
    monkeypatch.setattr(admin_service, "settings", fake)
    monkeypatch.setattr(admin_fields, "settings", fake)
    monkeypatch.setattr(admin_fields, "dimensions_of_src", lambda _: (100, 100))
    monkeypatch.setattr(admin_views, "dimensions_of_src", lambda _: (100, 100))
    calls: list[tuple[str, str]] = []
    monkeypatch.setattr(admin_service.review_service, "anki_available", lambda: True)
    monkeypatch.setattr(
        admin_service.review_service,
        "sync_bank_create",
        lambda topic, question: calls.append(("create", question["key"])) or True,
    )
    monkeypatch.setattr(
        admin_service.review_service,
        "sync_bank_update",
        lambda topic, question: calls.append(("update", question["key"])) or True,
    )
    monkeypatch.setattr(
        admin_service.review_service,
        "sync_bank_delete",
        lambda qid: calls.append(("delete", qid)) or True,
    )
    monkeypatch.setattr(
        admin_service.review_service,
        "sync_bank_reindex",
        lambda topic, moves: calls.extend(("reindex", move[1]) for move in moves) or len(moves),
    )
    repository.reset()
    return study_dir, calls


def _write_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "title": "改过的标题",
        "aliases": ["别名"],
        "summary": ["新要点"],
        "note": "",
        "pages": "p3",
        "firstPage": 3,
        "answer": "<p>新答案正文</p>",
        "evidence": [
            {
                "label": "原文出处",
                "from": 3,
                "to": 3,
                "files": [
                    {"page": 3, "file": "/study/topic-01-demo/assets/ev/q001_0_3.jpg"},
                ],
            }
        ],
    }
    payload.update(overrides)
    return payload


def test_update_keeps_key_and_refreshes_index(bank: tuple[Path, list[tuple[str, str]]]) -> None:
    study_dir, calls = bank
    result = admin_service.update_question("demo", "q001", QuestionWrite(**_write_payload()))
    assert result.card_synced is True
    assert ("update", "demo/q001") in calls

    topic = json.loads((study_dir / "demo.json").read_text(encoding="utf-8"))
    question = topic["questions"][0]
    assert question["key"] == "demo/q001" and question["id"] == "q001"
    assert question["title"] == "改过的标题"
    assert "新答案正文" in question["search"]

    index = json.loads((study_dir / "index.json").read_text(encoding="utf-8"))
    assert index["topics"][0]["questions"][0]["title"] == "改过的标题"
    assert "新答案正文" in index["topics"][0]["questions"][0]["search"]
    assert index["meta"]["count"] == 3


def test_create_appends_continuous_qid(bank: tuple[Path, list[tuple[str, str]]]) -> None:
    study_dir, calls = bank
    payload = CreateQuestionRequest(
        topicId="demo",
        **_write_payload(
            title="新增题",
            evidence=[
                {
                    "label": "",
                    "from": 6,
                    "to": 6,
                    "files": [{"page": 6, "file": "/study/topic-01-demo/assets/ev/q001_0_3.jpg"}],
                }
            ],
        ),
    )
    created = admin_service.create_question(payload)
    assert created.question.id == "q004" and created.question.key == "demo/q004"
    assert created.question.evidence[0].label == "原文出处"
    assert ("create", "demo/q004") in calls

    index = json.loads((study_dir / "index.json").read_text(encoding="utf-8"))
    assert index["topics"][0]["count"] == 4
    assert index["meta"]["count"] == 4


def test_delete_middle_renumbers_and_renames_evidence(
    bank: tuple[Path, list[tuple[str, str]]],
) -> None:
    study_dir, calls = bank
    result = admin_service.delete_question("demo", "q002")
    assert result.card_deleted is True and result.reindexed == 1
    assert ("delete", "demo/q002") in calls
    assert ("reindex", "demo/q002") in calls

    topic = json.loads((study_dir / "demo.json").read_text(encoding="utf-8"))
    assert [question["id"] for question in topic["questions"]] == ["q001", "q002"]
    assert topic["questions"][1]["title"] == "第三题"
    assert topic["questions"][1]["key"] == "demo/q002"
    assert (
        topic["questions"][1]["evidence"][0]["files"][0]["file"]
        == "/study/topic-01-demo/assets/ev/q002_0_5.jpg"
    )
    ev_dir = study_dir / "topic-01-demo" / "assets" / "ev"
    assert (ev_dir / "q002_0_5.jpg").is_file()
    assert not (ev_dir / "q003_0_5.jpg").exists()

    index = json.loads((study_dir / "index.json").read_text(encoding="utf-8"))
    assert [question["id"] for question in index["topics"][0]["questions"]] == ["q001", "q002"]
    assert index["meta"]["count"] == 2


def test_allows_question_without_evidence(bank: tuple[Path, list[tuple[str, str]]]) -> None:
    result = admin_service.update_question(
        "demo",
        "q001",
        QuestionWrite(**_write_payload(evidence=[], pages="", firstPage=None)),
    )
    assert result.question.evidence == []
    assert result.question.pages == ""
    assert result.question.first_page == 1


def test_rejects_unsafe_answer_and_cross_topic_evidence(
    bank: tuple[Path, list[tuple[str, str]]],
) -> None:
    with pytest.raises(AppError):
        admin_service.update_question(
            "demo", "q001", QuestionWrite(**_write_payload(answer="<script>alert(1)</script>"))
        )
    with pytest.raises(AppError):
        admin_service.update_question(
            "demo",
            "q001",
            QuestionWrite(
                **_write_payload(
                    evidence=[
                        EvidenceGroupInput(
                            from_page=3,
                            to=3,
                            files=[
                                EvidenceFileInput(
                                    page=3, file="/study/topic-02-other/assets/ev/q001_0_3.jpg"
                                )
                            ],
                        )
                    ]
                )
            ),
        )


def test_list_filters_by_topic_and_keyword(bank: tuple[Path, list[tuple[str, str]]]) -> None:
    data = admin_service.list_bank("demo", "第三题")
    assert data.total == 1
    assert data.questions[0].title == "第三题"
    with pytest.raises(AppError):
        admin_service.list_bank("missing")


def test_plain_for_search_keeps_table_cells_and_literal_pipes() -> None:
    markup = (
        "| 步骤 | 描述 |\n| --- | --- |\n| 1. 添加节点 | 逻辑或（\\|）与短路或（\\|\\|） |\n\n"
        "正文里的 $PATH 与 `code` 保留"
    )
    text = admin_fields.plain_for_search(markup)
    assert "1. 添加节点" in text
    assert "（|）" in text and "（||）" in text
    assert "---" not in text and "| 步骤" not in text
    assert "$PATH" in text and "code" in text


def test_plain_for_search_ignores_escaped_links_and_control_chars() -> None:
    markup = "16、\\`@Configuration \\[ @PropertySource\\](mailto: @PropertySource) 注解\x00结束"
    text = admin_fields.plain_for_search(markup)
    assert "[ @PropertySource](mailto: @PropertySource)" in text
    assert "`@Configuration" in text
    assert "\x00" not in text


def test_plain_for_search_keeps_fenced_code_and_drops_image() -> None:
    markup = (
        '![原文配图 · p3](/study/topic-01-demo/assets/img/p3_0.jpg "原文配图 · p3")\n\n'
        "```java\nint a = 1; // 1. 行首数字\n```"
    )
    text = admin_fields.plain_for_search(markup)
    assert "原文配图" not in text
    assert "p3_0.jpg" not in text
    assert "1. 行首数字" in text
