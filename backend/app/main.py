"""应用装配：只做 include 与生命周期管理，不放业务逻辑。"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.errors import install_error_handlers
from app.core.logging import RequestLogMiddleware, configure_logging
from app.features.auth.router import router as auth_router
from app.features.blog.router import router as blog_router
from app.features.media.router import router as media_router
from app.features.posts.router_admin import router as posts_admin_router
from app.features.posts.router_public import router as posts_router
from app.features.review import collection as review_collection
from app.features.review.router import router as review_router
from app.features.review.router_admin import router as review_admin_router
from app.features.search.router import router as search_router
from app.features.study.router_public import router as study_router
from app.serving import mount_site


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    review_collection.close()


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(
        title="dev-learn",
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
        lifespan=lifespan,
    )
    install_error_handlers(app)
    app.add_middleware(RequestLogMiddleware)
    _include_routers(app)
    mount_site(app)
    return app


def _include_routers(app: FastAPI) -> None:
    @app.get("/api/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for router in (
        posts_router,
        posts_admin_router,
        blog_router,
        study_router,
        search_router,
        auth_router,
        media_router,
        review_router,
        review_admin_router,
    ):
        app.include_router(router)


app = create_app()
