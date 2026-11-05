import { NextResponse } from 'next/server';
import {
  createPost,
  deletePost,
  getRawPost,
  serializePost,
  writePost,
} from '@/lib/posts';
import type { PostType } from '@/lib/types';

function postType(value: unknown): PostType | null {
  return value === 'posts' || value === 'drafts' ? value : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = postType(searchParams.get('type'));
  const slug = searchParams.get('slug');
  if (!type || !slug) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  const post = getRawPost(type, slug);
  if (!post) return NextResponse.json({ error: '文章不存在' }, { status: 404 });
  return NextResponse.json({ post, type });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { title?: string };
  if (!body.title?.trim()) {
    return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
  }
  const post = createPost(body.title.trim());
  return NextResponse.json({ post });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    type?: PostType;
    slug?: string;
    front?: {
      title?: string;
      date?: string;
      tags?: string[];
      categories?: string[];
      description?: string;
      cover?: string;
    };
    body?: string;
  };
  const type = postType(body.type);
  if (!type || !body.slug || !body.front?.title) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }
  const existing = getRawPost(type, body.slug);
  const raw = serializePost(
    {
      title: body.front.title,
      date: body.front.date || '',
      tags: body.front.tags || [],
      categories: body.front.categories || [],
      description: body.front.description || '',
      cover: body.front.cover || '',
    },
    body.body || '',
    existing?.extra || {},
  );
  writePost(type, body.slug, raw);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = postType(searchParams.get('type'));
  const slug = searchParams.get('slug');
  if (!type || !slug) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  const ok = deletePost(type, slug);
  return NextResponse.json({ ok });
}
