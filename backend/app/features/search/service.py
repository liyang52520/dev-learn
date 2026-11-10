"""站内检索：文章与题库统一打分，进程内缓存。"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from urllib.parse import quote

from app.core.config import settings
from app.core.pagination import ApiModel
from app.features.posts import service as posts_service
from app.features.study import service as study_service
from app.rendering.text import plain_text


class SearchResult(ApiModel):
    type: str
    title: str
    subtitle: str
    snippet: str
    href: str
    badge: str


@dataclass
class _Row:
    type: str
    title: str
    subtitle: str
    fallback: str
    href: str
    badge: str
    title_lower: str
    meta_lower: str
    body: str
    body_lower: str


_lock = threading.RLock()
_study_cache: tuple[str, list[_Row]] | None = None
_post_cache: tuple[str, list[_Row]] | None = None


def _count(haystack: str, needle: str) -> int:
    total = 0
    index = haystack.find(needle)
    while index != -1 and total < 100:
        total += 1
        index = haystack.find(needle, index + len(needle))
    return total


def _snippet(body: str, body_lower: str, terms: list[str], fallback: str, size: int = 96) -> str:
    positions = sorted(pos for pos in (body_lower.find(term) for term in terms) if pos >= 0)
    if not positions:
        return plain_text(fallback)[:size]
    start = max(0, positions[0] - 28)
    end = min(len(body), start + size)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(body) else ""
    return f"{prefix}{body[start:end].strip()}{suffix}"


def _study_index_rows() -> list[_Row]:
    global _study_cache
    fingerprint = study_service.index_fingerprint()
    with _lock:
        if _study_cache is not None and _study_cache[0] == fingerprint:
            return _study_cache[1]
    rows: list[_Row] = []
    for topic in study_service.index_document()["topics"]:
        for question in topic["questions"]:
            body = question.get("search", "")
            meta = " ".join(
                [
                    question["title"],
                    *question.get("aliases", []),
                    *question.get("summary", []),
                    topic["title"],
                    topic["label"],
                ]
            )
            rows.append(
                _Row(
                    type="study",
                    title=question["title"],
                    subtitle=f"{topic['no']} · {topic['title']} · {question['pages']}",
                    fallback=(question.get("summary") or [body[:120]])[0],
                    href=f"/study/{quote(topic['id'])}/{quote(question['id'])}",
                    badge=topic["label"],
                    title_lower=question["title"].lower(),
                    meta_lower=meta.lower(),
                    body=body,
                    body_lower=body.lower(),
                )
            )
    with _lock:
        _study_cache = (fingerprint, rows)
    return rows


def _post_rows() -> list[_Row]:
    global _post_cache
    fingerprint = posts_service.fingerprint("posts")
    with _lock:
        if _post_cache is not None and _post_cache[0] == fingerprint:
            return _post_cache[1]
    rows: list[_Row] = []
    for post in posts_service.list_posts("posts"):
        raw = posts_service.raw_post("posts", post.slug)
        body = plain_text(raw.body) if raw else ""
        meta = " ".join([post.title, post.excerpt, *post.tags, *post.categories])
        if raw:
            meta = f"{meta} {raw.front.description}"
        rows.append(
            _Row(
                type="post",
                title=post.title,
                subtitle=f"{post.display_date} · {' / '.join(post.tags) or '随笔'}",
                fallback=post.excerpt,
                href=f"/posts/{quote(post.slug)}",
                badge="博客",
                title_lower=post.title.lower(),
                meta_lower=meta.lower(),
                body=body,
                body_lower=body.lower(),
            )
        )
    with _lock:
        _post_cache = (fingerprint, rows)
    return rows


def search_all(query: str, limit: int | None = None) -> list[SearchResult]:
    keyword = query.strip().lower()
    if not keyword:
        return []
    terms = [term for term in keyword.split() if term]
    if not terms:
        return []
    scored: list[tuple[int, _Row]] = []
    for row in [*_post_rows(), *_study_index_rows()]:
        matched = 0
        occurrences = 0
        for term in terms:
            in_title = term in row.title_lower
            in_meta = term in row.meta_lower
            in_body = term in row.body_lower
            if not (in_title or in_meta or in_body):
                continue
            matched += 1
            if in_body:
                occurrences += min(8, _count(row.body_lower, term))
        if matched == 0:
            continue
        score = matched * 20 + (15 if matched == len(terms) else 0) + min(24, occurrences)
        if row.title_lower == keyword:
            score += 100
        elif row.title_lower.startswith(keyword):
            score += 70
        elif keyword in row.title_lower:
            score += 40
        scored.append((score, row))
    scored.sort(key=lambda item: item[0], reverse=True)
    limit = settings.search_limit if limit is None else limit
    return [
        SearchResult(
            type=row.type,
            title=row.title,
            subtitle=row.subtitle,
            snippet=_snippet(row.body, row.body_lower, terms, row.fallback),
            href=row.href,
            badge=row.badge,
        )
        for _, row in scored[:limit]
    ]
