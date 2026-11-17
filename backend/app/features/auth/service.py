"""登录业务：密码校验、首次设置、失败限流、会话 cookie。"""

from __future__ import annotations

import hmac
import threading

from fastapi import Response

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import issue_token, login_limiter
from app.features.auth import repository

MIN_PASSWORD_LENGTH = 8
_setup_lock = threading.Lock()


def needs_setup() -> bool:
    """没配环境变量密码、本地也没设置过密码时，说明是第一次进入系统。"""
    return not settings.admin_password and not repository.has_password()


def password_matches(password: str) -> bool:
    """环境变量优先；未设置时校验首次初始化写入的密码文件。"""
    if settings.admin_password:
        return hmac.compare_digest(password, settings.admin_password)
    return repository.verify(password)


def start_session(response: Response) -> None:
    response.set_cookie(
        settings.cookie_name,
        issue_token(),
        max_age=settings.cookie_max_age,
        httponly=True,
        samesite="lax",
        path="/",
    )


def _client_key(host: str) -> str:
    return host or "local"


def login(response: Response, password: str, client_host: str) -> None:
    if needs_setup():
        raise AppError("请先设置访问密码", code="password_not_set", status=409)
    key = _client_key(client_host)
    login_limiter.check(key)
    if not password_matches(password):
        login_limiter.fail(key)
        raise AppError("密码不正确", code="invalid_credentials", status=401)
    login_limiter.reset(key)
    start_session(response)


def setup(response: Response, password: str) -> None:
    """首次初始化：写入密码并直接登录；已配置后不再允许通过页面修改。"""
    if settings.admin_password:
        raise AppError(
            "密码已由 ADMIN_PASSWORD 环境变量配置，页面不能设置",
            code="password_locked",
            status=409,
        )
    if len(password) < MIN_PASSWORD_LENGTH:
        raise AppError(
            f"密码至少 {MIN_PASSWORD_LENGTH} 位",
            code="weak_password",
            status=400,
            fields={"password": f"至少 {MIN_PASSWORD_LENGTH} 位"},
        )
    with _setup_lock:
        if repository.has_password():
            raise AppError("密码已设置，请直接登录", code="already_initialized", status=409)
        repository.write(password)
    start_session(response)


def logout(response: Response) -> None:
    response.delete_cookie(settings.cookie_name, path="/")
