import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/debates/records/[id]
 * 토론 기록 상세 조회 (메시지 포함)
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
    // 토론 기록 조회
    const { data: record, error: recordError } = await supabase
      .from('debate_records')
      .select('*')
      .eq('id', id)
      .single();
    
    if (recordError || !record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
    
    // 메시지 조회
    const { data: messages, error: messagesError } = await supabase
      .from('debate_messages_archive')
      .select('*')
      .eq('debate_record_id', id)
      .order('original_created_at', { ascending: true });
    
    if (messagesError) {
      console.error('Fetch messages error:', messagesError);
    }
    
    return NextResponse.json({
      record,
      messages: messages || []
    });
    
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
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // TODO: 관리자 권한 확인
    
    const { error } = await supabase
      .from('debate_records')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Delete record error:', error);
      return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Delete API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
