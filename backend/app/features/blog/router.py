"""读者侧归档 / 标签 / 分类接口。"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.pagination import ApiModel
from app.features.blog import service
from app.features.posts.schemas import PostMeta

router = APIRouter(prefix="/api/blog", tags=["blog"])


class TermsResponse(ApiModel):
    items: list[service.TermCount]


class FilterResponse(ApiModel):
    name: str
    total: int
    items: list[PostMeta]


@router.get("/archive", response_model=service.Archive)
def archive() -> service.Archive:
    return service.archive()


@router.get("/tags", response_model=TermsResponse)
def tags() -> TermsResponse:
    return TermsResponse(items=service.tags())


@router.get("/tags/{tag}", response_model=FilterResponse)
def by_tag(tag: str) -> FilterResponse:
    posts = service.by_tag(tag)
    return FilterResponse(name=tag, total=len(posts), items=posts)


@router.get("/categories", response_model=TermsResponse)
def categories() -> TermsResponse:
    return TermsResponse(items=service.categories())


@router.get("/categories/{category}", response_model=FilterResponse)
def by_category(category: str) -> FilterResponse:
    posts = service.by_category(category)
    return FilterResponse(name=category, total=len(posts), items=posts)
