import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/admin/users
 * 전체 사용자 목록 조회 (관리자 전용)
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { searchParams } = new URL(request.url);
  
  const search = searchParams.get('search') || '';
  const role = searchParams.get('role') || '';
  const status = searchParams.get('status') || ''; // 'active', 'suspended', 'banned'
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
      query = query.or(`nickname.ilike.%${search}%,email.ilike.%${search}%`);
    }
    
    // 역할 필터
    if (role) {
      query = query.eq('role', role);
    }
    
    // 상태 필터
    if (status === 'active') {
      query = query.eq('is_banned', false).eq('is_suspended', false);
    } else if (status === 'suspended') {
      query = query.eq('is_suspended', true);
    } else if (status === 'banned') {
      query = query.eq('is_banned', true);
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
    
    // 각 사용자의 통계 정보 가져오기
    const userIds = (users || []).map(u => u.id);
    const { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .in('user_id', userIds);
    
    const statsMap = new Map((stats || []).map(s => [s.user_id, s]));
    
    const enrichedUsers = (users || []).map(user => ({
      ...user,
      stats: statsMap.get(user.id) || null
    }));
    
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
