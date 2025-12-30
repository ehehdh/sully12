import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hashPassword, validatePassword } from '@/lib/crypto';
import { createUserSession, USER_SESSION_COOKIE } from '@/lib/session';
import { sendWelcomeEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

interface RegisterRequestBody {
  email: string;
  password: string;
  verificationToken: string;
  nickname: string;
  realName?: string;
  gender?: 'male' | 'female' | 'other' | 'private';
  birthDate?: string;
  region?: string;
  agreedTerms: boolean;
  agreedPrivacy: boolean;
  agreedMarketing?: boolean;
  isUnder14Confirmed: boolean;
}

/**
 * POST /api/auth/email/register
 * 이메일 회원가입 완료
 */
export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequestBody = await request.json();
    
    const {
      email,
      password,
      verificationToken,
      nickname,
      realName,
      gender,
      birthDate,
      region,
      agreedTerms,
      agreedPrivacy,
      agreedMarketing = false,
      isUnder14Confirmed,
    } = body;
    
    // 필수값 검사
    if (!email || !password || !verificationToken || !nickname) {
      return NextResponse.json({ 
        error: '필수 정보를 모두 입력해주세요.' 
      }, { status: 400 });
    }
    
    // 약관 동의 검사
    if (!agreedTerms || !agreedPrivacy) {
      return NextResponse.json({ 
        error: '필수 약관에 동의해주세요.' 
      }, { status: 400 });
    }
    
    // 만 14세 이상 확인
    if (!isUnder14Confirmed) {
      return NextResponse.json({ 
        error: '만 14세 이상만 가입할 수 있습니다.' 
      }, { status: 400 });
    }
    
    // 인증 토큰 검증
    let tokenData;
    try {
      tokenData = JSON.parse(Buffer.from(verificationToken, 'base64').toString('utf-8'));
    } catch {
      return NextResponse.json({ 
        error: '유효하지 않은 인증 토큰입니다.' 
      }, { status: 400 });
    }
    
    if (tokenData.email !== email.toLowerCase().trim()) {
      return NextResponse.json({ 
        error: '이메일이 일치하지 않습니다.' 
      }, { status: 400 });
    }
    
    if (Date.now() > tokenData.expiresAt) {
      return NextResponse.json({ 
        error: '인증이 만료되었습니다. 다시 인증해주세요.' 
      }, { status: 400 });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    const trimmedNickname = nickname.trim();
    
    // 닉네임 유효성 검사
    if (trimmedNickname.length < 2 || trimmedNickname.length > 20) {
      return NextResponse.json({ 
        error: '닉네임은 2~20자 사이여야 합니다.' 
      }, { status: 400 });
    }
    
    // 비밀번호 정책 검사
    const passwordValidation = validatePassword(password, { email: normalizedEmail, nickname: trimmedNickname });
    if (!passwordValidation.valid) {
      return NextResponse.json({ 
        error: passwordValidation.errors[0] 
      }, { status: 400 });
    }
    
    // Supabase 연결
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 이메일 중복 확인 (최종)
    const { data: existingEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single();
    
    if (existingEmail) {
      return NextResponse.json({ 
        error: '이미 가입된 이메일입니다.' 
      }, { status: 409 });
    }
    
    // 닉네임 중복 확인
    const { data: existingNickname } = await supabase
      .from('users')
      .select('id')
      .eq('nickname', trimmedNickname)
      .single();
    
    if (existingNickname) {
      return NextResponse.json({ 
        error: '이미 사용 중인 닉네임입니다.' 
      }, { status: 409 });
    }
    
    // 비밀번호 해싱
    const passwordHash = await hashPassword(password);
    
    // 사용자 생성
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        email: normalizedEmail,
        password_hash: passwordHash,
        nickname: trimmedNickname,
        real_name: realName?.trim() || null,
        gender: gender || null,
        birth_date: birthDate || null,
        region: region || null,
        provider: 'email',
        email_verified: true,
        is_onboarding_complete: true,
        is_under_14_confirmed: true,
        age_confirmed_at: new Date().toISOString(),
        role: 'user',
      })
      .select()
      .single();
    
    if (insertError || !newUser) {
      console.error('User insert error:', insertError);
      return NextResponse.json({ 
        error: '회원가입에 실패했습니다.' 
      }, { status: 500 });
    }
    
    // 약관 동의 기록
    const termsToAgree = [
      { type: 'terms', agreed: true },
      { type: 'privacy', agreed: true },
      { type: 'marketing', agreed: agreedMarketing },
    ];
    
    for (const term of termsToAgree) {
      if (term.agreed) {
        // 현재 버전 조회
        const { data: currentVersion } = await supabase
          .from('terms_versions')
          .select('id')
          .eq('type', term.type)
          .eq('is_current', true)
          .single();
        
        if (currentVersion) {
          await supabase
            .from('user_agreements')
            .insert({
              user_id: newUser.id,
              terms_version_id: currentVersion.id,
              ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
            });
        }
      }
    }
    
    // JWT 세션 생성
    const sessionToken = await createUserSession({
      userId: newUser.id,
      email: normalizedEmail,
      nickname: trimmedNickname,
      profileImage: null,
      role: 'user',
    });
    
    // 환영 이메일 발송 (비동기, 실패해도 진행)
    sendWelcomeEmail(normalizedEmail, trimmedNickname).catch(err => {
      console.error('Welcome email failed:', err);
    });
    
    // 응답
    const response = NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다!',
      user: {
        id: newUser.id,
        email: normalizedEmail,
        nickname: trimmedNickname,
        profileImage: null,
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
    
    return response;
    
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
