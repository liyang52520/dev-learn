"""分页参数与响应模型。"""

from __future__ import annotations

from fastapi import Query
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class PageQuery(BaseModel):
    page: int = 1
    limit: int = 8


def page_query(
    page: int = Query(1, ge=1),
    limit: int = Query(8, ge=1, le=50),
) -> PageQuery:
    return PageQuery(page=page, limit=limit)


class Page[T](ApiModel):
    items: list[T]
    page: int
    limit: int
    total: int
    has_next: bool
