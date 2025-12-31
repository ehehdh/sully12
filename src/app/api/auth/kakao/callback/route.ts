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
 * State 검증, 이메일 검증 확인 추가
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // 에러 처리
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
    
    // 이메일 검증 여부 확인 (이메일이 있는 경우)
    const isEmailVerified = userData.kakao_account?.is_email_verified ?? true;
    
    // 이메일이 있지만 검증되지 않은 경우 경고 (카카오는 검증 필수가 아님)
    if (email && !isEmailVerified) {
      console.warn('Kakao email not verified:', email);
      // 카카오의 경우 이메일 검증이 필수가 아니므로 계속 진행
      // 필수로 만들려면 아래 주석 해제
      // return NextResponse.redirect(new URL('/login?error=email_not_verified', request.url));
    }

    // 4. Supabase에 사용자 저장/업데이트
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

    // 5. 이메일로 기존 계정 확인 (이메일이 있는 경우만)
    if (email) {
      const { data: existingUserByEmail } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (existingUserByEmail) {
        // ★ 차단/정지/탈퇴 확인
        if (existingUserByEmail.deleted_at) {
          return NextResponse.redirect(new URL('/login?error=account_deleted', request.url));
        }
        if (existingUserByEmail.is_banned) {
          return NextResponse.redirect(new URL('/login?error=account_banned', request.url));
        }
        if (existingUserByEmail.is_suspended) {
          const suspendedUntil = existingUserByEmail.suspended_until 
            ? new Date(existingUserByEmail.suspended_until).toISOString()
            : '';
          return NextResponse.redirect(
            new URL(`/login?error=account_suspended&until=${encodeURIComponent(suspendedUntil)}`, request.url)
          );
        }

        // 이메일로 기존 계정 존재
        if (existingUserByEmail.kakao_id === kakaoId) {
          // 이미 카카오 연동된 계정 - 로그인
          userId = existingUserByEmail.id;
          userRole = existingUserByEmail.role || 'user';
          needsOnboarding = !existingUserByEmail.is_onboarding_complete;
          finalNickname = existingUserByEmail.nickname || nickname;
          finalProfileImage = existingUserByEmail.profile_image || profileImage;
          
          // 마지막 로그인 시간 및 로그인 횟수 업데이트
          await supabase
            .from('users')
            .update({ 
              last_login_at: new Date().toISOString(),
              login_count: (existingUserByEmail.login_count || 0) + 1
            })
            .eq('id', userId);
            
        } else if (existingUserByEmail.kakao_id === null && existingUserByEmail.google_id) {
          // 구글로 가입된 계정 - 에러
          return NextResponse.redirect(
            new URL('/login?error=email_exists&provider=구글', request.url)
          );
        } else if (existingUserByEmail.kakao_id === null) {
          // 카카오 ID 연동
          const { error: updateError } = await supabase
            .from('users')
            .update({ 
              kakao_id: kakaoId,
              last_login_at: new Date().toISOString()
            })
            .eq('id', existingUserByEmail.id);
            
          if (updateError) {
            console.error('Update error:', updateError);
            return NextResponse.redirect(new URL('/login?error=db_error', request.url));
          }
          
          userId = existingUserByEmail.id;
          userRole = existingUserByEmail.role || 'user';
          needsOnboarding = !existingUserByEmail.is_onboarding_complete;
          finalNickname = existingUserByEmail.nickname || nickname;
          finalProfileImage = existingUserByEmail.profile_image || profileImage;
        } else {
          // 다른 카카오 계정으로 연동됨
          userId = existingUserByEmail.id;
          userRole = existingUserByEmail.role || 'user';
          needsOnboarding = !existingUserByEmail.is_onboarding_complete;
          finalNickname = existingUserByEmail.nickname || nickname;
          finalProfileImage = existingUserByEmail.profile_image || profileImage;
        }
        
        // JWT 세션 생성 및 리다이렉트
        return await createSessionAndRedirect(request, {
          userId,
          kakaoId,
          email,
          nickname: finalNickname,
          profileImage: finalProfileImage,
          role: userRole,
          needsOnboarding
        });
      }
    }

    // 6. 카카오 ID로 기존 계정 확인
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('kakao_id', kakaoId)
      .single();

    if (existingUser) {
      // ★ 차단/정지/탈퇴 확인
      if (existingUser.deleted_at) {
        return NextResponse.redirect(new URL('/login?error=account_deleted', request.url));
      }
      if (existingUser.is_banned) {
        return NextResponse.redirect(new URL('/login?error=account_banned', request.url));
      }
      if (existingUser.is_suspended) {
        const suspendedUntil = existingUser.suspended_until 
          ? new Date(existingUser.suspended_until).toISOString()
          : '';
        return NextResponse.redirect(
          new URL(`/login?error=account_suspended&until=${encodeURIComponent(suspendedUntil)}`, request.url)
        );
      }

      // 기존 사용자 - 정보 업데이트
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          nickname: existingUser.nickname || nickname,
          profile_image: profileImage,
          email,
          last_login_at: new Date().toISOString(),
          login_count: (existingUser.login_count || 0) + 1,
        })
        .eq('kakao_id', kakaoId)
        .select()
        .single();

      if (updateError || !updatedUser) {
        console.error('User update error:', updateError);
        return NextResponse.redirect(new URL('/login?error=db_error', request.url));
      }
      
      userId = updatedUser.id;
      userRole = updatedUser.role || 'user';
      needsOnboarding = !updatedUser.is_onboarding_complete;
      finalNickname = updatedUser.nickname;
      finalProfileImage = updatedUser.profile_image;
    } else {
      // 새 사용자 생성
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          kakao_id: kakaoId,
          nickname,
          profile_image: profileImage,
          email,
          is_onboarding_complete: false,
        })
        .select()
        .single();

      if (createError || !newUser) {
        console.error('User creation error:', createError);
        return NextResponse.redirect(new URL('/login?error=db_error', request.url));
      }
      
      userId = newUser.id;
      needsOnboarding = true;
      finalNickname = nickname;
      finalProfileImage = profileImage;
    }

    // 7. JWT 세션 생성 및 리다이렉트
    return await createSessionAndRedirect(request, {
      userId,
      kakaoId,
      email,
      nickname: finalNickname,
      profileImage: finalProfileImage,
      role: userRole,
      needsOnboarding
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
  
  // JWT 세션 쿠키 생성
  const sessionToken = await createUserSession({
    userId,
    kakaoId,
    email: email || undefined,
    nickname,
    profileImage,
    role,
  });

  // 쿠키 설정 및 리다이렉트
  const redirectUrl = needsOnboarding ? '/onboarding' : '/';
  const response = NextResponse.redirect(new URL(redirectUrl, request.url));
  
  response.cookies.set(USER_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  // OAuth 관련 쿠키 삭제
  response.cookies.delete(OAUTH_STATE_COOKIE);

  return response;
}
