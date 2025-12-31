-- ============================================
-- 회원 시스템 긴급 수정 마이그레이션
-- 날짜: 2024-12-31
-- 목적: 회원탈퇴 500 에러 및 관리자 사용자 조회 오류 해결
-- ============================================

-- 1. kakao_id NOT NULL 제약조건 제거 (탈퇴 시 null로 변경 허용)
DO $$ 
BEGIN
  -- 기존 UNIQUE 제약조건 제거 (있다면)
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_kakao_id_key;
  
  -- NOT NULL 제거를 위해 먼저 기본값 확인
  -- kakao_id가 NOT NULL이면 NULL 허용으로 변경
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'kakao_id' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.users ALTER COLUMN kakao_id DROP NOT NULL;
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'kakao_id 제약조건 변경 중 오류 발생 (무시): %', SQLERRM;
END $$;

-- 2. deleted_at 컬럼 추가 (없는 경우)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 3. google_id 컬럼 추가 (없는 경우)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_id TEXT;

-- 4. 제재 관련 컬럼 추가
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_reason TEXT DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0;

-- 5. 추가 프로필 컬럼
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS region VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio TEXT;

-- 6. 활동 기록 컬럼
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- 7. 약관 동의 컬럼
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS agreed_terms BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS agreed_privacy BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS agreed_marketing BOOLEAN DEFAULT false;

-- 8. 인덱스 생성 (없는 경우)
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON public.users(is_banned) WHERE is_banned = true;
CREATE INDEX IF NOT EXISTS idx_users_is_suspended ON public.users(is_suspended) WHERE is_suspended = true;

-- 9. google_id 부분 유니크 인덱스 (NULL이 아닌 경우에만)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_google_id_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_users_google_id_unique ON public.users(google_id) WHERE google_id IS NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'google_id 인덱스 생성 중 오류 (무시): %', SQLERRM;
END $$;

-- 10. kakao_id 부분 유니크 인덱스 재생성
DO $$
BEGIN
  DROP INDEX IF EXISTS idx_users_kakao_id_unique;
  CREATE UNIQUE INDEX idx_users_kakao_id_unique ON public.users(kakao_id) WHERE kakao_id IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'kakao_id 인덱스 재생성 중 오류 (무시): %', SQLERRM;
END $$;

-- 11. 관리자 활동 로그 테이블 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL,
  admin_identifier VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  target_snapshot JSONB,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON public.admin_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON public.admin_activity_logs(action);

-- 12. 사용자 통계 테이블 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  
  total_debates INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  
  pro_debates INTEGER NOT NULL DEFAULT 0,
  pro_wins INTEGER NOT NULL DEFAULT 0,
  con_debates INTEGER NOT NULL DEFAULT 0,
  con_wins INTEGER NOT NULL DEFAULT 0,
  
  avg_score NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  highest_score INTEGER NOT NULL DEFAULT 0,
  
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_win_streak INTEGER NOT NULL DEFAULT 0,
  
  last_debate_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. RLS 정책 업데이트
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Service role can manage admin logs" ON public.admin_activity_logs;
  CREATE POLICY "Service role can manage admin logs" ON public.admin_activity_logs FOR ALL USING (true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'admin_activity_logs 정책 생성 중 오류 (무시): %', SQLERRM;
END $$;

-- ============================================
-- 마이그레이션 완료
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 회원 시스템 마이그레이션이 완료되었습니다.';
  RAISE NOTICE '적용된 변경사항:';
  RAISE NOTICE '  - kakao_id NOT NULL 제약조건 제거';
  RAISE NOTICE '  - deleted_at 컬럼 추가';
  RAISE NOTICE '  - 제재 관련 컬럼 추가 (is_banned, is_suspended 등)';
  RAISE NOTICE '  - 프로필 관련 컬럼 추가 (gender, birth_date 등)';
  RAISE NOTICE '  - 관리자 활동 로그 테이블 생성';
  RAISE NOTICE '  - 사용자 통계 테이블 생성';
END $$;
