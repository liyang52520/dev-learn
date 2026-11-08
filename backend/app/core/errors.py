"""统一错误形状：{"error": {"code", "message", "fields"}}。"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("app.error")


class AppError(Exception):
    def __init__(
        self,
        message: str,
        *,
        code: str = "bad_request",
        status: int = 400,
        fields: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status
        self.fields = fields or {}


def error_body(code: str, message: str, fields: dict[str, str] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "fields": fields or {}}}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(error_body(exc.code, exc.message, exc.fields), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = {
            ".".join(str(part) for part in item["loc"][1:]): item["msg"] for item in exc.errors()
        }
        return JSONResponse(
            error_body("invalid_params", "参数校验失败", fields),
            status_code=422,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        message = str(exc.detail) if exc.detail else "请求失败"
        code = {401: "unauthorized", 403: "forbidden", 404: "not_found"}.get(
            exc.status_code, "http_error"
        )
        return JSONResponse(error_body(code, message), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception) -> JSONResponse:
        log.exception("未处理的异常：%s %s", request.method, request.url.path)
        return JSONResponse(
            error_body("internal_error", "服务内部错误，请稍后重试"),
            status_code=500,
        )
