"""登录接口。"""

from __future__ import annotations

from fastapi import APIRouter, Request, Response
from pydantic import Field

from app.core.config import settings
from app.core.pagination import ApiModel
from app.core.security import check_origin, verify_token
from app.features.auth import service

router = APIRouter(prefix="/api/admin/auth", tags=["auth"])


class LoginRequest(ApiModel):
    password: str = Field(min_length=1, max_length=200)


class AuthState(ApiModel):
    authenticated: bool


@router.post("/login", response_model=AuthState)
def login(payload: LoginRequest, request: Request, response: Response) -> AuthState:
    check_origin(request)
    host = request.client.host if request.client else ""
    service.login(response, payload.password, host)
    response.headers["Cache-Control"] = "no-store"
    return AuthState(authenticated=True)


@router.post("/logout", response_model=AuthState)
def logout(response: Response) -> AuthState:
    service.logout(response)
    return AuthState(authenticated=False)


@router.get("/me", response_model=AuthState)
def me(request: Request) -> AuthState:
    return AuthState(authenticated=verify_token(request.cookies.get(settings.cookie_name)))
