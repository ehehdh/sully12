import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserSession, createUserSession, USER_SESSION_COOKIE } from '@/lib/session';

/**
 * POST /api/auth/onboarding
 * 온보딩 완료 - 닉네임 저장 (JWT 인증)
 */
export async function POST(request: NextRequest) {
  // JWT 세션 검증
  const session = await getUserSession(request);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 요청 바디 파싱
    const body = await request.json();
    const { nickname } = body;

    // 닉네임 유효성 검사
    if (!nickname || typeof nickname !== 'string') {
      return NextResponse.json({ error: '닉네임을 입력해주세요.' }, { status: 400 });
    }

    const trimmedNickname = nickname.trim();

    if (trimmedNickname.length < 2) {
      return NextResponse.json({ error: '닉네임은 2자 이상이어야 합니다.' }, { status: 400 });
    }

    if (trimmedNickname.length > 20) {
      return NextResponse.json({ error: '닉네임은 20자 이하여야 합니다.' }, { status: 400 });
    }

    // Supabase 연결
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Config error' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 사용자 정보 업데이트
    const updateData: Record<string, unknown> = {
      nickname: trimmedNickname,
      is_onboarding_complete: true,
    };

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', session.userId)
      .select()
      .single();

    if (updateError || !updatedUser) {
      console.error('User update error:', updateError);
      return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 });
    }

    // 새 JWT 세션 생성 (닉네임 변경 반영)
    const newSessionToken = await createUserSession({
      userId: session.userId,
      email: session.email,
      nickname: trimmedNickname,
      profileImage: session.profileImage,
      googleId: session.googleId,
      kakaoId: session.kakaoId,
      role: session.role || 'user',
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        nickname: updatedUser.nickname,
        isOnboardingComplete: updatedUser.is_onboarding_complete,
      }
    });

    // JWT 세션 쿠키 업데이트
    response.cookies.set(USER_SESSION_COOKIE, newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;

  } catch (err) {
    console.error('Onboarding error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
