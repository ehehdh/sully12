-- ============================================================
-- Politi-Log Supabase Schema
-- 안전한 버전: 중복 실행해도 오류 발생하지 않음
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 테이블 생성
-- ============================================================

-- Rooms table (토론방)
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  topic text NOT NULL,
  title text,
  description text,
  stance text NOT NULL CHECK (stance IN ('agree', 'disagree', 'neutral')),
  stage text NOT NULL DEFAULT 'waiting',
  stage_started_at timestamptz DEFAULT now(),
  current_turn_owner text,
  turn_count integer DEFAULT 0,
  phase_start_time timestamptz DEFAULT now(),
  turn_started_at timestamptz DEFAULT now(),
  logic_score_pro integer DEFAULT 50,
  logic_score_con integer DEFAULT 50,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Participants table (참가자)
CREATE TABLE IF NOT EXISTS public.participants (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  session_id text,
  user_name text NOT NULL,
  stance text NOT NULL CHECK (stance IN ('agree', 'disagree', 'neutral', 'observer')),
  role text DEFAULT 'host' CHECK (role IN ('host', 'opponent', 'observer')),
  is_typing boolean DEFAULT false,
  is_online boolean DEFAULT true,
  logic_score integer DEFAULT 50,
  joined_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  last_heartbeat timestamptz DEFAULT now()
);

-- Messages table (메시지)
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('user', 'opponent', 'moderator', 'system')),
  content text NOT NULL,
  message_type text DEFAULT 'text',
  sender_name text,
  sender_session_id text,
  fallacy_detected text,
  fact_check_status text,
  logic_score_change integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Issues table (토론 주제)
CREATE TABLE IF NOT EXISTS public.issues (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title text NOT NULL,
  description text,
  detailed_description text,
  category text DEFAULT '일반',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- RLS (Row Level Security) 설정
-- ============================================================

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성 (안전한 방식)
DO $$ 
BEGIN
  -- Rooms policies
  DROP POLICY IF EXISTS "Public rooms are viewable by everyone" ON public.rooms;
  DROP POLICY IF EXISTS "Anyone can create a room" ON public.rooms;
  DROP POLICY IF EXISTS "Anyone can update a room" ON public.rooms;
  DROP POLICY IF EXISTS "Anyone can delete a room" ON public.rooms;
  
  -- Participants policies
  DROP POLICY IF EXISTS "Public participants are viewable by everyone" ON public.participants;
  DROP POLICY IF EXISTS "Anyone can join a room" ON public.participants;
  DROP POLICY IF EXISTS "Anyone can update participants" ON public.participants;
  DROP POLICY IF EXISTS "Anyone can delete participants" ON public.participants;
  
  -- Messages policies
  DROP POLICY IF EXISTS "Public messages are viewable by everyone" ON public.messages;
  DROP POLICY IF EXISTS "Anyone can send a message" ON public.messages;
  
  -- Issues policies
  DROP POLICY IF EXISTS "Public issues are viewable by everyone" ON public.issues;
  DROP POLICY IF EXISTS "Anyone can create issues" ON public.issues;
  DROP POLICY IF EXISTS "Anyone can update issues" ON public.issues;
  DROP POLICY IF EXISTS "Anyone can delete issues" ON public.issues;
END $$;

-- Rooms 정책
CREATE POLICY "Public rooms are viewable by everyone" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can create a room" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update a room" ON public.rooms FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete a room" ON public.rooms FOR DELETE USING (true);

-- Participants 정책
CREATE POLICY "Public participants are viewable by everyone" ON public.participants FOR SELECT USING (true);
CREATE POLICY "Anyone can join a room" ON public.participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update participants" ON public.participants FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete participants" ON public.participants FOR DELETE USING (true);

-- Messages 정책
CREATE POLICY "Public messages are viewable by everyone" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Anyone can send a message" ON public.messages FOR INSERT WITH CHECK (true);

-- Issues 정책
CREATE POLICY "Public issues are viewable by everyone" ON public.issues FOR SELECT USING (true);
CREATE POLICY "Anyone can create issues" ON public.issues FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update issues" ON public.issues FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete issues" ON public.issues FOR DELETE USING (true);

-- ============================================================
-- 함수 (RPC)
-- ============================================================

-- 안전한 방 입장 함수
CREATE OR REPLACE FUNCTION public.safe_join_room(
  p_room_id uuid,
  p_session_id text,
  p_user_name text,
  p_preferred_stance text DEFAULT 'agree'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_participant_id uuid;
  v_role text;
  v_is_new boolean := false;
  v_participant_count integer;
  v_room_stage text;
BEGIN
  -- 이미 참가 중인지 확인 (세션 ID 기준)
  SELECT id, role INTO v_participant_id, v_role
  FROM public.participants
  WHERE room_id = p_room_id AND session_id = p_session_id;
  
  IF v_participant_id IS NOT NULL THEN
    -- 이미 참가 중 - heartbeat 업데이트
    UPDATE public.participants 
    SET last_heartbeat = now(), is_online = true, last_seen_at = now()
    WHERE id = v_participant_id;
    
    RETURN jsonb_build_object(
      'participant_id', v_participant_id,
      'role', v_role,
      'is_new', false
    );
  END IF;
  
  -- 현재 참가자 수 확인
  SELECT COUNT(*) INTO v_participant_count
  FROM public.participants
  WHERE room_id = p_room_id AND role IN ('host', 'opponent');
  
  -- 역할 결정
  IF v_participant_count = 0 THEN
    v_role := 'host';
  ELSIF v_participant_count = 1 THEN
    v_role := 'opponent';
  ELSE
    v_role := 'observer';
  END IF;
  
  -- 새 참가자 추가
  INSERT INTO public.participants (room_id, session_id, user_name, stance, role)
  VALUES (p_room_id, p_session_id, p_user_name, p_preferred_stance, v_role)
  RETURNING id INTO v_participant_id;
  
  v_is_new := true;
  
  -- 2명이 되면 토론 자동 시작
  IF v_role = 'opponent' THEN
    SELECT stage INTO v_room_stage FROM public.rooms WHERE id = p_room_id;
    
    IF v_room_stage = 'waiting' THEN
      UPDATE public.rooms 
      SET stage = 'opening_pro',
          stage_started_at = now(),
          current_turn_owner = 'host',
          phase_start_time = now(),
          turn_started_at = now()
      WHERE id = p_room_id;
      
      -- 토론 시작 메시지
      INSERT INTO public.messages (room_id, role, content, message_type)
      VALUES (p_room_id, 'moderator', '🎯 토론이 시작되었습니다! 찬성 측(Host)의 입론부터 시작합니다.', 'stage-change');
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'participant_id', v_participant_id,
    'role', v_role,
    'is_new', v_is_new
  );
END;
$$;

-- 안전한 퇴장 함수
CREATE OR REPLACE FUNCTION public.safe_leave_room(
  p_room_id uuid,
  p_session_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_participant_id uuid;
  v_remaining integer;
  v_room_deleted boolean := false;
BEGIN
  -- 참가자 삭제
  DELETE FROM public.participants
  WHERE room_id = p_room_id AND session_id = p_session_id
  RETURNING id INTO v_participant_id;
  
  -- 남은 참가자 수 확인
  SELECT COUNT(*) INTO v_remaining
  FROM public.participants
  WHERE room_id = p_room_id;
  
  -- 아무도 없으면 방 삭제
  IF v_remaining = 0 THEN
    DELETE FROM public.rooms WHERE id = p_room_id;
    v_room_deleted := true;
  END IF;
  
  RETURN jsonb_build_object(
    'success', v_participant_id IS NOT NULL,
    'room_deleted', v_room_deleted,
    'remaining', v_remaining
  );
END;
$$;

-- Heartbeat 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_participant_heartbeat(
  p_room_id uuid,
  p_session_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.participants
  SET last_heartbeat = now(), is_online = true, last_seen_at = now()
  WHERE room_id = p_room_id AND session_id = p_session_id;
  
  RETURN FOUND;
END;
$$;

-- ============================================================
-- 인덱스 (성능 최적화)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_participants_room_id ON public.participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_session_id ON public.participants(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_rooms_stage ON public.rooms(stage);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON public.rooms(created_at);
