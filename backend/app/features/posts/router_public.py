"""读者侧文章接口。"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.errors import AppError
from app.core.pagination import Page
from app.features.posts import service
from app.features.posts.schemas import PostDetail, PostMeta

router = APIRouter(prefix="/api", tags=["posts"])


@router.get("/posts", response_model=Page[PostMeta])
def list_posts(page: int = Query(1, ge=1), limit: int = Query(8, ge=1, le=50)) -> Page[PostMeta]:
    posts = service.list_posts("posts")
    start = (page - 1) * limit
    items = posts[start : start + limit]
    return Page[PostMeta](
        items=items,
        page=page,
        limit=limit,
        total=len(posts),
        has_next=start + limit < len(posts),
    )


@router.get("/posts/{slug}", response_model=PostDetail)
def get_post(slug: str) -> PostDetail:
    detail = service.get_published_detail(slug)
    if detail is None:
        raise AppError("文章不存在", code="not_found", status=404)
    return detail
