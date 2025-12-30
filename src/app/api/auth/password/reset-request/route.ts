import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateResetToken } from '@/lib/crypto';
import { sendPasswordResetEmail } from '@/lib/email';
import { getClientIP } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/password/reset-request
 * 비밀번호 재설정 요청 (이메일 발송)
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    // 이메일 유효성 검사
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 });
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
    
    // Rate Limit 체크 (이메일당 시간당 3회)
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const { count } = await supabase
      .from('password_resets')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', clientIP)
      .gte('created_at', since.toISOString());
    
    if ((count || 0) >= 5) {
      return NextResponse.json({ 
        error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' 
      }, { status: 429 });
    }
    
    // 사용자 조회 (이메일 가입자만)
    const { data: user } = await supabase
      .from('users')
      .select('id, provider')
      .eq('email', normalizedEmail)
      .single();
    
    // 보안: 사용자 존재 여부와 관계없이 동일한 응답
    // (이메일 열거 공격 방지)
    if (!user) {
      // 의도적 지연 (타이밍 공격 방지)
      await new Promise(resolve => setTimeout(resolve, 500));
      return NextResponse.json({ 
        success: true, 
        message: '가입된 이메일이라면 재설정 링크가 발송됩니다.' 
      });
    }
    
    // 소셜 로그인 계정인 경우
    if (user.provider !== 'email') {
      // 의도적 지연
      await new Promise(resolve => setTimeout(resolve, 500));
      return NextResponse.json({ 
        success: true, 
        message: '가입된 이메일이라면 재설정 링크가 발송됩니다.' 
      });
    }
    
    // 기존 미사용 토큰 무효화
    await supabase
      .from('password_resets')
      .update({ used: true })
      .eq('user_id', user.id)
      .eq('used', false);
    
    // 토큰 생성
    const { token, hash } = generateResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30분
    
    // 토큰 저장
    const { error: insertError } = await supabase
      .from('password_resets')
      .insert({
        user_id: user.id,
        token_hash: hash,
        expires_at: expiresAt.toISOString(),
        ip_address: clientIP,
      });
    
    if (insertError) {
      console.error('Insert reset token error:', insertError);
      return NextResponse.json({ error: '요청 처리 실패' }, { status: 500 });
    }
    
    // 재설정 링크 생성
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/password-reset?token=${token}`;
    
    // 이메일 발송
    const emailResult = await sendPasswordResetEmail(normalizedEmail, resetLink);
    
    if (!emailResult.success) {
      console.error('Password reset email failed:', emailResult.error);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '가입된 이메일이라면 재설정 링크가 발송됩니다.' 
    });
    
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
