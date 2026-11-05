import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { Post, PostMeta, PostType } from '@/lib/types';
import { renderMarkdown } from '@/lib/markdown';

const ROOT = process.cwd();

export function contentDir(type: PostType) {
  return path.join(ROOT, 'content', type);
}

function listMarkdownFiles(type: PostType) {
  const dir = contentDir(type);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

export function slugFromFile(filename: string) {
  return filename.replace(/\.md$/, '');
}

export function fileFromSlug(slug: string) {
  return `${slug}.md`;
}

function postFile(type: PostType, slug: string) {
  const dir = contentDir(type);
  const file = path.join(dir, fileFromSlug(slug));
  return file.startsWith(`${dir}${path.sep}`) ? file : null;
}

export function slugifyTitle(title: string) {
  return title
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function textOf(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(textOf).join(',');
  return String(value);
}

function listOf(value: unknown): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean);
  return textOf(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function rawDateFromSource(raw: string, fallback: unknown): string {
  const match = raw.match(/^date:\s*['"]?([^'"\n]+?)['"]?\s*$/m);
  if (match) return match[1].trim();
  if (fallback instanceof Date) return fallback.toISOString();
  return textOf(fallback);
}

function toIso(raw: string, fallback: unknown): string {
  if (fallback instanceof Date) return fallback.toISOString();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const normalized = raw.replace(' ', 'T');
    if (/T\d{2}:\d{2}/.test(normalized)) {
      const withZone = /Z|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}+08:00`;
      const date = new Date(withZone);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    const date = new Date(`${raw.slice(0, 10)}T00:00:00+08:00`);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

/** 每次调用都 new Intl.DateTimeFormat 很贵（列表页一次几十篇），提到模块级只建一次。 */
const DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function formatDateParts(iso: string) {
  const date = new Date(iso);
  return { date: DAY_FORMATTER.format(date), time: TIME_FORMATTER.format(date) };
}

export function plainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerptOf(data: Record<string, unknown>, body: string) {
  const explicit = textOf(data.description || data.excerpt || data.summary);
  if (explicit) return explicit.slice(0, 180);
  return plainText(body).slice(0, 150);
}

function readingTimeOf(body: string) {
  const text = plainText(body);
  const cjk = (text.match(/\p{Script=Han}/gu) || []).length;
  const words = (text.match(/[A-Za-z0-9_]+/g) || []).length;
  return Math.max(1, Math.ceil(cjk / 400 + words / 220));
}

function metaOf(type: PostType, filename: string, raw: string): PostMeta {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  const slug = slugFromFile(filename);
  const dateRaw = rawDateFromSource(raw, data.date);
  const dateIso = toIso(dateRaw, data.date);
  const parts = formatDateParts(dateIso);
  return {
    slug,
    title: textOf(data.title) || slug,
    dateRaw,
    dateIso,
    displayDate: parts.date,
    displayDateTime: `${parts.date} ${parts.time.slice(0, 5)}`,
    tags: listOf(data.tags),
    categories: listOf(data.categories),
    excerpt: excerptOf(data, parsed.content),
    cover: textOf(data.cover),
    readingTime: readingTimeOf(parsed.content),
    type,
  };
}

export function getPostMeta(type: PostType, filename: string): PostMeta {
  const raw = fs.readFileSync(path.join(contentDir(type), filename), 'utf8');
  return metaOf(type, filename, raw);
}

interface FileStamp {
  mtimeMs: number;
  size: number;
}

function stampOf(file: string): FileStamp | null {
  try {
    const stat = fs.statSync(file);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  } catch {
    return null;
  }
}

function sameStamp(stamp: FileStamp, current: FileStamp) {
  return stamp.mtimeMs === current.mtimeMs && stamp.size === current.size;
}

/** 列表页一次要几十篇；每篇每次请求都 stat 一遍目录即可判断有没有变化。 */
function listFingerprint(type: PostType): string {
  const dir = contentDir(type);
  let names: string[];
  try {
    names = fs.readdirSync(dir).filter((name) => name.endsWith('.md'));
  } catch {
    return '';
  }
  names.sort((a, b) => a.localeCompare(b, 'zh-CN'));
  return names
    .map((name) => {
      const stamp = stampOf(path.join(dir, name));
      return stamp ? `${name}:${stamp.mtimeMs}:${stamp.size}` : `${name}:missing`;
    })
    .join('|');
}

/**
 * 渲染结果按文件 stat（mtimeMs + size）缓存。
 * generateMetadata 与页面组件会各取一次同一篇文章，加上 force-dynamic 每个请求
 * 都重新走一遍；缓存后同一文件只在第一次请求时解析 + 渲染一次，文件改动自动失效。
 * 用 Promise 缓存也是为了合并并发的两次取用（两个调用只渲染一次）。
 */
const postCache = new Map<string, { stamp: FileStamp; promise: Promise<Post | null> }>();
const rawPostCache = new Map<string, { stamp: FileStamp; value: RawPost }>();
const listCache = new Map<PostType, { fingerprint: string; posts: PostMeta[] }>();

interface RawPost {
  meta: PostMeta;
  front: {
    title: string;
    date: string;
    tags: string[];
    categories: string[];
    description: string;
    cover: string;
  };
  extra: Record<string, unknown>;
  body: string;
}

/** 写/删/挪文章后主动清缓存：同一毫秒内同尺寸的写入，光靠 stat 可能认不出来。 */
function clearPostCaches() {
  postCache.clear();
  rawPostCache.clear();
  listCache.clear();
}

export function listPosts(type: PostType): PostMeta[] {
  const fingerprint = listFingerprint(type);
  const cached = listCache.get(type);
  if (cached && cached.fingerprint === fingerprint) return cached.posts;
  const posts = listMarkdownFiles(type)
    .map((filename) => getPostMeta(type, filename))
    .sort((a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime());
  listCache.set(type, { fingerprint, posts });
  return posts;
}

export function getPublishedPosts(): PostMeta[] {
  return listPosts('posts');
}

export function getDraftPosts(): PostMeta[] {
  return listPosts('drafts');
}

export function getAllPosts(): PostMeta[] {
  return [...getPublishedPosts(), ...getDraftPosts()].sort(
    (a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime(),
  );
}

export async function getPost(type: PostType, slug: string): Promise<Post | null> {
  const decoded = decodeURIComponent(slug);
  const file = postFile(type, decoded);
  if (!file) return null;

  const key = `${type}:${decoded}`;
  const stamp = stampOf(file);
  if (!stamp) {
    postCache.delete(key);
    return null;
  }

  const cached = postCache.get(key);
  if (cached && sameStamp(cached.stamp, stamp)) return cached.promise;

  const promise = (async () => {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = matter(raw);
    const meta = metaOf(type, fileFromSlug(decoded), raw);
    const rendered = await renderMarkdown(parsed.content);
    return { ...meta, body: parsed.content, ...rendered };
  })();
  postCache.set(key, { stamp, promise });
  // 渲染抛错时不要把失败的 Promise 留在缓存里。
  promise.catch(() => {
    if (postCache.get(key)?.promise === promise) postCache.delete(key);
  });
  return promise;
}

function buildRawPost(type: PostType, decoded: string, file: string): RawPost {
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  const meta = metaOf(type, fileFromSlug(decoded), raw);
  const known = new Set(['title', 'date', 'tags', 'categories', 'description', 'cover']);
  return {
    meta,
    front: {
      title: meta.title,
      date: meta.dateRaw,
      tags: meta.tags,
      categories: meta.categories,
      description: textOf(data.description),
      cover: textOf(data.cover),
    },
    extra: Object.fromEntries(Object.entries(data).filter(([key]) => !known.has(key))),
    body: parsed.content,
  };
}

export function getRawPost(type: PostType, slug: string): RawPost | null {
  const decoded = decodeURIComponent(slug);
  const file = postFile(type, decoded);
  if (!file) return null;

  const key = `${type}:${decoded}`;
  const stamp = stampOf(file);
  if (!stamp) {
    rawPostCache.delete(key);
    return null;
  }

  const cached = rawPostCache.get(key);
  if (cached && sameStamp(cached.stamp, stamp)) return cached.value;

  const value = buildRawPost(type, decoded, file);
  rawPostCache.set(key, { stamp, value });
  return value;
}

export function serializePost(front: {
  title: string;
  date: string;
  tags: string[];
  categories: string[];
  description?: string;
  cover?: string;
}, body: string, extra: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = {
    title: front.title.trim(),
    date: front.date.trim(),
  };
  if (front.tags.length) data.tags = front.tags;
  if (front.categories.length) data.categories = front.categories;
  if (front.description?.trim()) data.description = front.description.trim();
  if (front.cover?.trim()) data.cover = front.cover.trim();
  Object.assign(data, extra);
  const yaml = matter.stringify(`\n${body.replace(/^\n+/, '')}`, data);
  return yaml.endsWith('\n') ? yaml : `${yaml}\n`;
}

export function writePost(type: PostType, slug: string, raw: string) {
  const dir = contentDir(type);
  fs.mkdirSync(dir, { recursive: true });
  const file = postFile(type, slug);
  if (!file) throw new Error('非法文件名');
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, raw, 'utf8');
  fs.renameSync(temp, file);
  clearPostCaches();
  return file;
}

export function deletePost(type: PostType, slug: string) {
  const source = postFile(type, slug);
  if (!source || !fs.existsSync(source)) return false;
  const trashDir = path.join(ROOT, '.trash', type);
  fs.mkdirSync(trashDir, { recursive: true });
  const target = path.join(trashDir, `${Date.now()}-${fileFromSlug(slug)}`);
  fs.renameSync(source, target);
  clearPostCaches();
  return true;
}

export function movePost(from: PostType, to: PostType, slug: string) {
  const source = postFile(from, slug);
  if (!source || !fs.existsSync(source)) return false;
  const targetDir = contentDir(to);
  fs.mkdirSync(targetDir, { recursive: true });
  let target = path.join(targetDir, fileFromSlug(slug));
  if (fs.existsSync(target)) {
    target = path.join(targetDir, fileFromSlug(`${slug}-${Date.now()}`));
  }
  fs.renameSync(source, target);
  clearPostCaches();
  return path.basename(target, '.md');
}

export function createPost(title: string) {
  const base = slugifyTitle(title) || `untitled-${Date.now()}`;
  let slug = base;
  let index = 2;
  while (fs.existsSync(path.join(contentDir('drafts'), fileFromSlug(slug)))) {
    slug = `${base}-${index++}`;
  }
  const now = new Date();
  const parts = formatDateParts(now.toISOString());
  const raw = serializePost(
    {
      title,
      date: `${parts.date} ${parts.time}`,
      tags: [],
      categories: [],
    },
    '从这里开始写正文。\n',
  );
  writePost('drafts', slug, raw);
  return getRawPost('drafts', slug);
}
