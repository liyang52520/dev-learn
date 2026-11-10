"""后台题库编辑接口。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from app.core.config import settings
from app.core.security import guard_admin
from app.features.study import admin_service
from app.features.study.admin_schemas import (
    AdminQuestion,
    BankListResponse,
    CreateQuestionRequest,
    DeleteQuestionResponse,
    EvidenceUploadResponse,
    QuestionMutationResponse,
    QuestionWrite,
)

router = APIRouter(
    prefix="/api/admin/study", tags=["admin-study"], dependencies=[Depends(guard_admin)]
)


@router.get("/bank", response_model=BankListResponse)
def read_bank(
    topic: str = "",
    q: str = "",
    limit: int = Query(400, ge=1, le=400),
) -> BankListResponse:
    return admin_service.list_bank(topic, q, limit)


@router.get("/bank/questions/{topic_id}/{qid}", response_model=AdminQuestion)
def read_question(topic_id: str, qid: str) -> AdminQuestion:
    return admin_service.get_question(topic_id, qid)


@router.post("/bank/questions", response_model=QuestionMutationResponse, status_code=201)
def create_question(payload: CreateQuestionRequest) -> QuestionMutationResponse:
    return admin_service.create_question(payload)


@router.put("/bank/questions/{topic_id}/{qid}", response_model=QuestionMutationResponse)
def update_question(topic_id: str, qid: str, payload: QuestionWrite) -> QuestionMutationResponse:
    return admin_service.update_question(topic_id, qid, payload)


@router.delete("/bank/questions/{topic_id}/{qid}", response_model=DeleteQuestionResponse)
def delete_question(topic_id: str, qid: str) -> DeleteQuestionResponse:
    return admin_service.delete_question(topic_id, qid)


@router.post("/bank/{topic_id}/upload", response_model=EvidenceUploadResponse)
async def upload_evidence(
    topic_id: str,
    no: int = Form(...),
    group: int = Form(...),
    page: int = Form(...),
    file: UploadFile = File(...),
) -> EvidenceUploadResponse:
    data = await file.read(settings.max_upload_bytes + 1)
    return admin_service.upload_evidence(topic_id, no, group, page, file.content_type or "", data)
