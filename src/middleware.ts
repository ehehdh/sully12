import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware
 * 모든 /admin/* 경로에 대해 관리자 인증을 검증합니다.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // /admin/* 경로 확인 (로그인 페이지는 제외)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    // 관리자 세션 쿠키 확인
    const adminSession = request.cookies.get('politi-log-admin-session');
    
    if (!adminSession?.value) {
      // 세션이 없으면 관리자 로그인 페이지로 리다이렉트
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // 세션 유효성 검증
    try {
      const sessionData = JSON.parse(
        Buffer.from(adminSession.value, 'base64').toString('utf-8')
      );
      
      // 만료 확인
      if (Date.now() > sessionData.expiresAt) {
        const response = NextResponse.redirect(new URL('/admin/login', request.url));
        response.cookies.delete('politi-log-admin-session');
        return response;
      }
      
      // 인증 성공
      return NextResponse.next();
      
    } catch (error) {
      // 세션 파싱 오류 - 로그인 페이지로
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.delete('politi-log-admin-session');
      return response;
    }
  }
  
  return NextResponse.next();
}

// Middleware가 적용될 경로 설정
export const config = {
  matcher: ['/admin/:path*'],
};
