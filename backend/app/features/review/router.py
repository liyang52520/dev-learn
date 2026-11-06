"""复习页接口：取卡、评分、撤销、统计与原文答案。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.security import check_origin
from app.features.review import service
from app.features.review.schemas import (
    AnswerPayload,
    AnswerResult,
    CardAnswer,
    LapseList,
    ReviewConfig,
    ReviewQueue,
    ReviewStats,
    UndoResult,
)

router = APIRouter(prefix="/api/review", tags=["review"])


@router.get("/queue", response_model=ReviewQueue)
def get_queue(limit: int = Query(1, ge=1, le=20)) -> ReviewQueue:
    return service.queue(limit)


@router.get("/stats", response_model=ReviewStats)
def get_stats() -> ReviewStats:
    return service.stats()


@router.get("/config", response_model=ReviewConfig)
def get_config() -> ReviewConfig:
    return service.config()


@router.get("/lapses", response_model=LapseList)
def get_lapses() -> LapseList:
    return service.lapses()


@router.get("/card-answer", response_model=CardAnswer)
def get_card_answer(qid: str = Query(min_length=1)) -> CardAnswer:
    return service.card_answer(qid)


@router.post("/answer", response_model=AnswerResult, dependencies=[Depends(check_origin)])
def post_answer(payload: AnswerPayload) -> AnswerResult:
    return service.answer(payload)


@router.post("/undo", response_model=UndoResult, dependencies=[Depends(check_origin)])
def post_undo() -> UndoResult:
    return service.undo()
