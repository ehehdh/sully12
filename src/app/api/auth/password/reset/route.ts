import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken, hashPassword, validatePassword } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/password/reset
 * 비밀번호 재설정 (새 비밀번호 설정)
 */
export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();
    
    // 필수값 검사
    if (!token || !newPassword) {
      return NextResponse.json({ 
        error: '토큰과 새 비밀번호를 입력해주세요.' 
      }, { status: 400 });
    }
    
    // Supabase 연결
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 유효한 토큰 조회
    const { data: resets, error: fetchError } = await supabase
      .from('password_resets')
      .select('*, users(id, email, nickname)')
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (fetchError || !resets || resets.length === 0) {
      return NextResponse.json({ 
        error: '유효하지 않거나 만료된 링크입니다.' 
      }, { status: 400 });
    }
    
    // 토큰 해시 비교로 일치하는 항목 찾기
    let matchedReset = null;
    for (const reset of resets) {
      if (verifyToken(token, reset.token_hash)) {
        matchedReset = reset;
        break;
      }
    }
    
    if (!matchedReset) {
      return NextResponse.json({ 
        error: '유효하지 않거나 만료된 링크입니다.' 
      }, { status: 400 });
    }
    
    const user = matchedReset.users;
    if (!user) {
      return NextResponse.json({ 
        error: '사용자를 찾을 수 없습니다.' 
      }, { status: 400 });
    }
    
    // 비밀번호 정책 검사
    const passwordValidation = validatePassword(newPassword, { 
      email: user.email, 
      nickname: user.nickname 
    });
    
    if (!passwordValidation.valid) {
      return NextResponse.json({ 
        error: passwordValidation.errors[0] 
      }, { status: 400 });
    }
    
    // 비밀번호 해싱
    const passwordHash = await hashPassword(newPassword);
    
    // 비밀번호 업데이트
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', user.id);
    
    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json({ 
        error: '비밀번호 변경에 실패했습니다.' 
      }, { status: 500 });
    }
    
    // 토큰 사용 처리
    await supabase
      .from('password_resets')
      .update({ used: true })
      .eq('id', matchedReset.id);
    
    // 해당 사용자의 모든 미사용 토큰 무효화
    await supabase
      .from('password_resets')
      .update({ used: true })
      .eq('user_id', user.id)
      .eq('used', false);
    
    return NextResponse.json({ 
      success: true, 
      message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.' 
    });
    
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * GET /api/auth/password/reset
 * 토큰 유효성 확인
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.json({ valid: false, error: '토큰이 없습니다.' });
    }
    
    // Supabase 연결
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ valid: false, error: 'Server error' });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 유효한 토큰 조회
    const { data: resets } = await supabase
      .from('password_resets')
      .select('token_hash')
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .limit(10);
    
    if (!resets || resets.length === 0) {
      return NextResponse.json({ valid: false, error: '만료된 링크입니다.' });
    }
    
    // 토큰 해시 비교
    for (const reset of resets) {
      if (verifyToken(token, reset.token_hash)) {
        return NextResponse.json({ valid: true });
      }
    }
    
    return NextResponse.json({ valid: false, error: '유효하지 않은 링크입니다.' });
    
  } catch (error) {
    console.error('Token check error:', error);
    return NextResponse.json({ valid: false, error: '서버 오류' });
  }
}
