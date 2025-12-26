import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/admin/reports
 * 신고 목록 조회 (관리자 전용)
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { searchParams } = new URL(request.url);
  
  const status = searchParams.get('status') || ''; // 'pending', 'reviewing', 'resolved', 'dismissed'
  const reason = searchParams.get('reason') || '';
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  try {
    let query = supabase
      .from('reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (reason) {
      query = query.eq('reason', reason);
    }
    
    query = query.range(offset, offset + limit - 1);
    
    const { data: reports, error, count } = await query;
    
    if (error) {
      console.error('Fetch reports error:', error);
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }
    
    // 통계
    const { data: statsData } = await supabase
      .from('reports')
      .select('status');
    
    const stats = {
      total: statsData?.length || 0,
      pending: statsData?.filter(r => r.status === 'pending').length || 0,
      reviewing: statsData?.filter(r => r.status === 'reviewing').length || 0,
      resolved: statsData?.filter(r => r.status === 'resolved').length || 0,
      dismissed: statsData?.filter(r => r.status === 'dismissed').length || 0
    };
    
    return NextResponse.json({
      reports,
      total: count || 0,
      stats,
      limit,
      offset
    });
    
  } catch (error) {
    console.error('Admin reports API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/reports
 * 신고 처리 (상태 변경, 제재 적용)
 */
export async function PATCH(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const { reportId, status, adminId, adminNote, actionTaken } = await request.json();
    
    if (!reportId) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
    }
    
    // 신고 정보 가져오기
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();
    
    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }
    
    // 신고 상태 업데이트
    const updateData: any = {
      status,
      admin_id: adminId,
      admin_note: adminNote,
      action_taken: actionTaken
    };
    
    if (status === 'reviewing') {
      updateData.reviewed_at = new Date().toISOString();
    } else if (status === 'resolved' || status === 'dismissed') {
      updateData.resolved_at = new Date().toISOString();
    }
    
    const { error: updateError } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', reportId);
    
    if (updateError) throw updateError;
    
    // 제재 적용 (resolved + action이 있는 경우)
    if (status === 'resolved' && actionTaken && actionTaken !== 'none') {
      let sanctionType = '';
      let durationDays = null;
      
      switch (actionTaken) {
        case 'warning':
          sanctionType = 'warning';
          break;
        case 'suspend_1d':
          sanctionType = 'suspend';
          durationDays = 1;
          break;
        case 'suspend_7d':
          sanctionType = 'suspend';
          durationDays = 7;
          break;
        case 'suspend_30d':
          sanctionType = 'suspend';
          durationDays = 30;
          break;
        case 'ban':
          sanctionType = 'ban';
          break;
      }
      
      if (sanctionType) {
        await supabase.rpc('apply_sanction', {
          p_user_id: report.reported_user_id,
          p_admin_id: adminId,
          p_sanction_type: sanctionType,
          p_duration_days: durationDays,
          p_reason: `신고 처리: ${adminNote || report.reason}`,
          p_report_id: reportId
        });
      }
    }
    
    return NextResponse.json({ success: true, message: 'Report processed' });
    
  } catch (error) {
    console.error('Process report API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
