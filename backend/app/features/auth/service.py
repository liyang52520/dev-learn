"""登录业务：密码校验、失败限流、会话 cookie。"""

from __future__ import annotations

from fastapi import Response

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import issue_token, login_limiter, password_matches


def _client_key(host: str) -> str:
    return host or "local"


def login(response: Response, password: str, client_host: str) -> None:
    key = _client_key(client_host)
    login_limiter.check(key)
    if not password_matches(password):
        login_limiter.fail(key)
        raise AppError("密码不正确", code="invalid_credentials", status=401)
    login_limiter.reset(key)
    response.set_cookie(
        settings.cookie_name,
        issue_token(),
        max_age=settings.cookie_max_age,
        httponly=True,
        samesite="lax",
        path="/",
    )


def logout(response: Response) -> None:
    response.delete_cookie(settings.cookie_name, path="/")
