import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/auth';
import { withBasePath, requestOrigin } from '@/lib/base-path';

export async function GET(request: Request) {
  const response = NextResponse.redirect(
    new URL(withBasePath('/admin/login'), requestOrigin(request.headers)),
  );
  response.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
