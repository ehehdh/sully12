import { NextResponse } from 'next/server';
import { USER_SESSION_COOKIE } from '@/lib/session';
import { OAUTH_STATE_COOKIE, OAUTH_CODE_VERIFIER_COOKIE } from '@/lib/oauth';

/**
 * POST /api/auth/logout
 * 로그아웃 - 모든 세션/OAuth 관련 쿠키 삭제
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // 사용자 세션 쿠키 삭제
  response.cookies.set(USER_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // 즉시 만료
    path: '/',
  });
  
  // OAuth 관련 쿠키도 정리
  response.cookies.delete(OAUTH_STATE_COOKIE);
  response.cookies.delete(OAUTH_CODE_VERIFIER_COOKIE);

  return response;
}

/**
 * GET /api/auth/logout
 * 로그아웃 (리다이렉트 용도)
 */
export async function GET() {
  const response = NextResponse.redirect(
    new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
  );
  
  // 사용자 세션 쿠키 삭제
  response.cookies.set(USER_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  
  // OAuth 관련 쿠키도 정리
  response.cookies.delete(OAUTH_STATE_COOKIE);
  response.cookies.delete(OAUTH_CODE_VERIFIER_COOKIE);

  return response;
}
