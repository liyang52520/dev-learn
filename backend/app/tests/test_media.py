"""图片上传：类型、体积、解码校验与落盘路径。"""

from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

import pytest
from PIL import Image

from app.core.errors import AppError
from app.features.media import service


@dataclass(frozen=True)
class _TempSettings:
    public_dir: Path
    max_upload_bytes: int = 20 * 1024 * 1024


@pytest.fixture()
def media(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> _TempSettings:
    settings = _TempSettings(public_dir=tmp_path / "public")
    monkeypatch.setattr(service, "settings", settings)
    return settings


def _png(size: tuple[int, int] = (4, 3)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (10, 20, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_saves_valid_png(media: _TempSettings) -> None:
    url = service.save_upload("a.png", "image/png", _png())
    assert url.startswith("/images/uploads/")
    assert url.endswith(".png")
    stored = media.public_dir / url.lstrip("/")
    assert stored.is_file()
    assert stored.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"
    assert Image.open(stored).size == (4, 3)


def test_accepts_content_type_with_charset(media: _TempSettings) -> None:
    url = service.save_upload("a.png", "image/png; charset=binary", _png())
    assert url.endswith(".png")


def test_rejects_unsupported_type(media: _TempSettings) -> None:
    with pytest.raises(AppError) as error:
        service.save_upload("a.svg", "image/svg+xml", b"<svg/>")
    assert error.value.status == 415


def test_rejects_oversized_payload(media: _TempSettings, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(service, "settings", _TempSettings(media.public_dir, max_upload_bytes=8))
    with pytest.raises(AppError) as error:
        service.save_upload("a.png", "image/png", _png())
    assert error.value.status == 413


def test_rejects_corrupt_image(media: _TempSettings) -> None:
    with pytest.raises(AppError) as error:
        service.save_upload("a.png", "image/png", b"not really a png")
    assert error.value.status == 400


def test_original_name_strips_directories() -> None:
    assert service.original_name("C:\\tmp\\a.png") == "a.png"
    assert service.original_name("/tmp/a.png") == "a.png"
