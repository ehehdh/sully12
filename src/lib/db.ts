import { getSupabase } from './supabase';
import { DebateSettings, DebateStage, Room, Participant, Message } from './database.types';
import { DEBATE_STAGES } from './debateStages';

export async function createRoomDB(
  topic: string,
  stance: "agree" | "disagree" | "neutral",
  creatorName: string,
  title?: string,
  description?: string,
  settings?: DebateSettings
) {
  const supabase = getSupabase();
  
  // 방 생성 (참가자는 joinRoomDB에서 추가됨)
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .insert({
      topic,
      stance,
      title,
      description,
      settings,
      stage: 'waiting'
    } as any)
    .select()
    .single();

  if (roomError || !room) throw roomError || new Error('Failed to create room');

  const newRoom = room as Room;

  // 시스템 메시지 추가 (개설 알림)
  await supabase.from('messages').insert({
    room_id: newRoom.id,
    role: 'moderator',
    content: `🏛️ **토론방 개설**\n\n주제: **${topic}**\n\n상대방을 기다리는 중입니다...`,
    message_type: 'text'
  } as any);

  return newRoom;
}

export async function getRoomsDB(topic?: string) {
  const supabase = getSupabase();
  // participants 정보를 함께 가져와서 클라이언트에서 카운트할 수 있게 함
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('rooms')
    .select('*, participants(id, user_name, stance)');
  
  if (topic) {
    query = query.eq('topic', topic);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

type RoomDetails = Room & {
  participants: Participant[];
  messages: Message[];
};

export async function getRoomDetailsDB(roomId: string): Promise<RoomDetails | null> {
  const supabase = getSupabase();
  
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();
    
  if (roomError || !room) return null;

  const { data: participants } = await supabase
    .from('participants')
    .select('*')
    .eq('room_id', roomId);

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  const roomData = room as Room;

  return {
    ...roomData,
    participants: participants || [],
    messages: messages || []
  } as RoomDetails;
}

// 세션 기반 안전한 방 입장
export async function joinRoomDB(
  roomId: string, 
  sessionId: string,
  userName: string, 
  stance?: string
) {
  const supabase = getSupabase();
  
  // RPC 호출 (세션 기반 중복 방지 + 역할 자동 배정 + 토론 자동 시작)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase as any)
    .rpc('safe_join_room', {
      p_room_id: roomId,
      p_session_id: sessionId,
      p_user_name: userName,
      p_preferred_stance: stance || 'agree'
    });

  if (error) throw error;
  
  // 최신 방 정보 조회
  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();
    
  // 참가자 정보 조회
  const { data: participant } = await supabase
    .from('participants')
    .select('*')
    .eq('id', result.participant_id)
    .single();

  return { 
    room: room as unknown as Room, 
    participant: participant as unknown as Participant,
    role: result.role,
    isNew: result.is_new
  };
}

// Heartbeat 업데이트 (5초마다 호출)
export async function updateHeartbeatDB(roomId: string, sessionId: string) {
  const supabase = getSupabase();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .rpc('update_participant_heartbeat', {
      p_room_id: roomId,
      p_session_id: sessionId
    });
    
  if (error) {
    console.error('Heartbeat update failed:', error);
    return false;
  }
  
  return data as boolean;
}

// 세션 기반 안전한 퇴장
export async function leaveRoomDB(roomId: string, sessionId: string) {
  const supabase = getSupabase();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase as any)
    .rpc('safe_leave_room', {
      p_room_id: roomId,
      p_session_id: sessionId
    });
    
  if (error) throw error;
  
  return result;
}

export async function updateRoomStageDB(roomId: string, newStage: DebateStage, messageContent: string) {
  const supabase = getSupabase();
  
  // 1. 단계별 초기 턴 오너 설정
  // 1. 단계별 초기 턴 오너 설정 (config에서 가져옴)
  const config = DEBATE_STAGES[newStage];
  const initialTurnOwner = config ? config.turnOwner : null;
  
  const now = new Date().toISOString();

  // 1. 방 단계 업데이트
  const { data: room, error: roomError } = await (supabase
    .from('rooms') as any)
    .update({
      stage: newStage,
      stage_started_at: now,
      current_turn_owner: initialTurnOwner,
      turn_count: 0,
      phase_start_time: now,
      turn_started_at: now
    })
    .eq('id', roomId)
    .select()
    .single();

  if (roomError || !room) throw roomError || new Error('Failed to update room');
  const updatedRoom = room as Room;

  // 2. 메시지 추가
  const { data: message, error: messageError } = await supabase
    .from('messages')
    .insert({
      room_id: roomId,
      role: 'moderator',
      content: messageContent,
      message_type: 'stage-change'
    } as any)
    .select()
    .single();

  if (messageError) throw messageError;
  const newMessage = message as Message;

  return { room: updatedRoom, message: newMessage };
}
