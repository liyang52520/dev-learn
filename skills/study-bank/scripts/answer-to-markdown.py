#!/usr/bin/env python3
"""把题库 answer 从 HTML 片段转成 Markdown，并逐题用真实渲染管线自检。

题库答案当前存储的是上游 PDF 抽取出的 HTML 片段；本脚本把它改写成可直接编辑的
Markdown（段落、标题、列表、代码围栏、GFM 表格、带图注的图片），并在写盘前用
`app.rendering.answers.render_answer` 渲染一遍，逐题比对结构，任何不一致的题目
都保留原 HTML 并记为失败。

用法（在仓库根目录）：

    backend/.venv/bin/python skills/study-bank/scripts/answer-to-markdown.py --check
    backend/.venv/bin/python skills/study-bank/scripts/answer-to-markdown.py --topic=jvm
    backend/.venv/bin/python skills/study-bank/scripts/answer-to-markdown.py --write

`--check` 只验证不写盘；`--topic` 可重复，只处理指定专题。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "backend" / "data" / "study"
sys.path.insert(0, str(ROOT / "backend"))

from app.rendering.answers import render_answer  # noqa: E402
from app.rendering.highlight import label_of  # noqa: E402

HEADINGS = {"h2": 2, "h3": 3, "h4": 4, "h5": 5}
VOID = {"img", "br", "hr", "input", "meta", "link"}


class Text:
    __slots__ = ("text",)

    def __init__(self, text: str) -> None:
        self.text = text


class Node:
    __slots__ = ("tag", "attrs", "children")

    def __init__(self, tag: str = "root", attrs: dict[str, str] | None = None) -> None:
        self.tag = tag
        self.attrs = dict(attrs or {})
        self.children: list[Node | Text] = []


class _Parser(HTMLParser):
    """容错建树：未知/畸形标签忽略，文本保留（字符引用自动解码）。"""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag, {key: value or "" for key, value in attrs})
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.stack[-1].children.append(Node(tag, {key: value or "" for key, value in attrs}))

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        self.stack[-1].children.append(Text(data))


def parse(markup: str) -> Node:
    parser = _Parser()
    parser.feed(markup)
    parser.close()
    return parser.root


def children_of(node: Node) -> Iterator[Node]:
    for child in node.children:
        if isinstance(child, Node):
            yield child


def text_of(node: Node | Text) -> str:
    if isinstance(node, Text):
        return node.text
    if node.tag == "br":
        return "\n"
    return "".join(text_of(child) for child in node.children)


def first_tag(node: Node, tag: str) -> Node | None:
    for child in children_of(node):
        if child.tag == tag:
            return child
        found = first_tag(child, tag)
        if found is not None:
            return found
    return None


def descendants(node: Node, tag: str) -> Iterator[Node]:
    for child in children_of(node):
        if child.tag == tag:
            yield child
        yield from descendants(child, tag)


def by_class(node: Node, name: str) -> Node | None:
    for child in children_of(node):
        if name in child.attrs.get("class", "").split():
            return child
        found = by_class(child, name)
        if found is not None:
            return found
    return None


# --------------------------------------------------------------------------- 内联


def inline(text: str) -> str:
    """正文/答案文本 → Markdown 行内文本：换行压成空格，转义会改变语义的字符。"""
    text = text.replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]*\n[ \t]*", " ", text)
    text = text.replace("\\", "\\\\")
    for char in "`*[]<>|~$":
        text = text.replace(char, "\\" + char)
    text = re.sub(r"&(?=#?\w+;)", r"\\&", text)
    return text


def escape_lead(text: str) -> str:
    """行首的 `#`、`-`、`>`、`1.` 会被当成块级标记，转义成普通文字。"""
    text = re.sub(
        r"^([ \t]*)([#+>]|-(?=[ \t]|$))",
        lambda m: m.group(1) + "\\" + m.group(2),
        text,
    )
    return re.sub(
        r"^([ \t]*)(\d{1,9})([.)])(?=[ \t]|$)",
        lambda m: m.group(1) + m.group(2) + "\\" + m.group(3),
        text,
    )


# --------------------------------------------------------------------------- 块级


def paragraph_markdown(node: Node) -> str:
    return escape_lead(inline(text_of(node))) or "&nbsp;"


def heading_markdown(node: Node, level: int) -> str:
    return "#" * level + " " + inline(text_of(node))


def list_markdown(node: Node) -> str:
    lines: list[str] = []
    for item in children_of(node):
        content = escape_lead(inline(text_of(item)))
        if item.tag != "li":
            if content.strip():
                lines.append(content)
            continue
        if content.strip():
            lines.append("- " + content)
    return "\n".join(line for line in lines if line.strip())


def code_markdown(node: Node) -> str:
    code = text_of(node)
    lang = node.attrs.get("data-lang") or "text"
    longest = max((len(match.group(0)) for match in re.finditer(r"^`{3,}", code, re.M)), default=0)
    fence = "`" * max(3, longest + 1)
    return f"{fence}{lang}\n{code.rstrip(chr(10))}\n{fence}"


def image_markdown(node: Node) -> str:
    image = first_tag(node, "img")
    if image is None:
        return ""
    src = image.attrs.get("src", "")
    alt = image.attrs.get("alt", "")
    caption = first_tag(node, "figcaption")
    title = inline(text_of(caption)) if caption is not None else ""
    url = f"<{src}>" if any(char in src for char in " ()<>") else src
    safe_alt = alt.replace("\\", "\\\\").replace("]", "\\]")
    title_part = ' "' + title.replace('"', '\\"') + '"' if title else ""
    return f"![{safe_alt}]({url}{title_part})"


def table_markdown(node: Node) -> str:
    rows: list[list[str]] = []
    for row in descendants(node, "tr"):
        cells = [child for child in children_of(row) if child.tag in ("td", "th")]
        rows.append([inline(text_of(cell)) for cell in cells])
    rows = [row for row in rows if row]
    if not rows:
        return ""
    width = max(len(row) for row in rows)
    rows = [row + [""] * (width - len(row)) for row in rows]
    lines = ["| " + " | ".join(row) + " |" for row in rows]
    separator = "| " + " | ".join(["---"] * width) + " |"
    return "\n".join([lines[0], separator, *lines[1:]])


def fallback_html(node: Node) -> str:
    if isinstance(node, Text):
        return node.text

    def attrs() -> str:
        return "".join(f' {key}="{value}"' for key, value in node.attrs.items())

    if node.tag in VOID:
        return f"<{node.tag}{attrs()}>"
    inner = "".join(fallback_html(child) for child in node.children)
    return f"<{node.tag}{attrs()}>{inner}</{node.tag}>"


def blocks_markdown(root: Node, report: list[str]) -> str:
    blocks: list[str] = []
    for node in children_of(root):
        block = ""
        if node.tag == "p":
            block = paragraph_markdown(node)
        elif node.tag in HEADINGS:
            block = heading_markdown(node, HEADINGS[node.tag])
        elif node.tag in ("ul", "ol"):
            block = list_markdown(node)
        elif node.tag == "li":
            # 文档层的裸 <li class='num'>：原文自带序号，按段落处理避免重复编号。
            block = paragraph_markdown(node)
        elif node.tag == "pre":
            block = code_markdown(node)
        elif node.tag == "figure":
            block = image_markdown(node)
        elif node.tag == "div":
            table = first_tag(node, "table")
            block = table_markdown(table) if table is not None else fallback_html(node)
        elif node.tag == "table":
            block = table_markdown(node)
        else:
            report.append(f"未识别块级标签 <{node.tag}>，按原始 HTML 保留")
            block = fallback_html(node)
        if block.strip() and block != "&nbsp;":
            blocks.append(block)
    return "\n\n".join(blocks)


# --------------------------------------------------------------------------- 结构签名


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\x00", "")).strip()


def code_clean(text: str) -> str:
    return text.replace("\r\n", "\n").rstrip("\n")


def signature(root: Node, langs: list[str] | None = None) -> list[tuple[Any, ...]]:
    """按文档顺序抽取可比对的内容块：标题、段落、列表项、代码、图片、表格单元格。"""
    entries: list[tuple[Any, ...]] = []

    def walk(node: Node, parent: str) -> None:
        for child in children_of(node):
            tag = child.tag
            if tag in HEADINGS:
                entries.append(("head", HEADINGS[tag], normalize(text_of(child))))
            elif tag == "p":
                entries.append(("p", normalize(text_of(child))))
            elif tag == "li":
                kind = "li" if parent in ("ul", "ol") else "p"
                entries.append((kind, normalize(text_of(child))))
            elif tag == "pre":
                label = by_class(node, "code-lang")
                lang = normalize(text_of(label)) if label is not None else ""
                if langs is not None:
                    langs.append(lang or child.attrs.get("data-lang", "text"))
                entries.append(("code", code_clean(text_of(child))))
            elif tag == "img":
                entries.append(("img", child.attrs.get("src", "")))
            elif tag in ("td", "th"):
                entries.append(("cell", normalize(text_of(child))))
            elif tag in ("figcaption", "span", "button", *VOID):
                continue
            elif tag == "div" and "code-bar" in child.attrs.get("class", "").split():
                continue
            elif tag in ("figure", "table", "thead", "tbody", "tr", "div", "ul", "ol"):
                walk(child, tag)
            else:
                entries.append(("unknown", tag, normalize(text_of(child))))

    walk(root, "root")
    return entries


# --------------------------------------------------------------------------- 转换与校验


BLOCK_TAG = re.compile(r"<(?:p|ul|ol|li|pre|figure|table|div|h[2-5])\b", re.IGNORECASE)
FENCE_BLOCK = re.compile(r"^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*$", re.MULTILINE)


def convert(original: str) -> tuple[str, list[str]]:
    report: list[str] = []
    if not original.strip():
        return "", report
    # 围栏里的 `<Worker>`、`<p>` 是代码文本，不是 HTML；先摘掉再判断是否已是 Markdown。
    if not BLOCK_TAG.search(FENCE_BLOCK.sub("", original)):
        report.append("SKIP_ALREADY_MARKDOWN")
        return original, report
    markdown = blocks_markdown(parse(original), report)
    return markdown, report


def compare(original: str, markdown: str) -> list[str]:
    expected_langs: list[str] = []
    expected = signature(parse(original), expected_langs)
    actual_langs: list[str] = []
    actual = signature(parse(render_answer(markdown)), actual_langs)
    problems: list[str] = []
    for index, (want, got) in enumerate(zip(expected, actual)):
        if want != got:
            problems.append(f"第 {index} 个块：期望 {want!r}，实际 {got!r}")
            break
    if len(expected) != len(actual):
        problems.append(f"块数量不一致：期望 {len(expected)}，实际 {len(actual)}")
    for index, (want, got) in enumerate(zip(expected_langs, actual_langs)):
        if label_of(want) != got:
            problems.append(f"第 {index} 个代码块语言：期望 {label_of(want)}，实际 {got}")
            break
    return problems


def dump(data: dict[str, Any], target: Path, *, trailing_newline: bool) -> None:
    text = json.dumps(data, ensure_ascii=False, indent=2) + ("\n" if trailing_newline else "")
    target.parent.mkdir(parents=True, exist_ok=True)
    handle, temp = tempfile.mkstemp(dir=target.parent, prefix=".answer-md-", suffix=".json")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            stream.write(text)
        os.replace(temp, target)
    except BaseException:
        Path(temp).unlink(missing_ok=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="题库答案 HTML → Markdown")
    parser.add_argument("--write", action="store_true", help="写回专题 JSON（默认只检查）")
    parser.add_argument("--check", action="store_true", help="只检查、不写盘（默认行为）")
    parser.add_argument("--topic", action="append", default=[], help="只处理指定专题 id，可重复")
    parser.add_argument("--quiet", action="store_true", help="只输出失败项与汇总")
    args = parser.parse_args()

    wanted = set(args.topic)
    files = sorted(path for path in DATA_DIR.glob("*.json") if path.name != "index.json")
    if wanted:
        files = [path for path in files if path.stem in wanted]
        missing = wanted - {path.stem for path in files}
        for topic in sorted(missing):
            print(f"跳过不存在的专题：{topic}")

    total = 0
    converted = 0
    empty = 0
    skipped = 0
    failures: list[str] = []
    for path in files:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        changed = 0
        for question in data.get("questions", []):
            total += 1
            original = question.get("answer", "")
            if not original.strip():
                empty += 1
                continue
            markdown, notes = convert(original)
            if notes == ["SKIP_ALREADY_MARKDOWN"]:
                skipped += 1
                continue
            problems = notes + compare(original, markdown)
            if problems:
                failures.append(f"{data['id']}/{question['id']}: " + "；".join(problems))
                continue
            if markdown != original:
                question["answer"] = markdown
                changed += 1
                converted += 1
        if changed and args.write:
            dump(data, path)
        if not args.quiet and changed:
            print(f"{data['id']}: {changed} 题{'已写回' if args.write else '可转换'}")

    print(
        f"\n汇总：{len(files)} 个专题 / {total} 题；"
        f"{converted} 题{'已写回' if args.write else '验证通过'}，"
        f"{skipped} 题已是 Markdown，{empty} 题答案为空，{len(failures)} 题失败"
    )
    for line in failures[:40]:
        print("  ✗ " + line)
    if len(failures) > 40:
        print(f"  …… 其余 {len(failures) - 40} 条省略")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
