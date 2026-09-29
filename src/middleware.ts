import { NextRequest, NextResponse } from 'next/server';

// 无 cookie 直接重定向登录页（真正的鉴权在各 API/页面数据接口中完成）
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/') || pathname.startsWith('/login') || pathname.startsWith('/_next')) return NextResponse.next();
  const token = req.cookies.get('uniform_session')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
