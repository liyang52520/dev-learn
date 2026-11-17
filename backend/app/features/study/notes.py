"""题目笔记：一条笔记是截图组或 Markdown，兼容旧的 evidence 截图结构。

旧数据把截图分组存在 `evidence` 里（含起止页码），新结构统一为 `notes`：
`{label, kind: "images"|"markdown", files: [{file}], markdown}`。读取时两种都认，
保存时只写 `notes`，未编辑过的题目继续沿用旧键，无需批量迁移。
"""

from __future__ import annotations

from typing import Any

NOTE_LIMIT = 32
NOTE_KINDS = ("images", "markdown")


def raw_notes(question: dict[str, Any]) -> list[dict[str, Any]]:
    """题目里的笔记原列表：优先 notes，其次旧 evidence。"""
    for key in ("notes", "evidence"):
        value = question.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def note_entries(question: dict[str, Any]) -> list[dict[str, Any]]:
    """把新旧两种结构统一成 `{label, kind, files, markdown}`。"""
    entries: list[dict[str, Any]] = []
    for index, item in enumerate(raw_notes(question)):
        markdown = str(item.get("markdown") or "")
        kind = item.get("kind")
        if kind not in NOTE_KINDS:
            kind = "markdown" if markdown.strip() else "images"
        label = str(item.get("label") or "").strip() or f"笔记{index + 1}"
        files = [
            file for file in item.get("files") or [] if isinstance(file, dict) and file.get("file")
        ]
        entries.append({"label": label, "kind": kind, "files": files, "markdown": markdown})
    return entries
