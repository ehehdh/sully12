import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface SessionData {
  userId: string;
  kakaoId: string;
  nickname: string;
  profileImage: string | null;
  expiresAt: number;
}

/**
 * 현재 로그인된 사용자 정보 반환
 */
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('politi-log-session');

  if (!sessionCookie?.value) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  try {
    // 세션 토큰 디코딩
    const sessionData: SessionData = JSON.parse(
      Buffer.from(sessionCookie.value, 'base64').toString('utf-8')
    );

    // 만료 확인
    if (Date.now() > sessionData.expiresAt) {
      const response = NextResponse.json({ user: null, error: 'Session expired' }, { status: 401 });
      response.cookies.delete('politi-log-session');
      return response;
    }

    // DB에서 최신 사용자 정보 조회
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ user: null, error: 'Config error' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id, kakao_id, nickname, profile_image, email, role, created_at')
      .eq('id', sessionData.userId)
      .single();

    if (error || !user) {
      const response = NextResponse.json({ user: null }, { status: 200 });
      response.cookies.delete('politi-log-session');
      return response;
    }

    return NextResponse.json({
      user: {
        id: user.id,
        kakaoId: user.kakao_id,
        nickname: user.nickname,
        profileImage: user.profile_image,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
      }
    });

  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
