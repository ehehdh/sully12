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
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

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
    // 1. 토큰 요청
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

    // 2. 사용자 정보 요청
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      console.error('User info request failed');
      return NextResponse.redirect(new URL('/login?error=user_info_failed', request.url));
    }

    const userData: GoogleUserInfo = await userResponse.json();

    // 3. 이메일 검증 확인
    if (!userData.verified_email) {
      console.error('Email not verified:', userData.email);
      return NextResponse.redirect(new URL('/login?error=email_not_verified', request.url));
    }

    const googleId = userData.id;
    const email = userData.email;
    const nickname = userData.name || userData.given_name || `User${googleId.slice(-4)}`;
    const profileImage = userData.picture || null;

    // 4. Supabase 연결
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

    // 5. 이메일로 기존 계정 확인
    const { data: existingUserByEmail } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existingUserByEmail) {
      // 차단/정지/탈퇴 확인 (컬럼이 있는 경우만)
      if (existingUserByEmail.deleted_at) {
        return NextResponse.redirect(new URL('/login?error=account_deleted', request.url));
      }
      if (existingUserByEmail.is_banned === true) {
        return NextResponse.redirect(new URL('/login?error=account_banned', request.url));
      }
      if (existingUserByEmail.is_suspended === true) {
        return NextResponse.redirect(new URL('/login?error=account_suspended', request.url));
      }

      userId = existingUserByEmail.id;
      userRole = existingUserByEmail.role || 'user';
      finalNickname = existingUserByEmail.nickname || nickname;
      needsOnboarding = existingUserByEmail.is_onboarding_complete === false;
      
      // 로그인 시간 업데이트 (실패해도 무시)
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);

      if (!existingUserByEmail.google_id) {
        // 구글 ID 연동
        await supabase
          .from('users')
          .update({ google_id: googleId })
          .eq('id', userId);
      }
    } else {
      // 6. 구글 ID로 기존 계정 확인
      const { data: existingUserByGoogleId } = await supabase
        .from('users')
        .select('*')
        .eq('google_id', googleId)
        .single();

      if (existingUserByGoogleId) {
        // 차단/정지/탈퇴 확인
        if (existingUserByGoogleId.deleted_at) {
          return NextResponse.redirect(new URL('/login?error=account_deleted', request.url));
        }
        if (existingUserByGoogleId.is_banned === true) {
          return NextResponse.redirect(new URL('/login?error=account_banned', request.url));
        }
        if (existingUserByGoogleId.is_suspended === true) {
          return NextResponse.redirect(new URL('/login?error=account_suspended', request.url));
        }

        userId = existingUserByGoogleId.id;
        userRole = existingUserByGoogleId.role || 'user';
        finalNickname = existingUserByGoogleId.nickname || nickname;
        needsOnboarding = existingUserByGoogleId.is_onboarding_complete === false;
        
        // 로그인 시간 업데이트
        await supabase
          .from('users')
          .update({ 
            email,
            last_login_at: new Date().toISOString()
          })
          .eq('id', userId);
      } else {
        // 7. 신규 사용자 생성 (최소 필드만)
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            google_id: googleId,
            email,
            nickname,
            profile_image: profileImage,
          })
          .select()
          .single();

        if (createError || !newUser) {
          console.error('User creation error:', createError);
          return NextResponse.redirect(new URL('/login?error=db_error', request.url));
        }
        
        userId = newUser.id;
        finalNickname = nickname;
        needsOnboarding = true;
      }
    }

    // 8. JWT 세션 생성
    const sessionToken = await createUserSession({
      userId,
      email,
      nickname: finalNickname,
      profileImage,
      googleId,
      role: userRole,
    });

    // 9. 쿠키 설정 및 리다이렉트
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
    response.cookies.delete(OAUTH_CODE_VERIFIER_COOKIE);

    console.log(`Google login success: ${userId} (${finalNickname})`);
    return response;

  } catch (err) {
    console.error('Google callback error:', err);
    return NextResponse.redirect(new URL('/login?error=unknown', request.url));
  }
}
