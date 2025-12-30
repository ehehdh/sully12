import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserSession, USER_SESSION_COOKIE, UserSessionPayload } from '@/lib/session';

// 이 라우트는 쿠키를 사용하므로 항상 동적으로 실행되어야 함
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/me
 * 현재 로그인된 사용자 정보 반환 (JWT 기반)
 */
export async function GET(request: NextRequest) {
  try {
    // JWT 세션 검증
    const session = await getUserSession(request);

    if (!session) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // DB에서 최신 사용자 정보 조회
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const fallbackUser = buildFallbackUser(session);
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { user: fallbackUser, warning: 'Config error' },
        { status: 200 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.userId)
      .single();

    if (error) {
      const isNotFound = error.code === 'PGRST116' || error.message?.includes('Results contain 0 rows');
      if (isNotFound) {
        // Session user missing in DB; clear cookie.
        const response = NextResponse.json({ user: null }, { status: 200 });
        response.cookies.delete(USER_SESSION_COOKIE);
        return response;
      }
      return NextResponse.json(
        { user: fallbackUser, warning: 'User lookup failed' },
        { status: 200 }
      );
    }

    if (!user) {
      // Session user missing in DB; clear cookie.
      const response = NextResponse.json({ user: null }, { status: 200 });
      response.cookies.delete(USER_SESSION_COOKIE);
      return response;
    }

    if (user.is_banned) {
      const response = NextResponse.json({ 
        user: null, 
        error: 'Account has been banned' 
      }, { status: 403 });
      response.cookies.delete(USER_SESSION_COOKIE);
      return response;
    }

    if (user.is_suspended) {
      // 정지된 사용자는 정보는 반환하되 상태 표시
      return NextResponse.json({
        user: {
          id: user.id,
          kakaoId: user.kakao_id,
          googleId: user.google_id,
          nickname: user.nickname,
          profileImage: user.profile_image,
          email: user.email,
          role: user.role,
          createdAt: user.created_at,
          isOnboardingComplete: user.is_onboarding_complete ?? true,
          isSuspended: true,
        },
        warning: 'Account is currently suspended'
      });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        kakaoId: user.kakao_id,
        googleId: user.google_id,
        nickname: user.nickname,
        profileImage: user.profile_image,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
        isOnboardingComplete: user.is_onboarding_complete ?? true,
      }
    });

  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

function buildFallbackUser(session: UserSessionPayload) {
  const issuedAt = typeof session.iat === 'number'
    ? new Date(session.iat * 1000).toISOString()
    : new Date().toISOString();

  return {
    id: session.userId,
    kakaoId: session.kakaoId,
    googleId: session.googleId,
    nickname: session.nickname || 'User',
    profileImage: session.profileImage ?? null,
    email: session.email ?? null,
    role: (session.role as 'user' | 'moderator' | 'admin') || 'user',
    createdAt: issuedAt,
    isOnboardingComplete: true,
  };
}
