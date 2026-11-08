"""登录态、CSRF 与登录限流。"""

from __future__ import annotations

import hmac
import time
from dataclasses import dataclass
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response
from itsdangerous import BadSignature, URLSafeTimedSerializer
from starlette.requests import Request

from app.core.config import settings
from app.core.errors import AppError, error_body

_serializer = URLSafeTimedSerializer(settings.secret, salt="yg-site")


def issue_token() -> str:
    return _serializer.dumps("admin")


def verify_token(token: str | None) -> bool:
    if not token:
        return False
    try:
        _serializer.loads(token, max_age=settings.cookie_max_age)
    except BadSignature:
        return False
    return True


def password_matches(password: str) -> bool:
    return hmac.compare_digest(password, settings.admin_password)


def require_admin(request: Request) -> None:
    if not verify_token(request.cookies.get(settings.cookie_name)):
        raise AppError("未登录", code="unauthorized", status=401)


def check_origin(request: Request) -> None:
    """写操作必须来自同源页面；没有 Origin 的本地工具请求放行。"""
    origin = request.headers.get("origin")
    if not origin:
        return
    host = request.headers.get("host", "")
    if not host:
        raise AppError("缺少 Host", code="forbidden", status=403)
    if origin.split("://", 1)[-1] != host:
        raise AppError("跨站请求被拒绝", code="forbidden", status=403)


def guard_admin(request: Request) -> None:
    """后台接口统一守卫：登录态 + 写操作同源校验。"""
    require_admin(request)
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        check_origin(request)


@dataclass
class _Attempt:
    failures: int = 0
    locked_until: float = 0.0


class LoginLimiter:
    """进程内失败计数：单机自用，够挡住暴力尝试，也不需要额外依赖。"""

    def __init__(self) -> None:
        self._attempts: dict[str, _Attempt] = {}

    def check(self, key: str) -> None:
        attempt = self._attempts.get(key)
        if attempt and attempt.locked_until > time.time():
            wait = int(attempt.locked_until - time.time()) + 1
            raise AppError(f"尝试次数过多，请 {wait} 秒后再试", code="rate_limited", status=429)

    def fail(self, key: str) -> None:
        attempt = self._attempts.setdefault(key, _Attempt())
        attempt.failures += 1
        if attempt.failures >= settings.login_max_failures:
            attempt.failures = 0
            attempt.locked_until = time.time() + settings.login_lock_seconds

    def reset(self, key: str) -> None:
        self._attempts.pop(key, None)


login_limiter = LoginLimiter()


# 登录页本身要能加载：HTML / JS / CSS 放行，数据接口与图片才拦。
_PUBLIC_API = {
    "/api/health",
    "/api/admin/auth/login",
    "/api/admin/auth/logout",
    "/api/admin/auth/me",
}
_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}


def _requires_login(path: str, method: str) -> bool:
    if method == "OPTIONS":
        return False
    if path in _PUBLIC_API or path.startswith("/api/docs") or path == "/api/openapi.json":
        return False
    if path.startswith(("/assets/", "/images/")):
        return path.startswith("/images/")
    if path.startswith("/study/"):
        # /study/** 既放证据截图，也放前端路由；只有图片需要登录。
        return Path(path).suffix.lower() in _IMAGE_SUFFIXES
    return path.startswith("/api/")


def install_site_guard(app: FastAPI) -> None:
    """整站登录：除登录页所需资源外，所有数据接口与图片都要求有效 cookie。"""

    @app.middleware("http")
    async def _guard(request: Request, call_next):  # type: ignore[no-untyped-def]
        if _requires_login(request.url.path, request.method) and not verify_token(
            request.cookies.get(settings.cookie_name)
        ):
            if request.url.path.startswith("/api/"):
                return JSONResponse(error_body("unauthorized", "请先登录"), status_code=401)
            return Response(status_code=401)
        return await call_next(request)
