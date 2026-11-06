"""上传接口。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile

from app.core.config import settings
from app.core.pagination import ApiModel
from app.core.security import guard_admin
from app.features.media import service

router = APIRouter(prefix="/api/admin", tags=["media"], dependencies=[Depends(guard_admin)])


class UploadResponse(ApiModel):
    url: str


@router.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...)) -> UploadResponse:
    # 多读 1 字节用于判断超限，避免把超大文件整个读进内存。
    data = await file.read(settings.max_upload_bytes + 1)
    url = service.save_upload(
        service.original_name(file.filename or "upload"),
        file.content_type or "",
        data,
    )
    return UploadResponse(url=url)
