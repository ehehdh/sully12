-- ============================================
-- 회원 시스템 개선 마이그레이션 (소셜 로그인 전용)
-- 버전: 2.1 (이메일 인증 제거, 회원탈퇴 추가)
-- 날짜: 2024-12-31
-- ============================================

-- 1. UUID 확장 확인
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. users 테이블 확장
-- ============================================
DO $$ 
BEGIN
  -- kakao_id, google_id 인덱스 최적화 (NULL 허용 UNIQUE)
  -- 기존 인덱스 제거 시도 (오류 방지)
  BEGIN
    DROP INDEX IF EXISTS idx_users_kakao_id;
    DROP INDEX IF EXISTS idx_users_google_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 부분 인덱스 생성 (Social ID 중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kakao_id 
  ON users(kakao_id) WHERE kakao_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id 
  ON users(google_id) WHERE google_id IS NOT NULL;

-- 사용자 정보 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS region VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- 약관 동의 및 상태 관리
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_under_14_confirmed BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agreed_marketing BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- 회원 탈퇴 관리 (Soft Delete)
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- 성별 제약 조건
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'chk_users_gender'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_gender 
      CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'private'));
  END IF;
END $$;

-- ============================================
-- 3. 약관 버전 관리 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS terms_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('terms', 'privacy', 'marketing')),
  version VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  effective_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(type, version)
);

-- 현재 버전 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_terms_versions_current 
  ON terms_versions(type, is_current) WHERE is_current = true;

-- ============================================
-- 4. 사용자 동의 기록 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS user_agreements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  terms_version_id UUID REFERENCES terms_versions(id),
  agreed_at TIMESTAMP DEFAULT now(),
  ip_address VARCHAR(45),
  
  UNIQUE(user_id, terms_version_id)
);

-- ============================================
-- 5. 관리자 활동 로그 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL,
  admin_identifier VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL, 
  target_type VARCHAR(50),
  target_id UUID,
  target_snapshot JSONB,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created 
  ON admin_activity_logs(created_at DESC);

-- ============================================
-- 6. 초기 약관 버전 삽입
-- ============================================
INSERT INTO terms_versions (type, version, title, effective_date, is_current)
VALUES 
  ('terms', '2025.1', '이용약관', '2025-01-01', true),
  ('privacy', '2025.1', '개인정보처리방침', '2025-01-01', true),
  ('marketing', '2025.1', '마케팅 정보 수신 동의', '2025-01-01', true)
ON CONFLICT (type, version) DO NOTHING;

-- ============================================
-- 7. RLS 정책 설정
-- ============================================

-- terms_versions: 모두 읽기 가능 (public)
ALTER TABLE terms_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access to terms" ON terms_versions
  FOR SELECT USING (true);

-- user_agreements: 본인 것만 조회, 생성 (authenticated)
ALTER TABLE user_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own agreements" ON user_agreements
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own agreements" ON user_agreements
  FOR SELECT USING (auth.uid() = user_id);

-- admin_activity_logs: 서비스 롤만 접근 (public access false)
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;
