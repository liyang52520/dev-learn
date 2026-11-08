"""后台数据备份接口。"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import guard_admin
from app.features.backup import service, status
from app.features.backup.schemas import (
    BackupBranchRequest,
    BackupRef,
    BackupResolveRequest,
    BackupRestoreRequest,
    BackupResult,
    BackupStatus,
)

router = APIRouter(prefix="/api/admin/backup", tags=["admin"], dependencies=[Depends(guard_admin)])


@router.get("/status", response_model=BackupStatus)
def read_status() -> BackupStatus:
    return status.read()


@router.post("/fetch", response_model=BackupResult)
def fetch_remote() -> BackupResult:
    return service.fetch_remote()


@router.post("/push", response_model=BackupResult)
def push() -> BackupResult:
    return service.push()


@router.post("/merge", response_model=BackupResult)
def merge(payload: BackupBranchRequest) -> BackupResult:
    return service.merge(payload.branch)


@router.post("/resolve", response_model=BackupResult)
def resolve(payload: BackupResolveRequest) -> BackupResult:
    return service.resolve(dict(payload.resolutions))


@router.post("/abort", response_model=BackupResult)
def abort() -> BackupResult:
    return service.abort()


@router.post("/overwrite", response_model=BackupResult)
def overwrite(payload: BackupBranchRequest) -> BackupResult:
    return service.overwrite(payload.branch)


@router.get("/refs", response_model=list[BackupRef])
def refs() -> list[BackupRef]:
    return status.safety_refs()


@router.post("/restore", response_model=BackupResult)
def restore(payload: BackupRestoreRequest) -> BackupResult:
    return service.restore(payload.ref)
