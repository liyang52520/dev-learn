"""后台学习设置：每日上限与统计。"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import guard_admin
from app.features.review import service
from app.features.review.schemas import ReviewConfig, ReviewConfigUpdate, ReviewStats

router = APIRouter(prefix="/api/admin/study", tags=["admin"], dependencies=[Depends(guard_admin)])


@router.get("/config", response_model=ReviewConfig)
def read_config() -> ReviewConfig:
    return service.config()


@router.post("/config", response_model=ReviewConfig)
def write_config(payload: ReviewConfigUpdate) -> ReviewConfig:
    return service.update_config(payload)


@router.get("/stats", response_model=ReviewStats)
def read_stats() -> ReviewStats:
    return service.stats()
