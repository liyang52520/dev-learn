"""归档 / 标签 / 分类的聚合逻辑。"""

from __future__ import annotations

from collections import Counter

from app.core.pagination import ApiModel
from app.features.posts import service
from app.features.posts.schemas import PostMeta


class YearGroup(ApiModel):
    year: str
    count: int
    posts: list[PostMeta]


class Archive(ApiModel):
    total: int
    years: list[YearGroup]


class TermCount(ApiModel):
    name: str
    count: int


def archive() -> Archive:
    posts = service.list_posts("posts")
    groups: dict[str, list[PostMeta]] = {}
    for post in posts:
        groups.setdefault(post.display_date[:4], []).append(post)
    years = [
        YearGroup(year=year, count=len(items), posts=items)
        for year, items in sorted(groups.items(), key=lambda item: item[0], reverse=True)
    ]
    return Archive(total=len(posts), years=years)


def _counts(values: list[str]) -> list[TermCount]:
    counter = Counter(values)
    return [
        TermCount(name=name, count=count)
        for name, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    ]


def tags() -> list[TermCount]:
    posts = service.list_posts("posts")
    return _counts([tag for post in posts for tag in post.tags])


def categories() -> list[TermCount]:
    posts = service.list_posts("posts")
    return _counts([category for post in posts for category in post.categories])


def by_tag(tag: str) -> list[PostMeta]:
    return [post for post in service.list_posts("posts") if tag in post.tags]


def by_category(category: str) -> list[PostMeta]:
    return [post for post in service.list_posts("posts") if category in post.categories]
