"""文章业务：解析、渲染、缓存与发布流程。"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass

from app.core.config import settings
from app.features.posts import repository
from app.features.posts.frontmatter import (
    ParsedPost,
    build_meta,
    parse_post,
    serialize_post,
    slugify_title,
)
from app.features.posts.schemas import (
    FrontMatter,
    PostDetail,
    PostMeta,
    PostRef,
    PostType,
    TocItem,
)
from app.rendering.markdown import render_markdown

_lock = threading.RLock()
_meta_cache: dict[tuple[str, str], tuple[tuple[int, int], PostMeta]] = {}
_detail_cache: dict[tuple[str, str], tuple[tuple[int, int], tuple[str, list[TocItem]]]] = {}
_list_cache: dict[str, tuple[str, list[PostMeta]]] = {}


def _invalidate() -> None:
    with _lock:
        _meta_cache.clear()
        _detail_cache.clear()
        _list_cache.clear()


def list_posts(post_type: PostType) -> list[PostMeta]:
    fingerprint = repository.fingerprint(post_type)
    cached = _list_cache.get(post_type)
    if cached and cached[0] == fingerprint:
        return cached[1]
    collected = [
        meta_of(post_type, repository.slug_of(name)) for name in repository.list_names(post_type)
    ]
    metas = [meta for meta in collected if meta is not None]
    metas.sort(key=lambda meta: meta.date_iso, reverse=True)
    with _lock:
        _list_cache[post_type] = (fingerprint, metas)
    return metas


def meta_of(post_type: PostType, slug: str) -> PostMeta | None:
    stamp = repository.stamp_of(post_type, slug)
    if stamp is None:
        return None
    key = (post_type, slug)
    cached = _meta_cache.get(key)
    if cached and cached[0] == stamp:
        return cached[1]
    raw = repository.read(post_type, slug)
    if raw is None:
        return None
    meta = build_meta(post_type, slug, raw)
    with _lock:
        _meta_cache[key] = (stamp, meta)
    return meta


def get_detail(post_type: PostType, slug: str) -> PostDetail | None:
    stamp = repository.stamp_of(post_type, slug)
    if stamp is None:
        return None
    key = (post_type, slug)
    with _lock:
        cached = _detail_cache.get(key)
    if cached and cached[0] == stamp:
        html, toc = cached[1]
    else:
        raw = repository.read(post_type, slug)
        if raw is None:
            return None
        parsed = parse_post(post_type, slug, raw)
        rendered = render_markdown(parsed.body)
        html = rendered.html
        toc = [TocItem(depth=item.depth, text=item.text, id=item.id) for item in rendered.toc]
        with _lock:
            _detail_cache[key] = (stamp, (html, toc))
        meta = parsed.meta
        return PostDetail(meta=meta, html=html, toc=toc)

    cached_meta = meta_of(post_type, slug)
    if cached_meta is None:
        return None
    return PostDetail(meta=cached_meta, html=html, toc=toc)


def get_published_detail(slug: str) -> PostDetail | None:
    detail = get_detail("posts", slug)
    if detail is None:
        return None
    posts = list_posts("posts")
    slugs = [post.slug for post in posts]
    index = slugs.index(slug) if slug in slugs else -1
    older = posts[index + 1] if 0 <= index < len(posts) - 1 else None
    newer = posts[index - 1] if index > 0 else None
    detail.prev = PostRef(slug=older.slug, title=older.title) if older else None
    detail.next = PostRef(slug=newer.slug, title=newer.title) if newer else None
    return detail


def raw_post(post_type: PostType, slug: str) -> ParsedPost | None:
    raw = repository.read(post_type, slug)
    if raw is None:
        return None
    return parse_post(post_type, slug, raw)


def create_post(title: str) -> ParsedPost:
    base = slugify_title(title) or f"untitled-{int(time.time())}"
    existing = set(repository.list_names("drafts"))
    slug = base
    index = 2
    while f"{slug}.md" in existing:
        slug = f"{base}-{index}"
        index += 1
    now = time.time()
    moment = time.gmtime(now + 8 * 3600)
    date_text = time.strftime("%Y-%m-%d %H:%M:%S", moment)
    raw = serialize_post(FrontMatter(title=title, date=date_text), "从这里开始写正文。\n")
    repository.write("drafts", slug, raw)
    _invalidate()
    created = raw_post("drafts", slug)
    if created is None:
        raise RuntimeError("创建草稿失败")
    return created


def save_post(post_type: PostType, slug: str, front: FrontMatter, body: str) -> None:
    existing = raw_post(post_type, slug)
    extra = existing.extra if existing else {}
    repository.write(post_type, slug, serialize_post(front, body, extra))
    _invalidate()


def delete_post(post_type: PostType, slug: str) -> bool:
    removed = repository.delete(post_type, slug)
    if removed:
        _invalidate()
    return removed


def publish(slug: str) -> tuple[str, str] | None:
    moved = repository.move("drafts", "posts", slug)
    if moved is None:
        return None
    _invalidate()
    return ("posts", moved)


def unpublish(slug: str) -> tuple[str, str] | None:
    moved = repository.move("posts", "drafts", slug)
    if moved is None:
        return None
    _invalidate()
    return ("drafts", moved)


@dataclass(frozen=True)
class BlogStats:
    posts: int
    drafts: int
    tags: int
    categories: int


def blog_stats() -> BlogStats:
    published = list_posts("posts")
    drafts = list_posts("drafts")
    tags = {tag for post in published for tag in post.tags}
    categories = {category for post in published for category in post.categories}
    return BlogStats(len(published), len(drafts), len(tags), len(categories))


def page_size() -> int:
    return settings.page_size


def fingerprint(post_type: PostType = "posts") -> str:
    """目录指纹：跨 feature 的检索缓存用它判断是否需要重建。"""
    return repository.fingerprint(post_type)
