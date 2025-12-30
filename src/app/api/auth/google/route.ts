import { NextRequest, NextResponse } from 'next/server';
import { 
  createOAuthState, 
  generateCodeVerifier, 
  generateCodeChallenge,
  OAUTH_STATE_COOKIE,
  OAUTH_CODE_VERIFIER_COOKIE,
  OAUTH_COOKIE_OPTIONS
} from '@/lib/oauth';

/**
 * 구글 로그인 시작 - 구글 인증 페이지로 리다이렉트
 * State 토큰과 PKCE를 사용한 보안 강화
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

  try {
    // State 토큰 생성 (CSRF 방지)
    const state = await createOAuthState('google');
    
    // PKCE code_verifier 및 code_challenge 생성
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // 구글 인증 URL 생성
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    googleAuthUrl.searchParams.append('response_type', 'code');
    googleAuthUrl.searchParams.append('scope', 'openid email profile');
    googleAuthUrl.searchParams.append('access_type', 'offline');
    googleAuthUrl.searchParams.append('prompt', 'consent');
    
    // 보안 파라미터 추가
    googleAuthUrl.searchParams.append('state', state);
    googleAuthUrl.searchParams.append('code_challenge', codeChallenge);
    googleAuthUrl.searchParams.append('code_challenge_method', 'S256');

    // 리다이렉트 응답 생성
    const response = NextResponse.redirect(googleAuthUrl.toString());
    
    // State와 code_verifier를 쿠키에 저장
    response.cookies.set(OAUTH_STATE_COOKIE, state, OAUTH_COOKIE_OPTIONS);
    response.cookies.set(OAUTH_CODE_VERIFIER_COOKIE, codeVerifier, OAUTH_COOKIE_OPTIONS);

    return response;
    
  } catch (error) {
    console.error('Google OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Google login' },
      { status: 500 }
    );
  }
}
