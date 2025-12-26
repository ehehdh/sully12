import { NextRequest, NextResponse } from 'next/server';

/**
 * 카카오 로그인 시작 - 카카오 인증 페이지로 리다이렉트
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

  // 카카오 인증 URL 생성
  const kakaoAuthUrl = new URL('https://kauth.kakao.com/oauth/authorize');
  kakaoAuthUrl.searchParams.append('client_id', KAKAO_REST_API_KEY);
  kakaoAuthUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  kakaoAuthUrl.searchParams.append('response_type', 'code');
  // scope는 제거 - 기본 프로필 정보만 사용

  return NextResponse.redirect(kakaoAuthUrl.toString());
}
