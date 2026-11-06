"""检索接口。"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.pagination import ApiModel
from app.features.search import service

router = APIRouter(prefix="/api", tags=["search"])


class SearchResponse(ApiModel):
    results: list[service.SearchResult]


@router.get("/search", response_model=SearchResponse)
def search(q: str = Query("", max_length=120)) -> SearchResponse:
    return SearchResponse(results=service.search_all(q))
