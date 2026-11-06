#!/usr/bin/env python3
"""把 data/study/*.json 导入本地 Anki collection。

一条题目 = 一个 Anki note = 一张卡；QID 字段保存 `jvm/q001` 用于回查本站题目。
题面和答案的渲染仍由站点负责，这里只落地「题目索引 + 学习状态」。

用法：
  python import.py                     # 全量 42 个专题
  python import.py --limit 3           # 只导前 3 个专题（试跑）
  python import.py --topics jvm os     # 只导指定专题
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from anki.collection import Collection
from anki.decks import DeckId

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent
STUDY = ROOT / "data" / "study"
COLL_PATH = BASE / "data" / "collection.anki2"

NOTETYPE = "JavaInterview"
PARENT_DECK = "Java面试"
FIELDS = ["QID", "Question", "Aliases", "Summary", "Topic", "Pages"]

QFRONT = "{{Question}}"
AFMT = """{{Question}}
<hr id=answer>
{{Summary}}
{{#Aliases}}<br><small>别名：{{Aliases}}</small>{{/Aliases}}"""


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def ensure_notetype(col: Collection):
    existing = col.models.by_name(NOTETYPE)
    if existing:
        return existing
    nt = col.models.new(NOTETYPE)
    for name in FIELDS:
        col.models.add_field(nt, col.models.new_field(name))
    tmpl = col.models.new_template("Card 1")
    tmpl["qfmt"] = QFRONT
    tmpl["afmt"] = AFMT
    col.models.add_template(nt, tmpl)
    col.models.add(nt)
    return col.models.by_name(NOTETYPE)


def ensure_deck(col: Collection, name: str) -> DeckId:
    did = col.decks.id_for_name(name)
    if did is not None:
        return DeckId(did)
    return DeckId(col.decks.add_normal_deck_with_name(name).id)


def existing_qids(col: Collection) -> set[str]:
    if not col.models.by_name(NOTETYPE):
        return set()
    return {col.get_note(nid)["QID"] for nid in col.find_notes(f"note:{NOTETYPE}")}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--topics", nargs="*", help="只导入这些 topic id")
    ap.add_argument("--limit", type=int, help="只导入前 N 个专题")
    args = ap.parse_args()

    index = load_json(STUDY / "index.json")
    topics = index["topics"]
    if args.topics:
        wanted = set(args.topics)
        topics = [t for t in topics if t["id"] in wanted]
        missing = wanted - {t["id"] for t in topics}
        if missing:
            print(f"未知专题：{sorted(missing)}")
            return 1
    if args.limit:
        topics = topics[: args.limit]
    if not topics:
        print("没有可导入的专题")
        return 1

    COLL_PATH.parent.mkdir(parents=True, exist_ok=True)
    col = Collection(str(COLL_PATH))
    nt = ensure_notetype(col)
    parent = ensure_deck(col, PARENT_DECK)
    seen = existing_qids(col)

    added = skipped = 0
    for topic in topics:
        data = load_json(STUDY / f"{topic['id']}.json")
        deck = ensure_deck(col, f"{PARENT_DECK}::{topic['label']}")
        n_added = 0
        for q in data["questions"]:
            if q["key"] in seen:
                skipped += 1
                continue
            note = col.new_note(nt)
            note["QID"] = q["key"]
            note["Question"] = q["title"]
            note["Aliases"] = "；".join(q.get("aliases") or [])
            note["Summary"] = "<br>".join(q.get("summary") or [])
            note["Topic"] = topic["title"]
            note["Pages"] = q.get("pages", "")
            note.tags = [f"topic::{topic['id']}"]
            col.add_note(note, deck)
            n_added += 1
            added += 1
        print(f"  {topic['id']:<12} {n_added:>4} 新增 / {topic['count']:>4} 题  →  {PARENT_DECK}::{topic['label']}")

    # 让父 deck 成为当前 deck，队列即可覆盖全部子 deck
    col.decks.select(parent)
    # 新卡必须按导入顺序（课程序）出队；Anki 默认的 deck/随机 gather order 会先出字母序靠后的专题
    cfg = col.decks.config_dict_for_deck_id(parent)
    cfg["newGatherPriority"] = 1  # LOWEST_POSITION
    cfg["newSortOrder"] = 1       # NO_SORT
    col.decks.update_config(cfg)

    total = len(existing_qids(col))
    print(f"\n新增 {added}，跳过已存在 {skipped}，collection 内共 {total} 个 note")
    print(f"collection: {COLL_PATH}")
    col.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
