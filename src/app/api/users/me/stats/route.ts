import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/users/me/stats
 * 현재 로그인한 사용자의 통계 조회
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  
  // 세션에서 사용자 ID 가져오기
  const sessionCookie = request.cookies.get('politi-log-session');
  
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  try {
    const sessionData = JSON.parse(
      Buffer.from(sessionCookie.value, 'base64').toString('utf-8')
    );
    
    if (Date.now() > sessionData.expiresAt) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }
    
    const userId = sessionData.userId;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 사용자 통계 조회
    const { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    // 통계가 없으면 기본값 반환
    if (statsError || !stats) {
      return NextResponse.json({
        stats: {
          user_id: userId,
          total_debates: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          win_rate: 0,
          pro_debates: 0,
          pro_wins: 0,
          con_debates: 0,
          con_wins: 0,
          avg_score: 50,
          highest_score: 50,
          lowest_score: 50,
          current_streak: 0,
          best_win_streak: 0,
          last_debate_at: null
        }
      });
    }
    
    return NextResponse.json({ stats });
    
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
