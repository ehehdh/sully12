-- ============================================================
-- 턴제 토론 시스템 개편 마이그레이션
-- rooms 테이블에 턴 관리 컬럼 추가
-- ============================================================

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS current_turn_owner TEXT, -- 'host' | 'opponent'
ADD COLUMN IF NOT EXISTS turn_count INT DEFAULT 0, -- 교차 조사 턴 카운트
ADD COLUMN IF NOT EXISTS phase_start_time TIMESTAMP WITH TIME ZONE; -- 턴 시작 시간

-- 기존 current_speaker는 유지 (호환성) 또는 current_turn_owner와 동기화
