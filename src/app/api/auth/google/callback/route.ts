import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createUserSession, USER_SESSION_COOKIE } from '@/lib/session';
import { 
  verifyOAuthState, 
  OAUTH_STATE_COOKIE, 
  OAUTH_CODE_VERIFIER_COOKIE 
} from '@/lib/oauth';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name?: string;
  picture: string;
}

/**
 * 구글 로그인 콜백 - 토큰 교환 및 사용자 정보 저장
 * State 검증, 이메일 검증 확인 추가
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // 에러 처리
  if (error) {
    console.error('Google auth error:', error);
    return NextResponse.redirect(new URL('/login?error=google_auth_failed', request.url));
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

  const stateVerification = await verifyOAuthState(savedState, 'google');
  if (!stateVerification.valid || state !== savedState) {
    console.error('OAuth state verification failed');
    return NextResponse.redirect(new URL('/login?error=invalid_state', request.url));
  }

  // Code verifier 가져오기 (PKCE)
  const codeVerifier = request.cookies.get(OAUTH_CODE_VERIFIER_COOKIE)?.value;
  if (!codeVerifier) {
    console.error('Code verifier missing');
    return NextResponse.redirect(new URL('/login?error=invalid_request', request.url));
  }

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 
    `${request.nextUrl.origin}/api/auth/google/callback`;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/login?error=config_error', request.url));
  }

  try {
    // 1. 인가 코드로 토큰 요청 (PKCE code_verifier 포함)
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code: code,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(new URL('/login?error=token_failed', request.url));
    }

    const tokenData: GoogleTokenResponse = await tokenResponse.json();

    // 2. 액세스 토큰으로 사용자 정보 요청
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error('User info request failed');
      return NextResponse.redirect(new URL('/login?error=user_info_failed', request.url));
    }

    const userData: GoogleUserInfo = await userResponse.json();

    // 3. 이메일 검증 확인 (보안 강화)
    if (!userData.verified_email) {
      console.error('Email not verified:', userData.email);
      return NextResponse.redirect(new URL('/login?error=email_not_verified', request.url));
    }

    // 4. 사용자 정보 추출
    const googleId = userData.id;
    const email = userData.email;
    const nickname = userData.name || userData.given_name || `User${googleId.slice(-4)}`;
    const profileImage = userData.picture || null;

    // 5. Supabase 연결
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase credentials not configured');
      return NextResponse.redirect(new URL('/login?error=config_error', request.url));
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 6. 이메일로 기존 계정 확인
    const { data: existingUserByEmail } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    let userId: string;
    let userRole: string = 'user';
    let needsOnboarding = false;

    if (existingUserByEmail) {
      // 이메일로 기존 계정 존재
      if (existingUserByEmail.google_id === googleId) {
        // 이미 구글 연동된 계정 - 로그인
        userId = existingUserByEmail.id;
        userRole = existingUserByEmail.role || 'user';
        needsOnboarding = !existingUserByEmail.is_onboarding_complete;
        
        // 마지막 로그인 시간 업데이트
        await supabase
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', userId);
          
      } else if (existingUserByEmail.google_id === null && existingUserByEmail.kakao_id) {
        // 카카오로 가입된 계정 - 구글 연동 필요
        const provider = existingUserByEmail.kakao_id ? '카카오' : '다른 방법';
        return NextResponse.redirect(
          new URL(`/login?error=email_exists&provider=${provider}`, request.url)
        );
      } else {
        // 구글 ID 연동
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            google_id: googleId,
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
      }
    } else {
      // 구글 ID로 기존 계정 확인
      const { data: existingUserByGoogleId } = await supabase
        .from('users')
        .select('*')
        .eq('google_id', googleId)
        .single();

      if (existingUserByGoogleId) {
        // 구글 ID로 가입된 계정 존재 (이메일이 변경된 경우)
        userId = existingUserByGoogleId.id;
        userRole = existingUserByGoogleId.role || 'user';
        needsOnboarding = !existingUserByGoogleId.is_onboarding_complete;
        
        await supabase
          .from('users')
          .update({ 
            email,
            last_login_at: new Date().toISOString()
          })
          .eq('id', userId);
      } else {
        // 신규 사용자 - 회원가입
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            google_id: googleId,
            email,
            nickname,
            profile_image: profileImage,
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
      }
    }

    // 7. JWT 세션 쿠키 생성
    const sessionToken = await createUserSession({
      userId,
      email,
      nickname,
      profileImage,
      googleId,
      role: userRole,
    });

    // 8. 쿠키 설정 및 리다이렉트
    const redirectUrl = needsOnboarding ? '/onboarding' : '/';
    const response = NextResponse.redirect(new URL(redirectUrl, request.url));
    
    // JWT 세션 쿠키 설정
    response.cookies.set(USER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    // OAuth 관련 쿠키 삭제
    response.cookies.delete(OAUTH_STATE_COOKIE);
    response.cookies.delete(OAUTH_CODE_VERIFIER_COOKIE);

    return response;

  } catch (err) {
    console.error('Google callback error:', err);
    return NextResponse.redirect(new URL('/login?error=unknown', request.url));
  }
}
