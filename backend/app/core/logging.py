"""请求日志：给每个请求一个 id，慢请求单独标注。"""

from __future__ import annotations

import logging
import time
import uuid
from typing import cast

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("dev_learn")

SLOW_SECONDS = 1.0


def configure_logging() -> None:
    if logger.handlers:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
        request_id = uuid.uuid4().hex[:8]
        started = time.perf_counter()
        response = cast(Response, await call_next(request))
        elapsed = (time.perf_counter() - started) * 1000
        response.headers["X-Request-Id"] = request_id
        level = logging.WARNING if elapsed > SLOW_SECONDS * 1000 else logging.INFO
        logger.log(
            level,
            "%s %s %s %.0fms req=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed,
            request_id,
        )
        return response
