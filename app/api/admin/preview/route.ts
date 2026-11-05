import { NextResponse } from 'next/server';
import { renderMarkdown } from '@/lib/markdown';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { body?: string };
  if (typeof body.body !== 'string') {
    return NextResponse.json({ error: '缺少正文' }, { status: 400 });
  }
  const rendered = await renderMarkdown(body.body);
  return NextResponse.json(rendered);
}
