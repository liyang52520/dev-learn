import fs from 'node:fs';
import path from 'node:path';
import { getPublishedPosts, getRawPost, plainText } from '@/lib/posts';
import { getStudyIndex } from '@/lib/study';

export interface SearchResult {
  type: 'post' | 'study';
  title: string;
  subtitle: string;
  snippet: string;
  href: string;
  badge: string;
}

interface SearchRow {
  type: 'post' | 'study';
  title: string;
  subtitle: string;
  fallbackSnippet: string;
  href: string;
  badge: string;
  titleLower: string;
  metaLower: string;
  body: string;
  bodyLower: string;
}

function countOccurrences(haystack: string, needle: string) {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1 && count < 100) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function makeSnippet(body: string, bodyLower: string, terms: string[], fallback: string, maxLength = 96) {
  const positions = terms
    .map((term) => bodyLower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  if (positions.length === 0) return plainText(fallback).slice(0, maxLength);
  const start = Math.max(0, positions[0] - 28);
  const end = Math.min(body.length, start + maxLength);
  return `${start > 0 ? '…' : ''}${body.slice(start, end).trim()}${end < body.length ? '…' : ''}`;
}

let studyRowsCache: SearchRow[] | null = null;

function studyRows() {
  if (studyRowsCache) return studyRowsCache;
  const index = getStudyIndex();
  const rows: SearchRow[] = [];

  for (const topic of index.topics) {
    for (const question of topic.questions) {
      // index.json 的 search 已预计算为 title + aliases + summary + note + answer 纯文本，
      // 直接复用即可，无需再读 42 个专题 JSON 并剥离 HTML。
      const body = question.search || '';
      const meta = [
        question.title,
        question.aliases.join(' '),
        question.summary.join(' '),
        topic.title,
        topic.label,
      ].join(' ');
      rows.push({
        type: 'study',
        title: question.title,
        subtitle: `${topic.no} · ${topic.title} · ${question.pages}`,
        fallbackSnippet: question.summary[0] || question.search.slice(0, 120),
        href: `/study/${encodeURIComponent(topic.id)}/${encodeURIComponent(question.id)}`,
        badge: topic.label,
        titleLower: question.title.toLowerCase(),
        metaLower: meta.toLowerCase(),
        body,
        bodyLower: body.toLowerCase(),
      });
    }
  }

  studyRowsCache = rows;
  return rows;
}

interface PostRowsCache {
  key: string;
  rows: SearchRow[];
}

let postRowsCache: PostRowsCache | null = null;

function postsFingerprint() {
  const dir = path.join(process.cwd(), 'content/posts');
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.md'))
      .sort()
      .map((name) => {
        const stat = fs.statSync(path.join(dir, name));
        return `${name}:${stat.mtimeMs}:${stat.size}`;
      })
      .join('|');
  } catch {
    return '';
  }
}

function postRows(): SearchRow[] {
  const key = postsFingerprint();
  if (key && postRowsCache?.key === key) return postRowsCache.rows;

  const rows = getPublishedPosts().map((post) => {
    const raw = getRawPost('posts', post.slug);
    const body = raw ? plainText(raw.body) : '';
    const meta = [
      post.title,
      post.excerpt,
      post.tags.join(' '),
      post.categories.join(' '),
      raw?.front.description || '',
    ].join(' ');
    return {
      type: 'post' as const,
      title: post.title,
      subtitle: `${post.displayDate} · ${post.tags.join(' / ') || '随笔'}`,
      fallbackSnippet: post.excerpt,
      href: `/posts/${encodeURIComponent(post.slug)}`,
      badge: '博客',
      titleLower: post.title.toLowerCase(),
      metaLower: meta.toLowerCase(),
      body,
      bodyLower: body.toLowerCase(),
    };
  });

  if (key) postRowsCache = { key, rows };
  return rows;
}

export function searchAll(query: string, limit = 16): SearchResult[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return [];
  const terms = keyword.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const rows = [...postRows(), ...studyRows()];
  const scored = rows
    .map((row) => {
      let matched = 0;
      let occurrences = 0;
      for (const term of terms) {
        const inTitle = row.titleLower.includes(term);
        const inMeta = row.metaLower.includes(term);
        const inBody = row.bodyLower.includes(term);
        if (!inTitle && !inMeta && !inBody) continue;
        matched += 1;
        if (inBody) occurrences += Math.min(8, countOccurrences(row.bodyLower, term));
      }
      if (matched === 0) return { row, score: 0 };

      let score = matched * 20 + (matched === terms.length ? 15 : 0) + Math.min(24, occurrences);
      if (row.titleLower === keyword) score += 100;
      else if (row.titleLower.startsWith(keyword)) score += 70;
      else if (row.titleLower.includes(keyword)) score += 40;
      return { row, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ row }) => ({
    type: row.type,
    title: row.title,
    subtitle: row.subtitle,
    snippet: makeSnippet(row.body, row.bodyLower, terms, row.fallbackSnippet),
    href: row.href,
    badge: row.badge,
  }));
}
