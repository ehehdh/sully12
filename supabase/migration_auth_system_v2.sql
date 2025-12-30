-- ============================================
-- 회원가입 시스템 개선 마이그레이션
-- 버전: 2.0
-- 날짜: 2024-12-30
-- ============================================

-- 1. UUID 확장 확인
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. 기존 NOT NULL 제약 조건 수정 (이메일 가입 지원)
-- ============================================
DO $$ 
BEGIN
  -- kakao_id NULL 허용
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'kakao_id' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE users ALTER COLUMN kakao_id DROP NOT NULL;
  END IF;
  
  -- google_id NULL 허용
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'google_id' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;
  END IF;
END $$;

-- ============================================
-- 3. UNIQUE 인덱스 재정의 (NULL 허용하면서 중복 방지)
-- ============================================
DROP INDEX IF EXISTS idx_users_kakao_id;
DROP INDEX IF EXISTS idx_users_google_id;
DROP INDEX IF EXISTS idx_users_email_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kakao_id 
  ON users(kakao_id) WHERE kakao_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id 
  ON users(google_id) WHERE google_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique 
  ON users(email) WHERE email IS NOT NULL;

-- ============================================
-- 4. users 테이블 확장
-- ============================================
-- 인증 관련 컬럼
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'social';

-- 추가 프로필 정보
ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS region VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- 약관 동의 관련
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_under_14_confirmed BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_confirmed_at TIMESTAMP;

-- 활동 추적
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- gender 제약 조건 (이미 있으면 건너뜀)
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
-- 5. 이메일 인증 코드 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,  -- SHA-256 해시
  type VARCHAR(20) DEFAULT 'signup' CHECK (type IN ('signup', 'password_reset', 'email_change')),
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires 
  ON email_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verifications_email_created 
  ON email_verifications(email, created_at);
CREATE INDEX IF NOT EXISTS idx_email_verifications_ip_created 
  ON email_verifications(ip_address, created_at);

-- ============================================
-- 6. 비밀번호 재설정 토큰 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,  -- SHA-256 해시
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_expires 
  ON password_resets(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_resets_user 
  ON password_resets(user_id, created_at);

-- ============================================
-- 7. 약관 버전 관리 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS terms_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('terms', 'privacy', 'marketing')),
  version VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  summary TEXT,  -- 주요 변경 사항 요약
  effective_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(type, version)
);

-- 현재 버전 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_terms_versions_current 
  ON terms_versions(type, is_current) WHERE is_current = true;

-- ============================================
-- 8. 사용자 동의 기록 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS user_agreements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  terms_version_id UUID REFERENCES terms_versions(id),
  agreed_at TIMESTAMP DEFAULT now(),
  ip_address VARCHAR(45),
  
  UNIQUE(user_id, terms_version_id)
);

CREATE INDEX IF NOT EXISTS idx_user_agreements_user 
  ON user_agreements(user_id);

-- ============================================
-- 9. 관리자 활동 로그 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL,
  admin_identifier VARCHAR(255) NOT NULL,  -- 관리자 식별자
  action VARCHAR(50) NOT NULL,  -- 'view_user', 'ban_user', 'unban_user', 'delete_debate', etc.
  target_type VARCHAR(50),  -- 'user', 'debate', 'report', 'room'
  target_id UUID,
  target_snapshot JSONB,  -- 변경 전 상태 스냅샷
  details JSONB,  -- 추가 정보
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created 
  ON admin_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action 
  ON admin_activity_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target 
  ON admin_activity_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin 
  ON admin_activity_logs(admin_id, created_at DESC);

-- ============================================
-- 10. 초기 약관 버전 삽입
-- ============================================
INSERT INTO terms_versions (type, version, title, summary, effective_date, is_current)
VALUES 
  ('terms', '2024.1', '이용약관', '서비스 초기 버전 이용약관', '2024-12-30', true),
  ('privacy', '2024.1', '개인정보처리방침', '개인정보 수집 및 이용에 관한 안내', '2024-12-30', true),
  ('marketing', '2024.1', '마케팅 정보 수신 동의', '이벤트 및 뉴스레터 수신 동의', '2024-12-30', true)
ON CONFLICT (type, version) DO NOTHING;

-- ============================================
-- 11. 만료된 데이터 정리 함수
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_auth_data()
RETURNS void AS $$
BEGIN
  -- 만료된 이메일 인증 코드 삭제 (7일 이상 경과)
  DELETE FROM email_verifications 
  WHERE expires_at < now() - INTERVAL '7 days';
  
  -- 사용된 또는 만료된 비밀번호 재설정 토큰 삭제
  DELETE FROM password_resets 
  WHERE expires_at < now() OR used = true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 12. RLS 정책 설정
-- ============================================

-- email_verifications: 서비스 롤만 접근
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- password_resets: 서비스 롤만 접근
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- terms_versions: 모두 읽기 가능
ALTER TABLE terms_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "약관은 누구나 조회 가능" ON terms_versions
  FOR SELECT USING (true);

-- user_agreements: 본인 것만 조회 가능
ALTER TABLE user_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 동의 기록만 조회" ON user_agreements
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- admin_activity_logs: 서비스 롤만 접근
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 완료 메시지
-- ============================================
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '회원가입 시스템 마이그레이션 완료!';
  RAISE NOTICE '버전: 2.0';
  RAISE NOTICE '========================================';
END $$;
