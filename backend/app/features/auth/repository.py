"""管理员密码文件：首次在登录页设置后落盘，供后续登录校验。

密码只保存 PBKDF2 派生值，不保存明文。文件放在数据目录（独立仓库 dev-anki）
的 `auth/admin.json`，随数据备份一起同步到自己的机器。
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import threading
from pathlib import Path
from typing import Any

from app.core.config import settings

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 600_000
_lock = threading.Lock()


def _path() -> Path:
    return settings.data_dir / "auth" / "admin.json"


def _read() -> dict[str, Any] | None:
    try:
        raw = _path().read_text(encoding="utf-8")
    except (FileNotFoundError, OSError):
        return None
    try:
        record = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    if not isinstance(record, dict) or record.get("algorithm") != ALGORITHM:
        return None
    if not isinstance(record.get("salt"), str) or not isinstance(record.get("hash"), str):
        return None
    iterations = record.get("iterations")
    if not isinstance(iterations, int) or iterations <= 0:
        return None
    return record


def has_password() -> bool:
    return _read() is not None


def verify(password: str) -> bool:
    record = _read()
    if record is None:
        return False
    salt = bytes.fromhex(record["salt"])
    expected = record["hash"]
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, record["iterations"])
    return hmac.compare_digest(digest.hex(), expected)


def write(password: str) -> None:
    """原子写入新密码；已有文件会被覆盖（仅初始化流程调用）。"""
    path = _path()
    path.parent.mkdir(parents=True, exist_ok=True)
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
    record = {
        "algorithm": ALGORITHM,
        "iterations": ITERATIONS,
        "salt": salt.hex(),
        "hash": digest.hex(),
    }
    tmp = path.with_name(f"{path.name}.tmp")
    with _lock:
        tmp.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, path)
