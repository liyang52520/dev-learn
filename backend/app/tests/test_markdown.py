"""Markdown 渲染管线：目录锚点、代码块包裹、表格与图片属性、公式占位。"""

from __future__ import annotations

from app.rendering.answers import highlight_answer
from app.rendering.markdown import render_markdown
from app.rendering.toc import Slugger, inline_text


def test_toc_collects_h2_h3_only() -> None:
    source = "# 一级\n\n## 为什么要想这个问题\n\n### 小节\n\n#### 太深\n"
    rendered = render_markdown(source)
    assert [(item.depth, item.text) for item in rendered.toc] == [
        (2, "为什么要想这个问题"),
        (3, "小节"),
    ]
    assert 'id="为什么要想这个问题"' in rendered.html
    assert 'id="小节"' in rendered.html
    assert "一级" in rendered.html


def test_duplicate_headings_get_suffix() -> None:
    items = render_markdown("## 重复\n\n## 重复\n").toc
    assert [item.id for item in items] == ["重复", "重复-1"]


def test_heading_ids_strip_inline_markup() -> None:
    rendered = render_markdown("## 用 `ThreadLocal` 隔离 **状态**\n")
    assert rendered.toc[0].id == "用-threadlocal-隔离-状态"


def test_fence_becomes_copyable_code_block() -> None:
    rendered = render_markdown("```java\nint a = 1;\n```\n")
    html = rendered.html
    assert '<div class="code-block">' in html
    assert "data-code-copy" in html
    assert 'class="code-lang">JAVA<' in html
    assert '<pre class="pyg">' in html
    assert "int" in html


def test_unknown_language_falls_back_to_text() -> None:
    html = render_markdown("```not-a-language\nhello\n```\n").html
    assert 'class="code-lang">NOT-A-LANGUAGE<' in html
    assert "hello" in html


def test_table_is_wrapped_once() -> None:
    html = render_markdown("| a | b |\n| - | - |\n| 1 | 2 |\n").html
    assert html.count('<div class="table-wrap">') == 1
    assert "<table>" in html


def test_markdown_image_gets_lazy_attrs() -> None:
    html = render_markdown("![图](/images/a.png)\n").html
    assert 'loading="lazy"' in html
    assert 'decoding="async"' in html
    assert 'alt="图"' in html


def test_raw_html_image_gets_lazy_attrs() -> None:
    html = render_markdown('<img src="/images/b.png" alt="b">\n').html
    assert html.count('loading="lazy"') == 1
    assert 'decoding="async"' in html


def test_math_tokens_carry_tex_payload() -> None:
    html = render_markdown("行内 $a^2+b^2$ 与块级：\n\n$$\nE = mc^2\n$$\n").html
    assert '<span class="math-inline" data-tex="a^2+b^2">' in html
    assert '<div class="math-block" data-tex="' in html
    assert 'role="math"' in html
    assert "\nE = mc^2\n</div>" in html


def test_slugger_dedupes_in_order() -> None:
    slugger = Slugger()
    assert [slugger.slug("A b"), slugger.slug("A b"), slugger.slug("a-b")] == [
        "a-b",
        "a-b-1",
        "a-b-2",
    ]


def test_inline_text_merges_children() -> None:
    rendered = render_markdown("## 你好 *世界*\n")
    assert rendered.toc[0].text == "你好 世界"


def test_inline_text_ignores_empty_token() -> None:
    marker = type("Token", (), {"children": None})
    assert inline_text(marker()) == ""


def test_answer_code_blocks_are_highlighted_and_plain_text_untouched() -> None:
    raw = (
        "<p>说明</p><pre class='code' data-lang='java'><code>"
        "int a = 1 &amp;&amp; a &lt; 2;"
        "</code></pre>"
    )
    html = highlight_answer(raw)
    assert html.count('<div class="code-block">') == 1
    assert 'class="code-lang">JAVA<' in html
    assert "&lt;" in html and "&amp;" in html
    assert "int" in html

    plain = "<p>只有文字</p>"
    assert highlight_answer(plain) == plain
