import { NextResponse } from 'next/server';

/**
 * 로그아웃 - 세션 쿠키 삭제
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  
  response.cookies.set('politi-log-session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // 즉시 만료
    path: '/',
  });

  return response;
}

// GET 요청도 지원 (리다이렉트 용도)
export async function GET() {
  const response = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  
  response.cookies.set('politi-log-session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
