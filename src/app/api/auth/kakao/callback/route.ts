import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createUserSession, USER_SESSION_COOKIE } from '@/lib/session';
import { verifyOAuthState, OAUTH_STATE_COOKIE } from '@/lib/oauth';

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
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('Kakao auth error:', error);
    return NextResponse.redirect(new URL('/login?error=kakao_auth_failed', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url));
  }

  // State 검증 (CSRF 방지)
  const savedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!state || !savedState) {
    console.error('OAuth state missing');
    return NextResponse.redirect(new URL('/login?error=invalid_state', request.url));
  }

  const stateVerification = await verifyOAuthState(savedState, 'kakao');
  if (!stateVerification.valid || state !== savedState) {
    console.error('OAuth state verification failed');
    return NextResponse.redirect(new URL('/login?error=invalid_state', request.url));
  }

  const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
  const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET;
  const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || 
    `${request.nextUrl.origin}/api/auth/kakao/callback`;

  if (!KAKAO_REST_API_KEY) {
    return NextResponse.redirect(new URL('/login?error=config_error', request.url));
  }

  try {
    // 1. 토큰 요청
    const tokenParams: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: KAKAO_REST_API_KEY,
      redirect_uri: REDIRECT_URI,
      code: code,
    };
    
    if (KAKAO_CLIENT_SECRET) {
      tokenParams.client_secret = KAKAO_CLIENT_SECRET;
    }
    
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(new URL('/login?error=token_failed', request.url));
    }

    const tokenData: KakaoTokenResponse = await tokenResponse.json();

    // 2. 사용자 정보 요청
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

    const kakaoId = String(userData.id);
    const nickname = userData.properties?.nickname || 
                     userData.kakao_account?.profile?.nickname || 
                     `User${kakaoId.slice(-4)}`;
    const profileImage = userData.properties?.profile_image || 
                         userData.kakao_account?.profile?.profile_image_url || 
                         null;
    const email = userData.kakao_account?.email || null;

    // 3. Supabase 연결
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase credentials not configured');
      return NextResponse.redirect(new URL('/login?error=config_error', request.url));
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let userId: string;
    let userRole: string = 'user';
    let needsOnboarding = false;
    let finalNickname = nickname;
    let finalProfileImage = profileImage;

    // 4. 이메일로 기존 계정 확인 (이메일이 있는 경우만)
    if (email) {
      const { data: existingUserByEmail } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (existingUserByEmail) {
        // 차단/정지/탈퇴 확인
        if (existingUserByEmail.deleted_at) {
          return NextResponse.redirect(new URL('/login?error=account_deleted', request.url));
        }
        if (existingUserByEmail.is_banned === true) {
          return NextResponse.redirect(new URL('/login?error=account_banned', request.url));
        }
        if (existingUserByEmail.is_suspended === true) {
          return NextResponse.redirect(new URL('/login?error=account_suspended', request.url));
        }

        // 다른 소셜 계정으로 가입된 경우
        if (existingUserByEmail.kakao_id !== kakaoId && existingUserByEmail.google_id) {
          return NextResponse.redirect(new URL('/login?error=email_exists&provider=구글', request.url));
        }

        userId = existingUserByEmail.id;
        userRole = existingUserByEmail.role || 'user';
        finalNickname = existingUserByEmail.nickname || nickname;
        finalProfileImage = existingUserByEmail.profile_image || profileImage;
        needsOnboarding = existingUserByEmail.is_onboarding_complete === false;
        
        // 로그인 시간 업데이트 + 카카오 ID 연동
        await supabase
          .from('users')
          .update({ 
            last_login_at: new Date().toISOString(),
            kakao_id: kakaoId
          })
          .eq('id', userId);

        return createSessionAndRedirect(request, {
          userId, kakaoId, email, nickname: finalNickname, 
          profileImage: finalProfileImage, role: userRole, needsOnboarding
        });
      }
    }

    // 5. 카카오 ID로 기존 계정 확인
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('kakao_id', kakaoId)
      .single();

    if (existingUser) {
      // 차단/정지/탈퇴 확인
      if (existingUser.deleted_at) {
        return NextResponse.redirect(new URL('/login?error=account_deleted', request.url));
      }
      if (existingUser.is_banned === true) {
        return NextResponse.redirect(new URL('/login?error=account_banned', request.url));
      }
      if (existingUser.is_suspended === true) {
        return NextResponse.redirect(new URL('/login?error=account_suspended', request.url));
      }

      userId = existingUser.id;
      userRole = existingUser.role || 'user';
      finalNickname = existingUser.nickname || nickname;
      finalProfileImage = existingUser.profile_image || profileImage;
      needsOnboarding = existingUser.is_onboarding_complete === false;
      
      // 로그인 시간 업데이트
      await supabase
        .from('users')
        .update({ 
          email,
          profile_image: profileImage,
          last_login_at: new Date().toISOString()
        })
        .eq('id', userId);
    } else {
      // 6. 신규 사용자 생성 (최소 필드만)
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
      needsOnboarding = true;
    }

    console.log(`Kakao login success: ${userId} (${finalNickname})`);

    return createSessionAndRedirect(request, {
      userId, kakaoId, email, nickname: finalNickname, 
      profileImage: finalProfileImage, role: userRole, needsOnboarding
    });

  } catch (err) {
    console.error('Kakao callback error:', err);
    return NextResponse.redirect(new URL('/login?error=unknown', request.url));
  }
}

// JWT 세션 생성 및 리다이렉트 헬퍼 함수
async function createSessionAndRedirect(
  request: NextRequest,
  data: {
    userId: string;
    kakaoId: string;
    email: string | null;
    nickname: string;
    profileImage: string | null;
    role: string;
    needsOnboarding: boolean;
  }
) {
  const { userId, kakaoId, email, nickname, profileImage, role, needsOnboarding } = data;
  
  const sessionToken = await createUserSession({
    userId,
    kakaoId,
    email: email || undefined,
    nickname,
    profileImage,
    role,
  });

  const redirectUrl = needsOnboarding ? '/onboarding' : '/';
  const response = NextResponse.redirect(new URL(redirectUrl, request.url));
  
  response.cookies.set(USER_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  response.cookies.delete(OAUTH_STATE_COOKIE);

  return response;
}
