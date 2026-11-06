"""读者侧题库接口。"""

from __future__ import annotations

from fastapi import APIRouter

from app.features.study import service
from app.features.study.schemas import QuestionDetail, StudyIndexResponse, TopicDetail

router = APIRouter(prefix="/api/study", tags=["study"])


@router.get("", response_model=StudyIndexResponse)
def list_topics() -> StudyIndexResponse:
    return service.list_topics()


@router.get("/{topic_id}", response_model=TopicDetail)
def get_topic(topic_id: str) -> TopicDetail:
    return service.topic_detail(topic_id)


@router.get("/{topic_id}/{qid}", response_model=QuestionDetail)
def get_question(topic_id: str, qid: str) -> QuestionDetail:
    return service.get_question(topic_id, qid)
