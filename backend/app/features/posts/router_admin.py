"""后台文章接口：读写、发布、预览。"""

from __future__ import annotations

from typing import Literal, cast

from fastapi import APIRouter, Depends

from app.core.errors import AppError
from app.core.pagination import ApiModel
from app.core.security import guard_admin
from app.features.posts import service
from app.features.posts.schemas import (
    CreatePostRequest,
    PostMeta,
    PostType,
    PreviewRequest,
    RawPost,
    SavePostRequest,
    TocItem,
)
from app.rendering.markdown import render_markdown

router = APIRouter(prefix="/api/admin", tags=["admin-posts"], dependencies=[Depends(guard_admin)])

PostTypePath = Literal["posts", "drafts"]


class PostListResponse(ApiModel):
    posts: list[PostMeta]
    drafts: list[PostMeta]


class RawPostResponse(ApiModel):
    post: RawPost
    type: PostType


class PublishResponse(ApiModel):
    ok: bool = True
    slug: str
    type: PostType


class PreviewResponse(ApiModel):
    html: str
    toc: list[TocItem]


@router.get("/posts", response_model=PostListResponse)
def list_all(status: str = "", q: str = "") -> PostListResponse:
    posts = service.list_posts("posts")
    drafts = service.list_posts("drafts")
    keyword = q.strip().lower()
    if keyword:

        def match(post: PostMeta) -> bool:
            haystack = " ".join([post.title, *post.tags, *post.categories]).lower()
            return keyword in haystack

        posts = [post for post in posts if match(post)]
        drafts = [post for post in drafts if match(post)]
    if status in {"posts", "drafts"}:
        return PostListResponse(
            posts=posts if status == "posts" else [],
            drafts=drafts if status == "drafts" else [],
        )
    return PostListResponse(posts=posts, drafts=drafts)


@router.get("/posts/{post_type}/{slug}", response_model=RawPostResponse)
def get_raw(post_type: PostTypePath, slug: str) -> RawPostResponse:
    post = service.raw_post(post_type, slug)
    if post is None:
        raise AppError("文章不存在", code="not_found", status=404)
    return RawPostResponse(
        post=RawPost(meta=post.meta, front=post.front, body=post.body), type=post_type
    )


@router.post("/posts", response_model=RawPost, status_code=201)
def create_post(payload: CreatePostRequest) -> RawPost:
    if not payload.title.strip():
        raise AppError("标题不能为空", code="invalid_params", status=400)
    created = service.create_post(payload.title.strip())
    return RawPost(meta=created.meta, front=created.front, body=created.body)


@router.put("/posts/{post_type}/{slug}", response_model=dict[str, bool])
def save_post(post_type: PostTypePath, slug: str, payload: SavePostRequest) -> dict[str, bool]:
    if not payload.front.title.strip():
        raise AppError("标题不能为空", code="invalid_params", status=400)
    if payload.type != post_type:
        raise AppError("类型不一致", code="invalid_params", status=400)
    service.save_post(post_type, slug, payload.front, payload.body)
    return {"ok": True}


@router.post("/posts/{post_type}/{slug}/publish", response_model=PublishResponse)
def publish(post_type: PostTypePath, slug: str) -> PublishResponse:
    result = service.publish(slug) if post_type == "drafts" else ("posts", slug)
    if result is None:
        raise AppError("文章不存在", code="not_found", status=404)
    return PublishResponse(slug=result[1], type=cast(PostType, result[0]))


@router.post("/posts/{post_type}/{slug}/unpublish", response_model=PublishResponse)
def unpublish(post_type: PostTypePath, slug: str) -> PublishResponse:
    result = service.unpublish(slug) if post_type == "posts" else ("drafts", slug)
    if result is None:
        raise AppError("文章不存在", code="not_found", status=404)
    return PublishResponse(slug=result[1], type=cast(PostType, result[0]))


@router.delete("/posts/{post_type}/{slug}", response_model=dict[str, bool])
def delete_post(post_type: PostTypePath, slug: str) -> dict[str, bool]:
    if not service.delete_post(post_type, slug):
        raise AppError("文章不存在", code="not_found", status=404)
    return {"ok": True}


@router.post("/preview", response_model=PreviewResponse)
def preview(payload: PreviewRequest) -> PreviewResponse:
    rendered = render_markdown(payload.body)
    toc = [TocItem(depth=item.depth, text=item.text, id=item.id) for item in rendered.toc]
    return PreviewResponse(html=rendered.html, toc=toc)
