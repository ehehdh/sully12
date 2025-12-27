import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface SessionData {
  userId: string;
  kakaoId?: string;
  googleId?: string;
  nickname: string;
  profileImage: string | null;
  expiresAt: number;
}

/**
 * 온보딩 완료 - 닉네임 저장
 */
export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get('politi-log-session');

  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 세션 확인
    const sessionData: SessionData = JSON.parse(
      Buffer.from(sessionCookie.value, 'base64').toString('utf-8')
    );

    if (Date.now() > sessionData.expiresAt) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

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
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        nickname: trimmedNickname,
        is_onboarding_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionData.userId)
      .select()
      .single();

    if (updateError || !updatedUser) {
      console.error('User update error:', updateError);
      return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 });
    }

    // 세션 업데이트 (닉네임 변경 반영)
    const newSessionData = {
      ...sessionData,
      nickname: trimmedNickname,
    };

    const newSessionToken = Buffer.from(JSON.stringify(newSessionData)).toString('base64');

    const response = NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        nickname: updatedUser.nickname,
        isOnboardingComplete: updatedUser.is_onboarding_complete,
      }
    });

    // 세션 쿠키 업데이트
    response.cookies.set('politi-log-session', newSessionToken, {
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
