"""结构规则检查：行数、分层依赖、禁用命名与前端直连 fetch。

用法：python backend/scripts/check_structure.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend" / "app"
FRONTEND = ROOT / "frontend" / "src"
OWN_FEATURE = re.compile(r"^from app\.features\.([a-z_]+)\.(repository|router[a-z_]*) import", re.M)
ANY_FEATURE = re.compile(r"from app\.features\.([a-z_]+)")
FORBIDDEN = re.compile(r"^(utils|helpers|common|misc)([._/]|$)")
SKIP_DIRS = {"__pycache__", "node_modules", "dist", "tests"}
SKIP_FILES = {"api.d.ts"}

problems: list[str] = []


def files(base: Path, suffixes: tuple[str, ...]) -> list[Path]:
    if not base.is_dir():
        return []
    return [
        path
        for path in base.rglob("*")
        if path.is_file()
        and path.suffix in suffixes
        and not SKIP_DIRS.intersection(path.parts)
        and path.name not in SKIP_FILES
    ]


def line_limit(path: Path) -> int:
    if path.name.endswith("Page.tsx"):
        return 150
    if path.suffix == ".tsx":
        return 200
    return 300


def check_sizes() -> None:
    for path in [*files(BACKEND, (".py",)), *files(FRONTEND, (".ts", ".tsx", ".css"))]:
        count = len(path.read_text(encoding="utf-8").splitlines())
        limit = line_limit(path)
        if count > limit:
            problems.append(f"{path.relative_to(ROOT)}: {count} 行 > {limit}")


def check_names() -> None:
    for path in [*BACKEND.rglob("*"), *FRONTEND.rglob("*")]:
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if FORBIDDEN.match(path.stem):
            problems.append(f"{path.relative_to(ROOT)}: 禁用命名（utils/helpers/common/misc）")


def check_layers() -> None:
    for path in files(BACKEND, (".py",)):
        text = path.read_text(encoding="utf-8")
        if "rendering" in path.parts and ANY_FEATURE.search(text):
            problems.append(f"{path.relative_to(ROOT)}: rendering 不得 import features")
        rel = path.relative_to(BACKEND).parts
        if rel[0] != "features" or len(rel) < 3:
            continue
        owner = rel[1]
        for match in OWN_FEATURE.finditer(text):
            if match.group(1) != owner:
                problems.append(
                    f"{path.relative_to(ROOT)}: 跨 feature 直接 import {match.group(1)}.{match.group(2)}"
                )


def check_fetch() -> None:
    for path in files(FRONTEND, (".ts", ".tsx")):
        if path.name.startswith(("client.", "client.test.")):
            continue
        if re.search(r"\bfetch\(", path.read_text(encoding="utf-8")):
            problems.append(f"{path.relative_to(ROOT)}: 组件/页面不得直接 fetch")


def main() -> int:
    check_sizes()
    check_names()
    check_layers()
    check_fetch()
    if problems:
        print("\n".join(f"FAIL {item}" for item in problems))
        return 1
    print("OK 结构规则全部通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
