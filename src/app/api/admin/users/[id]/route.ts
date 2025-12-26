import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/users/[id]
 * 사용자 상세 정보 조회
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
    // 사용자 정보
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // 통계 정보
    const { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', id)
      .single();
    
    // 제재 이력
    const { data: sanctions } = await supabase
      .from('user_sanctions')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    // 신고 받은 내역
    const { data: reportedReports, count: reportedCount } = await supabase
      .from('reports')
      .select('*', { count: 'exact' })
      .eq('reported_user_id', id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    // 신고한 내역
    const { data: reporterReports, count: reporterCount } = await supabase
      .from('reports')
      .select('*', { count: 'exact' })
      .eq('reporter_id', id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    // 최근 토론 기록
    const { data: recentDebates } = await supabase
      .from('debate_records')
      .select('*')
      .or(`pro_user_id.eq.${id},con_user_id.eq.${id}`)
      .order('ended_at', { ascending: false })
      .limit(5);
    
    return NextResponse.json({
      user,
      stats: stats || null,
      sanctions: sanctions || [],
      reports: {
        received: reportedReports || [],
        receivedCount: reportedCount || 0,
        sent: reporterReports || [],
        sentCount: reporterCount || 0
      },
      recentDebates: recentDebates || []
    });
    
  } catch (error) {
    console.error('Admin user detail API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users/[id]
 * 사용자 정보 수정 (역할 변경, 제재 등)
 */
export async function PATCH(
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
    const body = await request.json();
    const { action, role, sanctionType, durationDays, reason, adminId, reportId } = body;
    
    if (action === 'change_role') {
      // 역할 변경
      const { error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', id);
      
      if (error) throw error;
      
      return NextResponse.json({ success: true, message: 'Role updated' });
      
    } else if (action === 'sanction') {
      // 제재 적용
      const { data: sanctionId, error } = await supabase
        .rpc('apply_sanction', {
          p_user_id: id,
          p_admin_id: adminId,
          p_sanction_type: sanctionType,
          p_duration_days: durationDays || null,
          p_reason: reason || null,
          p_report_id: reportId || null
        });
      
      if (error) throw error;
      
      return NextResponse.json({ 
        success: true, 
        message: 'Sanction applied',
        sanctionId 
      });
      
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Admin user update API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
