"""文章接口的输出契约。"""

from __future__ import annotations

from typing import Literal

from app.core.pagination import ApiModel

PostType = Literal["posts", "drafts"]


class TocItem(ApiModel):
    depth: int
    text: str
    id: str


class PostMeta(ApiModel):
    slug: str
    title: str
    date_raw: str
    date_iso: str
    display_date: str
    display_date_time: str
    tags: list[str]
    categories: list[str]
    excerpt: str
    cover: str
    reading_time: int
    type: PostType


class PostRef(ApiModel):
    slug: str
    title: str


class PostDetail(ApiModel):
    meta: PostMeta
    html: str
    toc: list[TocItem]
    prev: PostRef | None = None
    next: PostRef | None = None


class FrontMatter(ApiModel):
    title: str
    date: str
    tags: list[str] = []
    categories: list[str] = []
    description: str = ""
    cover: str = ""


class RawPost(ApiModel):
    meta: PostMeta
    front: FrontMatter
    body: str


class SavePostRequest(ApiModel):
    type: PostType
    front: FrontMatter
    body: str = ""


class CreatePostRequest(ApiModel):
    title: str


class PreviewRequest(ApiModel):
    body: str = ""
