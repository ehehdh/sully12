import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateVerificationCode, hashVerificationCode } from '@/lib/crypto';
import { sendVerificationCode } from '@/lib/email';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// Rate Limit 설정
const EMAIL_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }; // 이메일당 시간당 5회
const IP_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 };   // IP당 시간당 10회

/**
 * POST /api/auth/email/send-code
 * 이메일 인증 코드 발송
 */
export async function POST(request: NextRequest) {
  try {
    const { email, type = 'signup' } = await request.json();
    
    // 이메일 유효성 검사
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: '올바른 이메일 형식이 아닙니다.' }, { status: 400 });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    const clientIP = getClientIP(request);
    
    // Supabase 연결
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 회원가입인 경우 이메일 중복 확인
    if (type === 'signup') {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, provider')
        .eq('email', normalizedEmail)
        .single();
      
      if (existingUser) {
        const provider = existingUser.provider || 'social';
        if (provider === 'email') {
          return NextResponse.json({ 
            error: '이미 가입된 이메일입니다.' 
          }, { status: 409 });
        } else {
          return NextResponse.json({ 
            error: `이 이메일은 ${provider === 'kakao' ? '카카오' : '구글'} 계정으로 가입되어 있습니다.` 
          }, { status: 409 });
        }
      }
    }
    
    // Rate Limit 체크 - 이메일
    const emailRateOk = await checkRateLimitDB(
      supabase, 
      'email', 
      normalizedEmail, 
      EMAIL_RATE_LIMIT.limit, 
      EMAIL_RATE_LIMIT.windowMs
    );
    
    if (!emailRateOk) {
      return NextResponse.json({ 
        error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' 
      }, { status: 429 });
    }
    
    // Rate Limit 체크 - IP
    const ipRateOk = await checkRateLimitDB(
      supabase, 
      'ip', 
      clientIP, 
      IP_RATE_LIMIT.limit, 
      IP_RATE_LIMIT.windowMs
    );
    
    if (!ipRateOk) {
      return NextResponse.json({ 
        error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' 
      }, { status: 429 });
    }
    
    // 인증 코드 생성
    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분
    
    // 기존 미사용 코드 무효화 (같은 이메일, 같은 타입)
    await supabase
      .from('email_verifications')
      .update({ verified: true })
      .eq('email', normalizedEmail)
      .eq('type', type)
      .eq('verified', false);
    
    // 새 인증 코드 저장
    const { error: insertError } = await supabase
      .from('email_verifications')
      .insert({
        email: normalizedEmail,
        code_hash: codeHash,
        type,
        expires_at: expiresAt.toISOString(),
        ip_address: clientIP,
      });
    
    if (insertError) {
      console.error('Insert verification error:', insertError);
      return NextResponse.json({ error: '인증 코드 생성 실패' }, { status: 500 });
    }
    
    // 이메일 발송
    const emailResult = await sendVerificationCode(normalizedEmail, code);
    
    if (!emailResult.success) {
      console.error('Email send failed:', emailResult.error);
      return NextResponse.json({ 
        error: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '인증 코드가 발송되었습니다.',
      expiresIn: 600, // 10분 (초)
    });
    
  } catch (error) {
    console.error('Send code error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * DB 기반 Rate Limit 체크
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkRateLimitDB(
  supabase: any,
  type: 'email' | 'ip',
  value: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  
  const column = type === 'email' ? 'email' : 'ip_address';
  
  const { count, error } = await supabase
    .from('email_verifications')
    .select('*', { count: 'estimated', head: true })
    .eq(column, value)
    .gte('created_at', since.toISOString());
  
  if (error) {
    console.error('Rate limit check error:', error);
    return true; // 에러 시 허용 (서비스 중단 방지)
  }
  
  return (count || 0) < limit;
}
