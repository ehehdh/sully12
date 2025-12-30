import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserSession } from '@/lib/session';

/**
 * GET /api/users/me/history
 * 현재 로그인한 사용자의 토론 기록 조회 (JWT 인증)
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  
  // JWT 세션 검증
  const session = await getUserSession(request);
  
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  try {
    const userId = session.userId;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // 사용자의 토론 기록 조회 (찬성 또는 반대로 참가한 경우)
    const { data: records, error: recordsError, count } = await supabase
      .from('debate_records')
      .select('*', { count: 'exact' })
      .or(`pro_user_id.eq.${userId},con_user_id.eq.${userId}`)
      .order('ended_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (recordsError) {
      console.error('Fetch history error:', recordsError);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
    
    // 각 기록에 사용자가 어느 측이었는지, 승패 정보 추가
    const enrichedRecords = (records || []).map(record => {
      const isProSide = record.pro_user_id === userId;
      const myScore = isProSide ? record.final_score_pro : record.final_score_con;
      const opponentScore = isProSide ? record.final_score_con : record.final_score_pro;
      const opponentName = isProSide ? record.con_user_name : record.pro_user_name;
      
      let result: 'win' | 'loss' | 'draw';
      if (record.winner === 'draw') {
        result = 'draw';
      } else if ((record.winner === 'pro' && isProSide) || (record.winner === 'con' && !isProSide)) {
        result = 'win';
      } else {
        result = 'loss';
      }
      
      return {
        ...record,
        mySide: isProSide ? 'pro' : 'con',
        myScore,
        opponentScore,
        opponentName,
        result
      };
    });
    
    return NextResponse.json({
      records: enrichedRecords,
      total: count || 0,
      limit,
      offset
    });
    
  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
