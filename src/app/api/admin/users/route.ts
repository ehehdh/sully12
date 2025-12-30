import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminSession, ADMIN_SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users
 * 전체 사용자 목록 조회 (관리자 전용)
 */
export async function GET(request: NextRequest) {
  // 인증 확인 (Middleware가 처리하지만 Double Check)
  const adminSession = await getAdminSession(request);
  if (!adminSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { searchParams } = new URL(request.url);
  
  const search = searchParams.get('search') || '';
  const role = searchParams.get('role') || '';
  const status = searchParams.get('status') || ''; // 'active', 'suspended', 'banned', 'deleted'
  const sortBy = searchParams.get('sortBy') || 'created_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  try {
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' });
    
    // 검색
    if (search) {
      // 닉네임, 이메일(있는 경우), 실명 검색
      query = query.or(`nickname.ilike.%${search}%,email.ilike.%${search}%,real_name.ilike.%${search}%`);
    }
    
    // 역할 필터
    if (role) {
      query = query.eq('role', role);
    }
    
    // 상태 필터 (수정됨)
    if (status === 'deleted') {
      query = query.not('deleted_at', 'is', null);
    } else {
      // 삭제되지 않은 사용자 중에서 필터링
      query = query.is('deleted_at', null);
      
      if (status === 'active') {
        query = query.eq('is_banned', false).eq('is_suspended', false);
      } else if (status === 'suspended') {
        query = query.eq('is_suspended', true);
      } else if (status === 'banned') {
        query = query.eq('is_banned', true);
      }
    }
    
    // 정렬
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    
    // 페이지네이션
    query = query.range(offset, offset + limit - 1);
    
    const { data: users, error, count } = await query;
    
    if (error) {
      console.error('Fetch users error:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
    
    // 사용자 통계 (Optional)
    // 성능을 위해 필요할 때만 가져오는 것이 좋음
    const enrichedUsers = users;
    
    return NextResponse.json({
      users: enrichedUsers,
      total: count || 0,
      limit,
      offset
    });
    
  } catch (error) {
    console.error('Admin users API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users
 * 사용자 상태 변경 (정지, 차단, 역할 변경)
 */
export async function PATCH(request: NextRequest) {
  // 인증 확인
  const adminSession = await getAdminSession(request);
  if (!adminSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId, action, reason } = await request.json();
    
    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 대상 사용자 현재 상태 조회 (스냅샷용)
    const { data: targetUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let updateData: any = {};
    let logAction = '';
    
    switch (action) {
      case 'ban':
        updateData = { is_banned: true };
        logAction = 'ban_user';
        break;
      case 'unban':
        updateData = { is_banned: false };
        logAction = 'unban_user';
        break;
      case 'suspend':
        updateData = { is_suspended: true };
        logAction = 'suspend_user';
        break;
      case 'unsuspend':
        updateData = { is_suspended: false };
        logAction = 'unsuspend_user';
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // 사용자 업데이트
    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    // 활동 로그 기록
    await supabase.from('admin_activity_logs').insert({
      admin_id: '00000000-0000-0000-0000-000000000000', // 관리자 ID (세션에 없다면 임시)
      admin_identifier: 'admin', // 세션에서 가져와야 함 (여기선 하드코딩)
      action: logAction,
      target_type: 'user',
      target_id: userId,
      target_snapshot: targetUser,
      details: { reason },
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Admin user update error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
