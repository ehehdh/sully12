-- ============================================================
-- 구글 로그인 + 온보딩 시스템 추가
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. users 테이블에 google_id 컬럼 추가
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

-- 2. 온보딩 완료 여부 컬럼 추가
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_onboarding_complete BOOLEAN DEFAULT FALSE;

-- 3. 기존 사용자들은 온보딩 완료 상태로 설정
UPDATE public.users 
SET is_onboarding_complete = TRUE 
WHERE is_onboarding_complete IS NULL OR is_onboarding_complete = FALSE;

-- 4. 이메일 인덱스 추가 (중복 체크 성능 향상)
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 5. google_id 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id);

-- 확인 쿼리
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;
