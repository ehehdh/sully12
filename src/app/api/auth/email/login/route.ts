import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyPassword } from '@/lib/crypto';
import { createUserSession, USER_SESSION_COOKIE } from '@/lib/session';
import { checkRateLimit, getClientIP, getRateLimitHeaders } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/email/login
 * 이메일/비밀번호 로그인
 */
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  
  // Rate Limit 체크 (15분에 10회)
  const rateLimit = checkRateLimit(`email-login:${clientIP}`, 10, 15 * 60 * 1000);
  
  if (!rateLimit.allowed) {
    const response = NextResponse.json({ 
      error: '너무 많은 로그인 시도입니다. 잠시 후 다시 시도해주세요.' 
    }, { status: 429 });
    
    const headers = getRateLimitHeaders(rateLimit);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  }
  
  try {
    const { email, password } = await request.json();
    
    // 필수값 검사
    if (!email || !password) {
      return NextResponse.json({ 
        error: '이메일과 비밀번호를 입력해주세요.' 
      }, { status: 400 });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Supabase 연결
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 사용자 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, password_hash, nickname, profile_image, provider, role, is_banned, is_suspended')
      .eq('email', normalizedEmail)
      .single();
    
    // 사용자 없음 (보안: 일반적인 메시지)
    if (userError || !user) {
      return NextResponse.json({ 
        error: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      }, { status: 401 });
    }
    
    // 소셜 로그인 계정
    if (user.provider !== 'email') {
      const providerName = user.provider === 'kakao' ? '카카오' : 
                          user.provider === 'google' ? '구글' : '소셜';
      return NextResponse.json({ 
        error: `이 계정은 ${providerName} 로그인을 사용합니다.` 
      }, { status: 400 });
    }
    
    // 비밀번호 없음
    if (!user.password_hash) {
      return NextResponse.json({ 
        error: '비밀번호가 설정되지 않았습니다. 비밀번호 재설정을 이용해주세요.' 
      }, { status: 400 });
    }
    
    // 비밀번호 검증
    const isValidPassword = await verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) {
      return NextResponse.json({ 
        error: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      }, { status: 401 });
    }
    
    // 계정 상태 확인
    if (user.is_banned) {
      return NextResponse.json({ 
        error: '차단된 계정입니다.' 
      }, { status: 403 });
    }
    
    // 로그인 카운트 증가
    await supabase
      .from('users')
      .update({ 
        login_count: (user as { login_count?: number }).login_count ? (user as { login_count?: number }).login_count! + 1 : 1,
        last_active_at: new Date().toISOString(),
      })
      .eq('id', user.id);
    
    // JWT 세션 생성
    const sessionToken = await createUserSession({
      userId: user.id,
      email: user.email,
      nickname: user.nickname,
      profileImage: user.profile_image,
      role: user.role || 'user',
    });
    
    // 응답
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        profileImage: user.profile_image,
        isSuspended: user.is_suspended,
      },
    });
    
    // 세션 쿠키 설정
    response.cookies.set(USER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7일
      path: '/',
    });
    
    // Rate Limit 헤더 추가
    const headers = getRateLimitHeaders(rateLimit);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
    
  } catch (error) {
    console.error('Email login error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
