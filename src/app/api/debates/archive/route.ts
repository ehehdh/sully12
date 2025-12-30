import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserSession, getAdminSession } from '@/lib/session';

/**
 * POST /api/debates/archive
 * 토론 종료 시 기록을 아카이브 (인증 필요)
 */
export async function POST(request: NextRequest) {
  // 사용자 인증 확인
  const userSession = await getUserSession(request);
  const adminSession = await getAdminSession(request);
  
  // 로그인한 사용자 또는 관리자만 아카이브 가능
  if (!userSession && !adminSession) {
    return NextResponse.json(
      { error: 'Unauthorized: Login required' }, 
      { status: 401 }
    );
  }
  
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
    
    // 참가자 또는 관리자인지 확인
    const isParticipant = userSession?.userId && (
      room.pro_user_id === userSession.userId || 
      room.con_user_id === userSession.userId
    );
    const isAdmin = !!adminSession;
    
    if (!isParticipant && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only participants or admins can archive this debate' }, 
        { status: 403 }
      );
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
 * - 공개 기록: 누구나 조회 가능
 * - 비공개 기록: 참가자/관리자만 조회 가능
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
  
  // 현재 사용자 세션 확인
  const userSession = await getUserSession(request);
  const adminSession = await getAdminSession(request);
  const currentUserId = userSession?.userId;
  const isAdmin = !!adminSession;
  
  try {
    let query = supabase
      .from('debate_records')
      .select('*', { count: 'exact' })
      .order('ended_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // 특정 사용자의 기록만 조회하는 경우
    if (userId) {
      // 본인 또는 관리자만 특정 사용자 기록 조회 가능
      if (userId === currentUserId || isAdmin) {
        query = query.or(`pro_user_id.eq.${userId},con_user_id.eq.${userId}`);
      } else {
        // 다른 사용자의 기록은 공개 기록만
        query = query
          .or(`pro_user_id.eq.${userId},con_user_id.eq.${userId}`)
          .eq('is_public', true);
      }
    } else {
      // 전체 조회 시
      if (!isAdmin) {
        // 관리자가 아니면 공개 기록 + 본인 참여 기록만
        if (currentUserId) {
          // 로그인한 경우: 공개 기록 + 본인 참여 기록
          query = query.or(
            `is_public.eq.true,pro_user_id.eq.${currentUserId},con_user_id.eq.${currentUserId}`
          );
        } else {
          // 비로그인: 공개 기록만
          query = query.eq('is_public', true);
        }
      }
      // 관리자는 모든 기록 조회 가능
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
