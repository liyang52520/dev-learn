"""Front Matter 解析与序列化，以及摘要/阅读时长等派生字段。"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta, timezone
from typing import Any

import frontmatter
import yaml

from app.features.posts.schemas import FrontMatter, PostMeta, PostType
from app.rendering.text import plain_text

SHANGHAI = timezone(timedelta(hours=8))
_RAW_DATE = re.compile(r"^date:\s*['\"]?([^'\"\n]+?)['\"]?\s*$", re.MULTILINE)
_CJK = re.compile(r"[\u4e00-\u9fff]")
_WORD = re.compile(r"[A-Za-z0-9_]+")


@dataclass
class ParsedPost:
    meta: PostMeta
    front: FrontMatter
    extra: dict[str, Any] = field(default_factory=dict)
    body: str = ""


def text_of(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ",".join(text_of(item) for item in value)
    return str(value)


def list_of(value: Any) -> list[str]:
    if value in (None, ""):
        return []
    if isinstance(value, list):
        return [item for item in (text_of(entry) for entry in value) if item]
    return [part.strip() for part in text_of(value).split(",") if part.strip()]


def excerpt_of(front: dict[str, Any], body: str) -> str:
    explicit = text_of(front.get("description") or front.get("excerpt") or front.get("summary"))
    if explicit:
        return explicit[:180]
    return plain_text(body)[:150]


def reading_time_of(body: str) -> int:
    text = plain_text(body)
    cjk = len(_CJK.findall(text))
    words = len(_WORD.findall(text))
    return max(1, -(-cjk // 400) + -(-words // 220))


def _raw_date(raw: str, fallback: Any) -> str:
    match = _RAW_DATE.search(raw)
    if match:
        return match.group(1).strip()
    if isinstance(fallback, datetime | date):
        return fallback.isoformat()
    return text_of(fallback)


def _parse_datetime(value: str) -> datetime | None:
    value = value.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(value, fmt)
            return parsed.replace(tzinfo=SHANGHAI)
        except ValueError:
            continue
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=SHANGHAI)
    return parsed


def to_iso(raw: str, fallback: Any) -> str:
    moment: datetime | None
    if isinstance(fallback, datetime):
        moment = fallback if fallback.tzinfo else fallback.replace(tzinfo=SHANGHAI)
    elif isinstance(fallback, date):
        moment = datetime.combine(fallback, time()).replace(tzinfo=SHANGHAI)
    else:
        moment = _parse_datetime(raw)
    if moment is None:
        return datetime(1970, 1, 1, tzinfo=UTC).isoformat().replace("+00:00", "Z")
    return moment.astimezone(UTC).isoformat().replace("+00:00", "Z")


def build_meta(post_type: PostType, slug: str, raw: str) -> PostMeta:
    parsed = frontmatter.loads(raw)
    data: dict[str, Any] = dict(parsed.metadata)
    date_raw = _raw_date(raw, data.get("date"))
    date_iso = to_iso(date_raw, data.get("date"))
    moment = datetime.fromisoformat(date_iso.replace("Z", "+00:00")).astimezone(SHANGHAI)
    return PostMeta(
        slug=slug,
        title=text_of(data.get("title")) or slug,
        date_raw=date_raw,
        date_iso=date_iso,
        display_date=moment.strftime("%Y-%m-%d"),
        display_date_time=f"{moment.strftime('%Y-%m-%d')} {moment.strftime('%H:%M')}",
        tags=list_of(data.get("tags")),
        categories=list_of(data.get("categories")),
        excerpt=excerpt_of(data, parsed.content),
        cover=text_of(data.get("cover")),
        reading_time=reading_time_of(parsed.content),
        type=post_type,
    )


KNOWN_KEYS = {"title", "date", "tags", "categories", "description", "cover"}


def parse_post(post_type: PostType, slug: str, raw: str) -> ParsedPost:
    parsed = frontmatter.loads(raw)
    data: dict[str, Any] = dict(parsed.metadata)
    meta = build_meta(post_type, slug, raw)
    return ParsedPost(
        meta=meta,
        front=FrontMatter(
            title=meta.title,
            date=meta.date_raw,
            tags=meta.tags,
            categories=meta.categories,
            description=text_of(data.get("description")),
            cover=text_of(data.get("cover")),
        ),
        extra={key: value for key, value in data.items() if key not in KNOWN_KEYS},
        body=parsed.content,
    )


def serialize_post(front: FrontMatter, body: str, extra: dict[str, Any] | None = None) -> str:
    data: dict[str, Any] = {"title": front.title.strip(), "date": front.date.strip()}
    if front.tags:
        data["tags"] = front.tags
    if front.categories:
        data["categories"] = front.categories
    if front.description.strip():
        data["description"] = front.description.strip()
    if front.cover.strip():
        data["cover"] = front.cover.strip()
    data.update(extra or {})
    yaml_text = yaml.safe_dump(data, allow_unicode=True, sort_keys=False, default_flow_style=False)
    clean_body = body.lstrip("\n")
    return f"---\n{yaml_text}---\n\n{clean_body}\n"


def slugify_title(title: str) -> str:
    slug = re.sub(r'[\\/:*?"<>|]', "-", title.strip())
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug[:80]
