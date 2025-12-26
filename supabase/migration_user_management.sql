-- ============================================================
-- 사용자 관리 및 신고 시스템 마이그레이션
-- 실행: Supabase SQL Editor에서 실행
-- ============================================================

-- 1. users 테이블 확장 (제재 관련 컬럼 추가)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ban_until timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ban_reason text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS warning_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS suspended_until timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS suspended_reason text DEFAULT NULL;

-- 2. 신고 테이블
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  
  -- 신고자/피신고자
  reporter_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reporter_name text NOT NULL,
  reported_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reported_user_name text NOT NULL,
  
  -- 신고 내용
  reason text NOT NULL CHECK (reason IN (
    'offensive_language',     -- 욕설/비하
    'spam',                   -- 스팸/도배
    'harassment',             -- 괴롭힘
    'inappropriate_content',  -- 부적절한 내용
    'cheating',               -- 부정행위
    'other'                   -- 기타
  )),
  reason_detail text,
  
  -- 관련 토론/메시지
  debate_record_id uuid REFERENCES public.debate_records(id) ON DELETE SET NULL,
  room_id uuid,
  message_content text,
  
  -- 처리 상태
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  admin_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  admin_note text,
  action_taken text CHECK (action_taken IN ('none', 'warning', 'suspend_1d', 'suspend_7d', 'suspend_30d', 'ban')),
  
  -- 타임스탬프
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  resolved_at timestamptz
);

-- 3. 제재 이력 테이블
CREATE TABLE IF NOT EXISTS public.user_sanctions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- 제재 유형
  sanction_type text NOT NULL CHECK (sanction_type IN ('warning', 'suspend', 'ban', 'unban')),
  duration_days integer DEFAULT NULL,  -- 정지 기간 (일)
  reason text,
  
  -- 관련 신고
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  
  -- 타임스탬프
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT NULL
);

-- ============================================================
-- RLS 정책
-- ============================================================

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sanctions ENABLE ROW LEVEL SECURITY;

-- reports 정책
DROP POLICY IF EXISTS "Service role can manage reports" ON public.reports;
DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;

CREATE POLICY "Service role can manage reports" ON public.reports
  FOR ALL USING (true);
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT USING (true);

-- user_sanctions 정책
DROP POLICY IF EXISTS "Service role can manage sanctions" ON public.user_sanctions;
DROP POLICY IF EXISTS "Anyone can view sanctions" ON public.user_sanctions;

CREATE POLICY "Service role can manage sanctions" ON public.user_sanctions
  FOR ALL USING (true);
CREATE POLICY "Anyone can view sanctions" ON public.user_sanctions
  FOR SELECT USING (true);

-- ============================================================
-- 인덱스
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_sanctions_user ON public.user_sanctions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sanctions_type ON public.user_sanctions(sanction_type);

-- ============================================================
-- 함수: 사용자 제재 적용
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_sanction(
  p_user_id uuid,
  p_admin_id uuid,
  p_sanction_type text,
  p_duration_days integer DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_report_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sanction_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- 만료 시간 계산
  IF p_duration_days IS NOT NULL AND p_duration_days > 0 THEN
    v_expires_at := now() + (p_duration_days || ' days')::interval;
  END IF;
  
  -- 제재 기록 생성
  INSERT INTO public.user_sanctions (
    user_id, admin_id, sanction_type, duration_days, reason, report_id, expires_at
  ) VALUES (
    p_user_id, p_admin_id, p_sanction_type, p_duration_days, p_reason, p_report_id, v_expires_at
  )
  RETURNING id INTO v_sanction_id;
  
  -- 사용자 테이블 업데이트
  IF p_sanction_type = 'warning' THEN
    UPDATE public.users
    SET warning_count = warning_count + 1
    WHERE id = p_user_id;
    
  ELSIF p_sanction_type = 'suspend' THEN
    UPDATE public.users
    SET 
      is_suspended = true,
      suspended_until = v_expires_at,
      suspended_reason = p_reason
    WHERE id = p_user_id;
    
  ELSIF p_sanction_type = 'ban' THEN
    UPDATE public.users
    SET 
      is_banned = true,
      ban_until = NULL,  -- 영구
      ban_reason = p_reason
    WHERE id = p_user_id;
    
  ELSIF p_sanction_type = 'unban' THEN
    UPDATE public.users
    SET 
      is_banned = false,
      ban_until = NULL,
      ban_reason = NULL,
      is_suspended = false,
      suspended_until = NULL,
      suspended_reason = NULL
    WHERE id = p_user_id;
  END IF;
  
  RETURN v_sanction_id;
END;
$$;

-- ============================================================
-- 함수: 만료된 제재 자동 해제 (선택적, cron job으로 실행)
-- ============================================================

CREATE OR REPLACE FUNCTION public.clear_expired_sanctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 정지 만료 해제
  UPDATE public.users
  SET 
    is_suspended = false,
    suspended_until = NULL,
    suspended_reason = NULL
  WHERE is_suspended = true 
    AND suspended_until IS NOT NULL 
    AND suspended_until < now();
END;
$$;
