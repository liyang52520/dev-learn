"""图片上传：扩展名 + 解码双重校验，按年月落盘。"""

from __future__ import annotations

import io
import time
import uuid

from PIL import Image

from app.core.config import settings
from app.core.errors import AppError
from app.core.paths import safe_join

_ALLOWED = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
_MAX_SIDE = 12000


def save_upload(filename: str, content_type: str, data: bytes) -> str:
    if len(data) > settings.max_upload_bytes:
        raise AppError("图片超过 20 MB", code="too_large", status=413)
    suffix = _ALLOWED.get(content_type.split(";")[0].strip().lower(), "")
    if not suffix:
        raise AppError("仅支持 png / jpeg / webp / gif", code="unsupported_type", status=415)
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            width, height = image.size
    except Exception as exc:
        raise AppError("图片无法解析", code="invalid_image", status=400) from exc
    if width > _MAX_SIDE or height > _MAX_SIDE:
        raise AppError("图片尺寸过大", code="invalid_image", status=400)
    now = time.localtime()
    year, month = f"{now.tm_year:04d}", f"{now.tm_mon:02d}"
    directory = safe_join(settings.public_dir, "images", "uploads", year, month)
    directory.mkdir(parents=True, exist_ok=True)
    name = f"{int(time.time())}-{uuid.uuid4().hex[:8]}{suffix}"
    target = safe_join(directory, name)
    target.write_bytes(data)
    return f"/images/uploads/{year}/{month}/{name}"


def original_name(filename: str) -> str:
    return filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
