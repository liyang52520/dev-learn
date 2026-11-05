import { NextResponse } from 'next/server';
import { movePost } from '@/lib/posts';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    slug?: string;
    direction?: 'publish' | 'unpublish';
  };
  if (!body.slug || !body.direction) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }
  const from = body.direction === 'publish' ? 'drafts' : 'posts';
  const to = body.direction === 'publish' ? 'posts' : 'drafts';
  const slug = movePost(from, to, body.slug);
  if (!slug) return NextResponse.json({ error: '文章不存在' }, { status: 404 });
  return NextResponse.json({ ok: true, slug, type: to });
}
