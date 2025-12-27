import { NextRequest, NextResponse } from 'next/server';

/**
 * 구글 로그인 시작 - 구글 인증 페이지로 리다이렉트
 */
export async function GET(request: NextRequest) {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 
    `${request.nextUrl.origin}/api/auth/google/callback`;
  
  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Google Client ID not configured' },
      { status: 500 }
    );
  }

  // 구글 인증 URL 생성
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  googleAuthUrl.searchParams.append('response_type', 'code');
  googleAuthUrl.searchParams.append('scope', 'openid email profile');
  googleAuthUrl.searchParams.append('access_type', 'offline');
  googleAuthUrl.searchParams.append('prompt', 'consent');

  return NextResponse.redirect(googleAuthUrl.toString());
}
