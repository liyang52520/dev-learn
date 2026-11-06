"""生产环境的静态资源与 SPA 回退。"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.errors import error_body
from app.core.paths import safe_join


def mount_site(app: FastAPI) -> None:
    images = settings.public_dir / "images"
    if images.is_dir():
        app.mount("/images", StaticFiles(directory=images), name="images")
    assets = settings.dist_dir / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")
    _mount_spa(app)
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.middleware("http")(_immutable_assets)


def _mount_spa(app: FastAPI) -> None:
    index_file = settings.dist_dir / "index.html"

    @app.get("/study/{path:path}", include_in_schema=False, response_model=None)
    def study_asset(path: str) -> FileResponse | JSONResponse:
        """`/study/**` 既放证据截图，也放前端路由，只能按文件是否存在分流。"""
        target = _study_file(path)
        if target is not None:
            return FileResponse(target, headers={"cache-control": "public, max-age=604800"})
        return _spa_response(index_file)

    @app.get("/{path:path}", include_in_schema=False, response_model=None)
    def spa(path: str) -> FileResponse | JSONResponse:
        if path.startswith(("api/", "assets/")):
            return JSONResponse(error_body("not_found", "接口不存在"), status_code=404)
        return _spa_response(index_file)


def _study_file(path: str) -> Path | None:
    parts = [part for part in path.split("/") if part]
    if not parts:
        return None
    try:
        target = safe_join(settings.public_dir / "study", *parts)
    except ValueError:
        return None
    return target if target.is_file() else None


def _spa_response(index_file: Path) -> FileResponse | JSONResponse:
    if index_file.is_file():
        return FileResponse(index_file, headers={"cache-control": "no-cache"})
    return JSONResponse(
        error_body("not_built", "前端尚未构建：请在 frontend 目录执行 npm run build"),
        status_code=503,
    )


async def _immutable_assets(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    if request.url.path.startswith("/assets/"):
        response.headers["cache-control"] = "public, max-age=31536000, immutable"
    return response
