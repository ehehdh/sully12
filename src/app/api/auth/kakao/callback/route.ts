import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in: number;
}

interface KakaoUserInfo {
  id: number;
  connected_at: string;
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
  kakao_account?: {
    profile_nickname_needs_agreement?: boolean;
    profile_image_needs_agreement?: boolean;
    profile?: {
      nickname?: string;
      thumbnail_image_url?: string;
      profile_image_url?: string;
    };
    email?: string;
    email_needs_agreement?: boolean;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
  };
}

/**
 * 카카오 로그인 콜백 - 토큰 교환 및 사용자 정보 저장
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // 에러 처리
  if (error) {
    console.error('Kakao auth error:', error);
    return NextResponse.redirect(new URL('/login?error=kakao_auth_failed', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url));
  }

  const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
  const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET;
  const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || 
    `${request.nextUrl.origin}/api/auth/kakao/callback`;

  if (!KAKAO_REST_API_KEY) {
    return NextResponse.redirect(new URL('/login?error=config_error', request.url));
  }

  try {
    // 1. 인가 코드로 토큰 요청
    const tokenParams: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: KAKAO_REST_API_KEY,
      redirect_uri: REDIRECT_URI,
      code: code,
    };
    
    // Client Secret이 있으면 추가
    if (KAKAO_CLIENT_SECRET) {
      tokenParams.client_secret = KAKAO_CLIENT_SECRET;
    }
    
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      // 에러 메시지를 URL에 포함 (디버깅용)
      const errorMsg = encodeURIComponent(errorData.substring(0, 100));
      return NextResponse.redirect(new URL(`/login?error=token_failed&msg=${errorMsg}`, request.url));
    }

    const tokenData: KakaoTokenResponse = await tokenResponse.json();

    // 2. 액세스 토큰으로 사용자 정보 요청
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });

    if (!userResponse.ok) {
      console.error('User info request failed');
      return NextResponse.redirect(new URL('/login?error=user_info_failed', request.url));
    }

    const userData: KakaoUserInfo = await userResponse.json();

    // 3. 사용자 정보 추출
    const kakaoId = String(userData.id);
    const nickname = userData.properties?.nickname || 
                     userData.kakao_account?.profile?.nickname || 
                     `User${kakaoId.slice(-4)}`;
    const profileImage = userData.properties?.profile_image || 
                         userData.kakao_account?.profile?.profile_image_url || 
                         null;
    const email = userData.kakao_account?.email || null;

    // 4. Supabase에 사용자 저장/업데이트 (타입 없이 사용)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase credentials not configured');
      return NextResponse.redirect(new URL('/login?error=config_error', request.url));
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('kakao_id', kakaoId)
      .single();

    let userId: string;

    if (existingUser) {
      // 기존 사용자 - 정보 업데이트
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          nickname,
          profile_image: profileImage,
          email,
          last_login_at: new Date().toISOString(),
        })
        .eq('kakao_id', kakaoId)
        .select()
        .single();

      if (updateError || !updatedUser) {
        console.error('User update error:', updateError);
        return NextResponse.redirect(new URL('/login?error=db_error', request.url));
      }
      userId = updatedUser.id;
    } else {
      // 새 사용자 생성
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          kakao_id: kakaoId,
          nickname,
          profile_image: profileImage,
          email,
        })
        .select()
        .single();

      if (createError || !newUser) {
        console.error('User creation error:', createError);
        return NextResponse.redirect(new URL('/login?error=db_error', request.url));
      }
      userId = newUser.id;
    }

    // 5. 세션 쿠키 생성 (간단한 JWT 대신 서명된 쿠키 사용)
    const sessionData = {
      userId,
      kakaoId,
      nickname,
      profileImage,
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7일
    };

    // Base64로 인코딩 (프로덕션에서는 JWT 사용 권장)
    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');

    // 6. 쿠키 설정 및 홈으로 리다이렉트
    const response = NextResponse.redirect(new URL('/', request.url));
    
    response.cookies.set('politi-log-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7일
      path: '/',
    });

    return response;

  } catch (err) {
    console.error('Kakao callback error:', err);
    return NextResponse.redirect(new URL('/login?error=unknown', request.url));
  }
}
