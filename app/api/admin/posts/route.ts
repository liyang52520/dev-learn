import { NextResponse } from 'next/server';
import { listPosts } from '@/lib/posts';

export async function GET() {
  return NextResponse.json({
    posts: listPosts('posts'),
    drafts: listPosts('drafts'),
  });
}
