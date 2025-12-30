import { NextRequest, NextResponse } from 'next/server';
import { 
  createOAuthState, 
  OAUTH_STATE_COOKIE,
  OAUTH_COOKIE_OPTIONS
} from '@/lib/oauth';

/**
 * 카카오 로그인 시작 - 카카오 인증 페이지로 리다이렉트
 * State 토큰을 사용한 CSRF 방지
 */
export async function GET(request: NextRequest) {
  const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
  const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || 
    `${request.nextUrl.origin}/api/auth/kakao/callback`;
  
  if (!KAKAO_REST_API_KEY) {
    return NextResponse.json(
      { error: 'Kakao API key not configured' },
      { status: 500 }
    );
  }

  try {
    // State 토큰 생성 (CSRF 방지)
    const state = await createOAuthState('kakao');

    // 카카오 인증 URL 생성
    const kakaoAuthUrl = new URL('https://kauth.kakao.com/oauth/authorize');
    kakaoAuthUrl.searchParams.append('client_id', KAKAO_REST_API_KEY);
    kakaoAuthUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    kakaoAuthUrl.searchParams.append('response_type', 'code');
    
    // State 파라미터 추가 (CSRF 방지)
    kakaoAuthUrl.searchParams.append('state', state);

    // 리다이렉트 응답 생성
    const response = NextResponse.redirect(kakaoAuthUrl.toString());
    
    // State를 쿠키에 저장
    response.cookies.set(OAUTH_STATE_COOKIE, state, OAUTH_COOKIE_OPTIONS);

    return response;
    
  } catch (error) {
    console.error('Kakao OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Kakao login' },
      { status: 500 }
    );
  }
}
