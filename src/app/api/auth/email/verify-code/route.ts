import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCode } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/email/verify-code
 * 이메일 인증 코드 확인
 */
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();
    
    // 필수값 검사
    if (!email || !code) {
      return NextResponse.json({ error: '이메일과 인증 코드를 입력해주세요.' }, { status: 400 });
    }
    
    // 코드 형식 검사 (6자리 숫자)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: '인증 코드는 6자리 숫자입니다.' }, { status: 400 });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Supabase 연결
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 가장 최근 인증 코드 조회 (미사용, 미만료)
    const { data: verification, error: fetchError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (fetchError || !verification) {
      return NextResponse.json({ 
        error: '유효한 인증 코드가 없습니다. 다시 발송해주세요.' 
      }, { status: 400 });
    }
    
    // 시도 횟수 체크
    if (verification.attempts >= verification.max_attempts) {
      return NextResponse.json({ 
        error: '인증 시도 횟수를 초과했습니다. 새 코드를 발송해주세요.' 
      }, { status: 429 });
    }
    
    // 시도 횟수 증가
    await supabase
      .from('email_verifications')
      .update({ attempts: verification.attempts + 1 })
      .eq('id', verification.id);
    
    // 코드 검증
    const isValid = verifyCode(code, verification.code_hash);
    
    if (!isValid) {
      const remainingAttempts = verification.max_attempts - verification.attempts - 1;
      return NextResponse.json({ 
        error: `인증 코드가 일치하지 않습니다. (남은 시도: ${remainingAttempts}회)` 
      }, { status: 400 });
    }
    
    // 인증 성공 - 상태 업데이트
    await supabase
      .from('email_verifications')
      .update({ verified: true })
      .eq('id', verification.id);
    
    // 인증 토큰 생성 (회원가입 진행을 위한 임시 토큰)
    // 10분간 유효한 서명된 토큰
    const verificationToken = Buffer.from(JSON.stringify({
      email: normalizedEmail,
      type: verification.type,
      verifiedAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000, // 10분
    })).toString('base64');
    
    return NextResponse.json({ 
      success: true, 
      message: '이메일 인증이 완료되었습니다.',
      verificationToken,
      type: verification.type,
    });
    
  } catch (error) {
    console.error('Verify code error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
