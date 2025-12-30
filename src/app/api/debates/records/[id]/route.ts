import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserSession, getAdminSession } from '@/lib/session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/debates/records/[id]
 * 토론 기록 상세 조회 (메시지 포함)
 * - 공개 토론: 누구나 조회 가능 (메시지는 참가자/관리자만)
 * - 비공개 토론: 참가자/관리자만 조회 가능
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // 현재 사용자 세션 확인
    const userSession = await getUserSession(request);
    const adminSession = await getAdminSession(request);
    const isAdmin = !!adminSession;
    const currentUserId = userSession?.userId;
    
    // 토론 기록 조회
    const { data: record, error: recordError } = await supabase
      .from('debate_records')
      .select('*')
      .eq('id', id)
      .single();
    
    if (recordError || !record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
    
    // 참가자 여부 확인
    const isParticipant = currentUserId && (
      record.pro_user_id === currentUserId || 
      record.con_user_id === currentUserId
    );
    
    // 공개 여부 확인 (is_public 필드가 없으면 기본값 true)
    const isPublic = record.is_public !== false;
    
    // 접근 권한 확인
    if (!isPublic && !isParticipant && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied: This debate record is private' }, 
        { status: 403 }
      );
    }
    
    // 메시지 조회 (참가자 또는 관리자만)
    let messages: any[] = [];
    if (isParticipant || isAdmin) {
      const { data: messagesData, error: messagesError } = await supabase
        .from('debate_messages_archive')
        .select('*')
        .eq('debate_record_id', id)
        .order('original_created_at', { ascending: true });
      
      if (messagesError) {
        console.error('Fetch messages error:', messagesError);
      } else {
        messages = messagesData || [];
      }
    }
    
    // 응답 데이터 구성
    const responseData: any = {
      record,
      messages,
    };
    
    // 메시지 접근 불가 시 안내
    if (!isParticipant && !isAdmin && messages.length === 0) {
      responseData.messageAccessNote = 'Messages are only visible to participants and administrators';
    }
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('Fetch record API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/debates/records/[id]
 * 토론 기록 삭제 (관리자 전용)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  
  // 관리자 권한 확인
  const adminSession = await getAdminSession(request);
  
  if (!adminSession) {
    return NextResponse.json(
      { error: 'Forbidden: Admin access required' }, 
      { status: 403 }
    );
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // 기록 존재 여부 확인
    const { data: record, error: findError } = await supabase
      .from('debate_records')
      .select('id')
      .eq('id', id)
      .single();
    
    if (findError || !record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
    
    // 관련 메시지 먼저 삭제
    await supabase
      .from('debate_messages_archive')
      .delete()
      .eq('debate_record_id', id);
    
    // 토론 기록 삭제
    const { error } = await supabase
      .from('debate_records')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Delete record error:', error);
      return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Debate record deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
