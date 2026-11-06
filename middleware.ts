import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, isValidAdminCookie } from '@/lib/auth';
import { withBasePath, requestOrigin } from '@/lib/base-path';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next();
  }
  if (await isValidAdminCookie(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/api/admin')) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  // 记住原始目的地，登录后直接回去（/admin/study 这类深链不用二次点击）
  const loginUrl = new URL(withBasePath('/admin/login'), requestOrigin(request.headers));
  loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
