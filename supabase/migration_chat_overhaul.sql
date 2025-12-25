-- ============================================================
-- 채팅 시스템 개편 마이그레이션
-- messages 테이블에 sender_session_id 추가
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1. messages 테이블에 sender_session_id 컬럼 추가
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS sender_session_id UUID;

-- 2. 인덱스 추가 (빠른 조회)
CREATE INDEX IF NOT EXISTS idx_messages_sender_session 
ON messages(sender_session_id);

-- 3. 완료 메시지
SELECT 'Migration complete! sender_session_id column added to messages table.' as status;
