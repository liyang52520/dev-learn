import { NextResponse } from 'next/server';
import { searchAll } from '@/lib/search';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  return NextResponse.json({ results: searchAll(query) });
}
