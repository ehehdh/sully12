import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/debates/archive
 * 토론 종료 시 기록을 아카이브
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const { roomId } = await request.json();
    
    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }
    
    // 방 존재 확인
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    
    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    
    // 이미 아카이브된 경우 확인
    const { data: existingRecord } = await supabase
      .from('debate_records')
      .select('id')
      .eq('original_room_id', roomId)
      .single();
    
    if (existingRecord) {
      return NextResponse.json({ 
        success: true, 
        message: 'Already archived',
        recordId: existingRecord.id 
      });
    }
    
    // 아카이브 함수 호출
    const { data: recordId, error: archiveError } = await supabase
      .rpc('archive_debate', { p_room_id: roomId });
    
    if (archiveError) {
      console.error('Archive error:', archiveError);
      return NextResponse.json({ error: 'Failed to archive debate' }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      recordId,
      message: 'Debate archived successfully'
    });
    
  } catch (error) {
    console.error('Archive API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/debates/archive
 * 토론 기록 목록 조회
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { searchParams } = new URL(request.url);
  
  const userId = searchParams.get('userId');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  try {
    let query = supabase
      .from('debate_records')
      .select('*', { count: 'exact' })
      .order('ended_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // 특정 사용자의 기록만 조회
    if (userId) {
      query = query.or(`pro_user_id.eq.${userId},con_user_id.eq.${userId}`);
    }
    
    const { data: records, error, count } = await query;
    
    if (error) {
      console.error('Fetch records error:', error);
      return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    }
    
    return NextResponse.json({
      records,
      total: count,
      limit,
      offset
    });
    
  } catch (error) {
    console.error('Fetch API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
