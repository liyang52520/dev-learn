"""路径拼接的安全边界：任何越界、隐藏文件与分隔符都必须被拒绝。"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.paths import repo_root, safe_join


def test_accepts_plain_segments(tmp_path: Path) -> None:
    target = safe_join(tmp_path, "content", "posts", "hello.md")
    assert target == (tmp_path / "content" / "posts" / "hello.md").resolve()


def test_rejects_traversal_and_separators(tmp_path: Path) -> None:
    for segment in ("..", ".", "a/b", "a\\b", "", "/etc/passwd", "..\\win"):
        with pytest.raises(ValueError):
            safe_join(tmp_path, segment)


def test_rejects_hidden_segments(tmp_path: Path) -> None:
    for segment in (".git", ".env", ".trash"):
        with pytest.raises(ValueError):
            safe_join(tmp_path, segment)


def test_rejects_nul_byte(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        safe_join(tmp_path, "bad\x00name")


def test_stays_inside_base(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        safe_join(tmp_path / "posts", "..", "secret.md")


def test_repo_root_points_to_project() -> None:
    root = repo_root()
    assert (root / "backend" / "data" / "blog").is_dir()
    assert (root / "backend" / "data" / "study" / "index.json").is_file()
