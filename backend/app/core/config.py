"""运行配置：只读环境变量，不依赖任何业务模块。"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from app.core.paths import repo_root


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "")
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    root: Path = field(default_factory=repo_root)
    admin_password: str = field(
        default_factory=lambda: os.environ.get("ADMIN_PASSWORD", "yg-admin")
    )
    cookie_name: str = "yg_admin"
    cookie_max_age: int = 60 * 60 * 24 * 7
    secret: str = field(
        default_factory=lambda: os.environ.get("APP_SECRET", "dev-learn-local-secret")
    )
    page_size: int = 8
    search_limit: int = 16
    max_upload_bytes: int = 20 * 1024 * 1024
    login_max_failures: int = field(default_factory=lambda: _env_int("LOGIN_MAX_FAILURES", 8))
    login_lock_seconds: int = field(default_factory=lambda: _env_int("LOGIN_LOCK_SECONDS", 120))

    @property
    def backend_dir(self) -> Path:
        return self.root / "backend"

    @property
    def content_dir(self) -> Path:
        return self.backend_dir / "data" / "content"

    @property
    def study_dir(self) -> Path:
        return self.backend_dir / "data" / "study"

    @property
    def public_dir(self) -> Path:
        return self.root / "frontend" / "public"

    @property
    def dist_dir(self) -> Path:
        return self.root / "frontend" / "dist"

    @property
    def anki_dir(self) -> Path:
        return self.backend_dir / "anki-svc" / "data"

    @property
    def trash_dir(self) -> Path:
        return self.backend_dir / ".trash"


settings = Settings()
