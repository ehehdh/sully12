/**
 * 토론 방 서비스
 * 
 * 방 생성, 참가, 퇴장 등의 핵심 로직을 담당합니다.
 * 
 * TODO: Redis 영속성 레이어 추가
 */

import { getSupabase } from '../../../lib/supabase';
import { 
  DebateRoom, 
  CreateRoomRequest, 
  JoinRoomRequest,
  RoomListFilter,
  Participant,
} from '../types';
import { DEFAULT_DEBATE_SETTINGS, INITIAL_SCORE } from '../constants';

// ============================================================
// 방 목록 조회
// ============================================================

export async function getRooms(filter?: RoomListFilter): Promise<DebateRoom[]> {
  const supabase = getSupabase();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('rooms')
    .select('*, participants(id, user_name, stance, role, is_online)');

  // 필터 적용
  if (filter?.status) {
    query = query.eq('status', filter.status);
  }
  if (filter?.topic) {
    query = query.eq('topic', filter.topic);
  }

  // 정렬
  const sortBy = filter?.sortBy || 'created_at';
  const order = filter?.order || 'desc';
  query = query.order(sortBy, { ascending: order === 'asc' });

  const { data, error } = await query;
  
  if (error) {
    console.error('Failed to get rooms:', error);
    throw error;
  }

  // 빈 자리 필터
  if (filter?.hasOpenSpot) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).filter((room: any) => 
      (room.participants?.length || 0) < DEFAULT_DEBATE_SETTINGS.maxParticipants
    );
  }

  return data || [];
}

// ============================================================
// 방 상세 조회
// ============================================================

export async function getRoomById(roomId: string): Promise<DebateRoom | null> {
  const supabase = getSupabase();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: room, error: roomError } = await (supabase as any)
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (roomError || !room) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: participants } = await (supabase as any)
    .from('participants')
    .select('*')
    .eq('room_id', roomId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages } = await (supabase as any)
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  return {
    ...room,
    participants: participants || [],
    messages: messages || [],
  } as DebateRoom;
}

// ============================================================
// 방 생성
// ============================================================

export async function createRoom(request: CreateRoomRequest): Promise<DebateRoom> {
  const supabase = getSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: room, error: roomError } = await (supabase as any)
    .from('rooms')
    .insert({
      topic: request.topic,
      title: request.title,
      description: request.description,
      stance: request.creatorStance === 'pro' ? 'agree' : 'disagree',
      settings: {
        ...DEFAULT_DEBATE_SETTINGS,
        ...(request.settings || {}),
      },
      stage: 'waiting',
      logic_score_pro: INITIAL_SCORE,
      logic_score_con: INITIAL_SCORE,
    })
    .select()
    .single();

  if (roomError || !room) {
    throw roomError || new Error('Failed to create room');
  }

  // 생성자 메시지 추가
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('messages').insert({
    room_id: room.id,
    role: 'moderator',
    content: `🏛️ **토론방 개설**\n\n주제: **${request.topic}**\n\n상대방을 기다리는 중입니다...`,
    message_type: 'text',
  });

  return room as DebateRoom;
}

// ============================================================
// 방 참가
// ============================================================

export async function joinRoom(request: JoinRoomRequest): Promise<{
  room: DebateRoom;
  participant: Participant;
  isNew: boolean;
}> {
  const supabase = getSupabase();

  // safe_join_room RPC 호출 (세션 기반 중복 방지)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase as any).rpc('safe_join_room', {
    p_room_id: request.roomId,
    p_session_id: request.sessionId,
    p_user_name: request.displayName,
    p_preferred_stance: request.preferredStance || 'pro',
  });

  if (error) throw error;

  // 최신 방 정보 조회
  const room = await getRoomById(request.roomId);
  if (!room) throw new Error('Room not found after join');

  // 참가자 정보 조회
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: participant } = await (supabase as any)
    .from('participants')
    .select('*')
    .eq('id', result.participant_id)
    .single();

  return {
    room,
    participant: participant as Participant,
    isNew: result.is_new,
  };
}

// ============================================================
// 방 퇴장
// ============================================================

export async function leaveRoom(
  roomId: string, 
  sessionId: string
): Promise<{ success: boolean; roomDeleted: boolean }> {
  const supabase = getSupabase();

  // safe_leave_room RPC 호출
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase as any).rpc('safe_leave_room', {
    p_room_id: roomId,
    p_session_id: sessionId,
  });

  if (error) {
    console.error('Failed to leave room:', error);
    return { success: false, roomDeleted: false };
  }

  return {
    success: true,
    roomDeleted: result?.room_deleted || false,
  };
}

// ============================================================
// 하트비트 업데이트
// ============================================================

export async function updateHeartbeat(
  roomId: string, 
  sessionId: string
): Promise<boolean> {
  const supabase = getSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('update_participant_heartbeat', {
    p_room_id: roomId,
    p_session_id: sessionId,
  });

  if (error) {
    console.error('Heartbeat update failed:', error);
    return false;
  }

  return data as boolean;
}

// ============================================================
// 점수 업데이트
// ============================================================

export async function updateScores(
  roomId: string,
  proChange: number,
  conChange: number,
  _reason: string
): Promise<DebateRoom | null> {
  const supabase = getSupabase();

  // 현재 점수 조회
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: room } = await (supabase as any)
    .from('rooms')
    .select('logic_score_pro, logic_score_con')
    .eq('id', roomId)
    .single();

  if (!room) return null;

  // 점수 업데이트 (범위 제한)
  const newProScore = Math.max(0, Math.min(100, (room.logic_score_pro || 50) + proChange));
  const newConScore = Math.max(0, Math.min(100, (room.logic_score_con || 50) + conChange));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase as any)
    .from('rooms')
    .update({
      logic_score_pro: newProScore,
      logic_score_con: newConScore,
    })
    .eq('id', roomId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update scores:', error);
    return null;
  }

  return updated as DebateRoom;
}
