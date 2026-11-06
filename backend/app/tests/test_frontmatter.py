"""Front Matter 解析与序列化：日期、摘要、阅读时长与未知字段保留。"""

from __future__ import annotations

from app.features.posts.frontmatter import (
    build_meta,
    excerpt_of,
    list_of,
    parse_post,
    reading_time_of,
    serialize_post,
    slugify_title,
)
from app.features.posts.schemas import FrontMatter

SAMPLE = """---
title: "Kafka 为什么快"
date: 2024-05-01 10:30:00
tags: [kafka, java]
categories: 中间件
description: 从顺序写与零拷贝讲起
cover: /images/a.png
custom: keep-me
---

正文第一段。
"""


def test_meta_fields() -> None:
    meta = build_meta("posts", "kafka", SAMPLE)
    assert meta.slug == "kafka"
    assert meta.title == "Kafka 为什么快"
    assert meta.date_raw == "2024-05-01 10:30:00"
    assert meta.date_iso == "2024-05-01T02:30:00Z"
    assert meta.display_date == "2024-05-01"
    assert meta.display_date_time == "2024-05-01 10:30"
    assert meta.tags == ["kafka", "java"]
    assert meta.categories == ["中间件"]
    assert meta.excerpt == "从顺序写与零拷贝讲起"
    assert meta.cover == "/images/a.png"
    assert meta.reading_time >= 1
    assert meta.type == "posts"


def test_title_falls_back_to_slug() -> None:
    meta = build_meta("drafts", "no-title", "---\ndate: 2024-01-01\n---\n正文")
    assert meta.title == "no-title"


def test_unparseable_date_uses_epoch() -> None:
    meta = build_meta("posts", "x", "---\ntitle: x\ndate: 不是日期\n---\n")
    assert meta.date_iso == "1970-01-01T00:00:00Z"


def test_parse_keeps_unknown_fields() -> None:
    parsed = parse_post("posts", "kafka", SAMPLE)
    assert parsed.extra == {"custom": "keep-me"}
    assert parsed.front.title == "Kafka 为什么快"
    assert "正文第一段" in parsed.body


def test_serialize_round_trip_keeps_extra() -> None:
    raw = serialize_post(
        FrontMatter(
            title="标题",
            date="2024-05-01 10:30:00",
            tags=["a", "b"],
            categories=["c"],
            description="摘要",
            cover="",
        ),
        "正文\n",
        {"custom": "keep-me"},
    )
    parsed = parse_post("drafts", "slug", raw)
    assert parsed.meta.title == "标题"
    assert parsed.meta.tags == ["a", "b"]
    assert parsed.meta.categories == ["c"]
    assert parsed.front.description == "摘要"
    assert parsed.extra == {"custom": "keep-me"}
    assert parsed.body.strip() == "正文"


def test_list_and_excerpt_helpers() -> None:
    assert list_of(None) == []
    assert list_of("") == []
    assert list_of("a, b ,c") == ["a", "b", "c"]
    assert list_of(["a", " b "]) == ["a", " b "]
    assert excerpt_of({"description": "x" * 200}, "") == "x" * 180


def test_excerpt_from_body_strips_markup() -> None:
    body = "# 标题\n\n```java\nint a = 1;\n```\n\n![图](/a.png) 正文内容"
    text = excerpt_of({}, body)
    assert "int a" not in text
    assert "正文内容" in text


def test_reading_time_counts_cjk_and_words() -> None:
    assert reading_time_of("") == 1
    assert reading_time_of("中" * 800) == 2
    assert reading_time_of("word " * 440) == 2


def test_slugify_title() -> None:
    assert slugify_title("  你好 / 世界  ") == "你好-世界"
    assert slugify_title('a:b*c?d"e<f>g|h\\i') == "a-b-c-d-e-f-g-h-i"
    assert len(slugify_title("x" * 200)) == 80
