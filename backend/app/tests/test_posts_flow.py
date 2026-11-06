"""文章增删改发布流程：在临时内容目录里跑完整生命周期。"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pytest

from app.features.posts import repository, service
from app.features.posts.schemas import FrontMatter


@dataclass(frozen=True)
class _TempSettings:
    root: Path
    page_size: int = 8

    @property
    def content_dir(self) -> Path:
        return self.root / "data" / "content"

    @property
    def trash_dir(self) -> Path:
        return self.root / ".trash"


@pytest.fixture()
def posts(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> _TempSettings:
    settings = _TempSettings(root=tmp_path)
    monkeypatch.setattr(repository, "settings", settings)
    monkeypatch.setattr(service, "settings", settings)
    service._invalidate()
    (tmp_path / "data" / "content" / "posts").mkdir(parents=True)
    (tmp_path / "data" / "content" / "drafts").mkdir(parents=True)
    return settings


def test_create_draft_uses_slug_and_avoids_conflicts(posts: _TempSettings) -> None:
    first = service.create_post("测试 标题")
    second = service.create_post("测试 标题")
    assert first.meta.slug == "测试-标题"
    assert second.meta.slug == "测试-标题-2"
    assert sorted(repository.list_names("drafts")) == ["测试-标题-2.md", "测试-标题.md"]
    assert first.meta.type == "drafts"


def test_save_publish_unpublish_delete(posts: _TempSettings) -> None:
    draft = service.create_post("流程")
    slug = draft.meta.slug
    service.save_post(
        "drafts",
        slug,
        FrontMatter(
            title="流程",
            date="2024-05-01 10:00:00",
            tags=["t"],
            categories=["c"],
            description="说明",
        ),
        "## 正文\n\n内容\n",
    )
    saved = service.raw_post("drafts", slug)
    assert saved is not None
    assert saved.front.tags == ["t"]
    assert "内容" in saved.body

    assert service.publish(slug) == ("posts", slug)
    published = service.get_published_detail(slug)
    assert published is not None
    assert "正文" in published.html
    assert published.toc[0].id == "正文"
    assert service.raw_post("drafts", slug) is None

    assert service.unpublish(slug) == ("drafts", slug)
    assert service.raw_post("drafts", slug) is not None
    assert service.raw_post("posts", slug) is None

    assert service.delete_post("drafts", slug) is True
    assert service.delete_post("drafts", slug) is False
    trashed = list((posts.root / ".trash" / "drafts").glob("*.md"))
    assert len(trashed) == 1


def test_publish_never_overwrites_existing_slug(posts: _TempSettings) -> None:
    draft = service.create_post("同名")
    slug = draft.meta.slug
    repository.write("posts", slug, "---\ntitle: 已存在\ndate: 2024-01-01\n---\n\n旧文\n")
    moved = service.publish(slug)
    assert moved is not None
    assert moved[1] != slug
    assert service.raw_post("posts", slug) is not None
    assert service.raw_post("drafts", slug) is None


def test_list_posts_sorted_by_date_desc(posts: _TempSettings) -> None:
    for index, day in enumerate(["2024-01-01", "2024-03-01", "2024-02-01"]):
        repository.write(
            "posts",
            f"p{index}",
            f"---\ntitle: p{index}\ndate: {day} 08:00:00\n---\n\n正文\n",
        )
    service._invalidate()
    slugs = [meta.slug for meta in service.list_posts("posts")]
    assert slugs == ["p1", "p2", "p0"]


def test_stats_counts_published_only(posts: _TempSettings) -> None:
    repository.write(
        "posts",
        "a",
        "---\ntitle: a\ndate: 2024-01-01\ntags: [x]\ncategories: [y]\n---\n\n正文\n",
    )
    repository.write(
        "drafts",
        "b",
        "---\ntitle: b\ndate: 2024-01-02\ntags: [z]\n---\n\n正文\n",
    )
    service._invalidate()
    stats = service.blog_stats()
    assert (stats.posts, stats.drafts, stats.tags, stats.categories) == (1, 1, 1, 1)
