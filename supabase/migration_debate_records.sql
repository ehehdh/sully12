-- ============================================================
-- 토론 기록 및 전적 시스템 마이그레이션
-- 실행: Supabase SQL Editor에서 실행
-- ============================================================

-- 1. 토론 기록 테이블 (완료된 토론 아카이브)
CREATE TABLE IF NOT EXISTS public.debate_records (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  
  -- 원본 방 ID (참조용)
  original_room_id uuid,
  
  -- 토론 기본 정보
  topic_id uuid REFERENCES public.issues(id) ON DELETE SET NULL,
  topic_title text NOT NULL,
  title text,
  
  -- 찬성측 참가자
  pro_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  pro_user_name text NOT NULL,
  pro_session_id text,
  
  -- 반대측 참가자
  con_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  con_user_name text NOT NULL,
  con_session_id text,
  
  -- 결과
  winner text CHECK (winner IN ('pro', 'con', 'draw', 'cancelled')),
  final_score_pro integer NOT NULL DEFAULT 50,
  final_score_con integer NOT NULL DEFAULT 50,
  verdict_summary text,
  verdict_details jsonb DEFAULT '{}',
  
  -- 통계
  total_messages integer DEFAULT 0,
  duration_seconds integer DEFAULT 0,
  total_stages_completed integer DEFAULT 0,
  
  -- 타임스탬프
  started_at timestamptz NOT NULL,
  ended_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 2. 토론 메시지 아카이브 테이블
CREATE TABLE IF NOT EXISTS public.debate_messages_archive (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  debate_record_id uuid REFERENCES public.debate_records(id) ON DELETE CASCADE,
  
  -- 메시지 정보
  role text NOT NULL CHECK (role IN ('user', 'opponent', 'moderator', 'system')),
  content text NOT NULL,
  sender_name text,
  sender_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sender_session_id text,
  
  -- 메타데이터
  message_type text DEFAULT 'text',
  stage text,
  logic_score_change integer DEFAULT 0,
  fallacy_detected text,
  fact_check_status text,
  
  -- 타임스탬프
  original_created_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. 사용자 통계 테이블
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  
  -- 기본 전적
  total_debates integer DEFAULT 0,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  draws integer DEFAULT 0,
  
  -- 승률 (자동 계산)
  win_rate decimal(5,2) DEFAULT 0,
  
  -- 포지션별 통계
  pro_debates integer DEFAULT 0,
  pro_wins integer DEFAULT 0,
  con_debates integer DEFAULT 0,
  con_wins integer DEFAULT 0,
  
  -- 점수 통계
  avg_score decimal(5,2) DEFAULT 50,
  highest_score integer DEFAULT 50,
  lowest_score integer DEFAULT 50,
  total_score_sum integer DEFAULT 0,
  
  -- 연속 기록
  current_streak integer DEFAULT 0,  -- 양수: 연승, 음수: 연패
  best_win_streak integer DEFAULT 0,
  
  -- 기타
  last_debate_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- RLS 정책
-- ============================================================

ALTER TABLE public.debate_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_messages_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- debate_records 정책
DROP POLICY IF EXISTS "Anyone can view debate records" ON public.debate_records;
DROP POLICY IF EXISTS "Service role can manage debate records" ON public.debate_records;

CREATE POLICY "Anyone can view debate records" ON public.debate_records
  FOR SELECT USING (true);
CREATE POLICY "Service role can manage debate records" ON public.debate_records
  FOR ALL USING (true);

-- debate_messages_archive 정책
DROP POLICY IF EXISTS "Anyone can view archived messages" ON public.debate_messages_archive;
DROP POLICY IF EXISTS "Service role can manage archived messages" ON public.debate_messages_archive;

CREATE POLICY "Anyone can view archived messages" ON public.debate_messages_archive
  FOR SELECT USING (true);
CREATE POLICY "Service role can manage archived messages" ON public.debate_messages_archive
  FOR ALL USING (true);

-- user_stats 정책
DROP POLICY IF EXISTS "Anyone can view user stats" ON public.user_stats;
DROP POLICY IF EXISTS "Service role can manage user stats" ON public.user_stats;

CREATE POLICY "Anyone can view user stats" ON public.user_stats
  FOR SELECT USING (true);
CREATE POLICY "Service role can manage user stats" ON public.user_stats
  FOR ALL USING (true);

-- ============================================================
-- 인덱스
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_debate_records_topic_id ON public.debate_records(topic_id);
CREATE INDEX IF NOT EXISTS idx_debate_records_pro_user_id ON public.debate_records(pro_user_id);
CREATE INDEX IF NOT EXISTS idx_debate_records_con_user_id ON public.debate_records(con_user_id);
CREATE INDEX IF NOT EXISTS idx_debate_records_ended_at ON public.debate_records(ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_debate_records_winner ON public.debate_records(winner);

CREATE INDEX IF NOT EXISTS idx_debate_messages_archive_record_id ON public.debate_messages_archive(debate_record_id);
CREATE INDEX IF NOT EXISTS idx_debate_messages_archive_created_at ON public.debate_messages_archive(original_created_at);

-- ============================================================
-- 함수: 사용자 통계 업데이트
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_user_stats(
  p_user_id uuid,
  p_is_win boolean,
  p_is_draw boolean,
  p_is_pro boolean,
  p_final_score integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak integer;
BEGIN
  -- 기존 통계가 없으면 생성
  INSERT INTO public.user_stats (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- 현재 연승/연패 기록 가져오기
  SELECT current_streak INTO v_current_streak
  FROM public.user_stats WHERE user_id = p_user_id;
  
  -- 연속 기록 계산
  IF p_is_draw THEN
    v_current_streak := 0;
  ELSIF p_is_win THEN
    IF v_current_streak >= 0 THEN
      v_current_streak := v_current_streak + 1;
    ELSE
      v_current_streak := 1;
    END IF;
  ELSE
    IF v_current_streak <= 0 THEN
      v_current_streak := v_current_streak - 1;
    ELSE
      v_current_streak := -1;
    END IF;
  END IF;
  
  -- 통계 업데이트
  UPDATE public.user_stats
  SET
    total_debates = total_debates + 1,
    wins = wins + CASE WHEN p_is_win AND NOT p_is_draw THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN NOT p_is_win AND NOT p_is_draw THEN 1 ELSE 0 END,
    draws = draws + CASE WHEN p_is_draw THEN 1 ELSE 0 END,
    win_rate = CASE 
      WHEN (total_debates + 1 - draws - CASE WHEN p_is_draw THEN 1 ELSE 0 END) > 0 
      THEN ((wins + CASE WHEN p_is_win AND NOT p_is_draw THEN 1 ELSE 0 END)::decimal / 
            (total_debates + 1 - draws - CASE WHEN p_is_draw THEN 1 ELSE 0 END)::decimal) * 100
      ELSE 0 
    END,
    pro_debates = pro_debates + CASE WHEN p_is_pro THEN 1 ELSE 0 END,
    pro_wins = pro_wins + CASE WHEN p_is_pro AND p_is_win AND NOT p_is_draw THEN 1 ELSE 0 END,
    con_debates = con_debates + CASE WHEN NOT p_is_pro THEN 1 ELSE 0 END,
    con_wins = con_wins + CASE WHEN NOT p_is_pro AND p_is_win AND NOT p_is_draw THEN 1 ELSE 0 END,
    total_score_sum = total_score_sum + p_final_score,
    avg_score = (total_score_sum + p_final_score)::decimal / (total_debates + 1)::decimal,
    highest_score = GREATEST(highest_score, p_final_score),
    lowest_score = LEAST(lowest_score, p_final_score),
    current_streak = v_current_streak,
    best_win_streak = GREATEST(best_win_streak, CASE WHEN v_current_streak > 0 THEN v_current_streak ELSE 0 END),
    last_debate_at = now(),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- ============================================================
-- 함수: 토론 아카이브
-- ============================================================

CREATE OR REPLACE FUNCTION public.archive_debate(p_room_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room record;
  v_record_id uuid;
  v_pro_participant record;
  v_con_participant record;
  v_winner text;
  v_message_count integer;
  v_duration integer;
BEGIN
  -- 방 정보 가져오기
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  
  IF v_room IS NULL THEN
    RAISE EXCEPTION 'Room not found: %', p_room_id;
  END IF;
  
  -- 참가자 정보 가져오기
  SELECT * INTO v_pro_participant 
  FROM public.participants 
  WHERE room_id = p_room_id AND role = 'host' 
  LIMIT 1;
  
  SELECT * INTO v_con_participant 
  FROM public.participants 
  WHERE room_id = p_room_id AND role = 'opponent' 
  LIMIT 1;
  
  -- 우승자 결정
  IF v_room.logic_score_pro > v_room.logic_score_con THEN
    v_winner := 'pro';
  ELSIF v_room.logic_score_con > v_room.logic_score_pro THEN
    v_winner := 'con';
  ELSE
    v_winner := 'draw';
  END IF;
  
  -- 메시지 수 계산
  SELECT COUNT(*) INTO v_message_count FROM public.messages WHERE room_id = p_room_id;
  
  -- 토론 시간 계산 (초)
  v_duration := EXTRACT(EPOCH FROM (now() - v_room.created_at))::integer;
  
  -- 토론 기록 생성
  INSERT INTO public.debate_records (
    original_room_id,
    topic_id,
    topic_title,
    title,
    pro_user_id,
    pro_user_name,
    pro_session_id,
    con_user_id,
    con_user_name,
    con_session_id,
    winner,
    final_score_pro,
    final_score_con,
    total_messages,
    duration_seconds,
    started_at,
    ended_at
  ) VALUES (
    p_room_id,
    v_room.topic::uuid,
    COALESCE(v_room.title, v_room.topic),
    v_room.title,
    v_pro_participant.user_id,
    COALESCE(v_pro_participant.user_name, '익명'),
    v_pro_participant.session_id,
    v_con_participant.user_id,
    COALESCE(v_con_participant.user_name, '익명'),
    v_con_participant.session_id,
    v_winner,
    v_room.logic_score_pro,
    v_room.logic_score_con,
    v_message_count,
    v_duration,
    v_room.created_at,
    now()
  )
  RETURNING id INTO v_record_id;
  
  -- 메시지 아카이브
  INSERT INTO public.debate_messages_archive (
    debate_record_id,
    role,
    content,
    sender_name,
    sender_session_id,
    message_type,
    logic_score_change,
    fallacy_detected,
    fact_check_status,
    original_created_at
  )
  SELECT 
    v_record_id,
    role,
    content,
    sender_name,
    sender_session_id,
    message_type,
    logic_score_change,
    fallacy_detected,
    fact_check_status,
    created_at
  FROM public.messages
  WHERE room_id = p_room_id
  ORDER BY created_at ASC;
  
  -- 사용자 통계 업데이트 (찬성측)
  IF v_pro_participant.user_id IS NOT NULL THEN
    PERFORM public.update_user_stats(
      v_pro_participant.user_id,
      v_winner = 'pro',
      v_winner = 'draw',
      true,
      v_room.logic_score_pro
    );
  END IF;
  
  -- 사용자 통계 업데이트 (반대측)
  IF v_con_participant.user_id IS NOT NULL THEN
    PERFORM public.update_user_stats(
      v_con_participant.user_id,
      v_winner = 'con',
      v_winner = 'draw',
      false,
      v_room.logic_score_con
    );
  END IF;
  
  RETURN v_record_id;
END;
$$;
