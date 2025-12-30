import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const ADMIN_COOKIE_NAME = 'politi-log-admin-session';

/**
 * JWT 시크릿 키 가져오기
 * 프로덕션에서는 반드시 SESSION_SECRET이 설정되어 있어야 함
 */
function getJwtSecret(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // 프로덕션에서는 SECRET 없으면 인증 불가
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL: SESSION_SECRET is not set in production!');
      return null;
    }
    // 개발 환경에서만 폴백 허용 (경고 출력)
    console.warn('⚠️ SESSION_SECRET is not set. Using development fallback. DO NOT use in production!');
    return new TextEncoder().encode('dev-only-fallback-key-not-for-production!');
  }
  return new TextEncoder().encode(secret);
}

/**
 * 관리자 세션 검증 (Edge 런타임 호환)
 */
async function verifyAdminSession(token: string): Promise<boolean> {
  try {
    const secret = getJwtSecret();
    
    // secret이 없으면 인증 실패
    if (!secret) {
      console.error('Cannot verify session: SESSION_SECRET is not configured');
      return false;
    }
    
    const { payload } = await jwtVerify(token, secret);
    
    // isAdmin 플래그 확인
    if (!payload || typeof payload !== 'object' || !('isAdmin' in payload)) {
      return false;
    }
    
    return payload.isAdmin === true;
  } catch (error) {
    // 만료되었거나 유효하지 않은 토큰
    console.error('Admin session verification failed:', error);
    return false;
  }
}

/**
 * Next.js Middleware
 * /admin/* 및 /api/admin/* 경로에 대해 관리자 인증을 검증합니다.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 관리자 UI 페이지 보호 (/admin/*)
  // 로그인 페이지는 제외
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const adminSession = request.cookies.get(ADMIN_COOKIE_NAME);
    
    if (!adminSession?.value) {
      // 세션이 없으면 관리자 로그인 페이지로 리다이렉트
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // JWT 세션 검증
    const isValid = await verifyAdminSession(adminSession.value);
    
    if (!isValid) {
      // 유효하지 않은 세션 - 로그인 페이지로
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.delete(ADMIN_COOKIE_NAME);
      return response;
    }
    
    // 인증 성공
    return NextResponse.next();
  }
  
  // 관리자 API 라우트 보호 (/api/admin/*)
  // 인증 API는 제외 (/api/admin/auth)
  if (pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/auth')) {
    const adminSession = request.cookies.get(ADMIN_COOKIE_NAME);
    
    if (!adminSession?.value) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 401 }
      );
    }
    
    // JWT 세션 검증
    const isValid = await verifyAdminSession(adminSession.value);
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or expired session' },
        { status: 401 }
      );
    }
    
    // 인증 성공
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

// Middleware가 적용될 경로 설정
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
  ],
};
