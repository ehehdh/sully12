import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminSession } from '@/lib/session';

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
    // 먼저 테이블 구조 확인을 위해 간단한 쿼리 실행
    const { data: sampleUser, error: sampleError } = await supabase
      .from('users')
      .select('*')
      .limit(1)
      .single();

    // deleted_at 컬럼 존재 여부 확인
    const hasDeletedAt = sampleUser && 'deleted_at' in sampleUser;
    const hasIsBanned = sampleUser && 'is_banned' in sampleUser;
    const hasIsSuspended = sampleUser && 'is_suspended' in sampleUser;

    // 기본 쿼리
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' });
    
    // 검색
    if (search) {
      // 닉네임, 이메일 검색
      query = query.or(`nickname.ilike.%${search}%,email.ilike.%${search}%`);
    }
    
    // 역할 필터
    if (role) {
      query = query.eq('role', role);
    }
    
    // 상태 필터 (컬럼 존재 여부에 따라 조건 적용)
    if (hasDeletedAt) {
      if (status === 'deleted') {
        query = query.not('deleted_at', 'is', null);
      } else {
        // 삭제되지 않은 사용자 중에서 필터링
        query = query.is('deleted_at', null);
        
        if (status === 'active' && hasIsBanned && hasIsSuspended) {
          query = query.eq('is_banned', false).eq('is_suspended', false);
        } else if (status === 'suspended' && hasIsSuspended) {
          query = query.eq('is_suspended', true);
        } else if (status === 'banned' && hasIsBanned) {
          query = query.eq('is_banned', true);
        }
      }
    } else {
      // deleted_at 컬럼이 없는 경우 상태 필터 적용
      if (status === 'active' && hasIsBanned && hasIsSuspended) {
        query = query.eq('is_banned', false).eq('is_suspended', false);
      } else if (status === 'suspended' && hasIsSuspended) {
        query = query.eq('is_suspended', true);
      } else if (status === 'banned' && hasIsBanned) {
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
    
    // 사용자 데이터 정규화 (누락된 필드에 기본값 추가)
    const normalizedUsers = (users || []).map(user => ({
      id: user.id,
      kakao_id: user.kakao_id || null,
      google_id: user.google_id || null,
      nickname: user.nickname,
      email: user.email || null,
      profile_image: user.profile_image || null,
      role: user.role || 'user',
      is_banned: user.is_banned ?? false,
      is_suspended: user.is_suspended ?? false,
      suspended_until: user.suspended_until || null,
      warning_count: user.warning_count ?? 0,
      created_at: user.created_at,
      last_login_at: user.last_login_at || null,
      deleted_at: user.deleted_at || null,
      // 통계는 별도 테이블에서 가져와야 하지만, 현재는 null
      stats: null,
    }));
    
    return NextResponse.json({
      users: normalizedUsers,
      total: count || 0,
      limit,
      offset,
      schemaInfo: {
        hasDeletedAt,
        hasIsBanned,
        hasIsSuspended,
      }
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const { userId, action, reason } = await request.json();
    
    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 대상 사용자 현재 상태 조회 (스냅샷용)
    const { data: targetUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};
    let logAction = '';
    
    switch (action) {
      case 'ban':
        updateData = { is_banned: true, ban_reason: reason || null };
        logAction = 'ban_user';
        break;
      case 'unban':
        updateData = { is_banned: false, ban_reason: null };
        logAction = 'unban_user';
        break;
      case 'suspend':
        updateData = { 
          is_suspended: true, 
          suspended_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 기본 7일
          suspended_reason: reason || null 
        };
        logAction = 'suspend_user';
        break;
      case 'unsuspend':
        updateData = { is_suspended: false, suspended_until: null, suspended_reason: null };
        logAction = 'unsuspend_user';
        break;
      case 'warn':
        updateData = { warning_count: (targetUser.warning_count || 0) + 1 };
        logAction = 'warn_user';
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
      console.error('User update error:', updateError);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    // 활동 로그 기록 시도 (테이블이 없어도 에러 무시)
    try {
      await supabase.from('admin_activity_logs').insert({
        admin_id: '00000000-0000-0000-0000-000000000000', // 관리자 ID (세션에 없다면 임시)
        admin_identifier: 'admin',
        action: logAction,
        target_type: 'user',
        target_id: userId,
        target_snapshot: targetUser,
        details: { reason, action },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      });
    } catch (logError) {
      console.warn('Failed to log admin activity:', logError);
      // 로그 실패는 무시
    }

    return NextResponse.json({ 
      success: true,
      message: `${action} action completed successfully`
    });

  } catch (error) {
    console.error('Admin user update error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
