import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminToken } from '@/lib/auth';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.ADMIN_PASSWORD || 'yg-admin';
  if (body.password !== expected) {
    return NextResponse.json({ error: '密码不正确' }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, await adminToken(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
