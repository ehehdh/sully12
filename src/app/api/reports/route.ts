import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserSession } from '@/lib/session';

/**
 * POST /api/reports
 * 신고 접수 (사용자가 다른 사용자를 신고) - JWT 인증
 */
export async function POST(request: NextRequest) {
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
    const reporterId = session.userId;
    const reporterName = session.nickname || 'Unknown';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const {
      reportedUserId,
      reportedUserName,
      reason,
      reasonDetail,
      debateRecordId,
      roomId,
      messageContent
    } = await request.json();
    
    // 필수값 검증
    if (!reportedUserId || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // 자기 자신 신고 방지
    if (reporterId === reportedUserId) {
      return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 });
    }
    
    // 중복 신고 체크 (같은 사용자를 24시간 내 재신고 방지)
    const { data: existingReport } = await supabase
      .from('reports')
      .select('id')
      .eq('reporter_id', reporterId)
      .eq('reported_user_id', reportedUserId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .single();
    
    if (existingReport) {
      return NextResponse.json({ 
        error: 'Already reported this user within 24 hours' 
      }, { status: 429 });
    }
    
    // 신고 생성
    const { data: report, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: reporterId,
        reporter_name: reporterName,
        reported_user_id: reportedUserId,
        reported_user_name: reportedUserName,
        reason,
        reason_detail: reasonDetail,
        debate_record_id: debateRecordId || null,
        room_id: roomId || null,
        message_content: messageContent || null
      })
      .select()
      .single();
    
    if (error) {
      console.error('Create report error:', error);
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Report submitted',
      reportId: report.id 
    });
    
  } catch (error) {
    console.error('Report API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/reports
 * 내가 신고한/받은 목록 조회 - JWT 인증
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
    const type = searchParams.get('type') || 'sent'; // 'sent' or 'received'
    
    let query = supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (type === 'sent') {
      query = query.eq('reporter_id', userId);
    } else {
      query = query.eq('reported_user_id', userId);
    }
    
    const { data: reports, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }
    
    return NextResponse.json({ reports });
    
  } catch (error) {
    console.error('Fetch reports API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
