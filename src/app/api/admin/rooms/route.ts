import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const FALLBACK_ADMIN_ID = '00000000-0000-0000-0000-000000000000';
const FALLBACK_ADMIN_IDENTIFIER = 'admin';

function getClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * GET /api/admin/rooms
 * 토론방 목록 조회 (관리자 전용)
 */
export async function GET(request: NextRequest) {
  const supabase = getClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || '';
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    let query = supabase
      .from('rooms')
      .select('id, topic, title, description, stance, stage, created_at, updated_at, participants(id)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status === 'active') {
      query = query.neq('stage', 'ended');
    } else if (status === 'ended') {
      query = query.eq('stage', 'ended');
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Fetch rooms error:', error);
      return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
    }

    const rooms = (data || []).map((room: any) => ({
      ...room,
      participant_count: room.participants?.length || 0,
    }));

    return NextResponse.json({
      rooms,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Admin rooms API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/rooms
 * 토론방 강제 종료
 */
export async function PATCH(request: NextRequest) {
  const supabase = getClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { roomId, action, reason } = body;

    if (!roomId || action !== 'end') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('rooms')
      .update({
        stage: 'ended',
        stage_started_at: now,
        updated_at: now,
      })
      .eq('id', roomId);

    if (updateError) {
      console.error('Room end error:', updateError);
      return NextResponse.json({ error: 'Failed to end room' }, { status: 500 });
    }

    await supabase.from('messages').insert({
      room_id: roomId,
      role: 'moderator',
      content: `관리자에 의해 토론이 종료되었습니다.${reason ? `\n사유: ${reason}` : ''}`,
      message_type: 'admin-action',
    } as any);

    await supabase.from('admin_activity_logs').insert({
      admin_id: FALLBACK_ADMIN_ID,
      admin_identifier: FALLBACK_ADMIN_IDENTIFIER,
      action: 'force_end_room',
      target_type: 'room',
      target_id: roomId,
      target_snapshot: room,
      details: { reason: reason || null },
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin room update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/rooms?id=ROOM_ID
 * 토론방 삭제
 */
export async function DELETE(request: NextRequest) {
  const supabase = getClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('id');

  if (!roomId) {
    return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
  }

  try {
    const { data: room } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId);

    if (error) {
      console.error('Room delete error:', error);
      return NextResponse.json({ error: 'Failed to delete room' }, { status: 500 });
    }

    await supabase.from('admin_activity_logs').insert({
      admin_id: FALLBACK_ADMIN_ID,
      admin_identifier: FALLBACK_ADMIN_IDENTIFIER,
      action: 'delete_room',
      target_type: 'room',
      target_id: roomId,
      target_snapshot: room || null,
      details: null,
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin room delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
