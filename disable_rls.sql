-- RLS(Row Level Security) 비활성화 스크립트
-- 권한 문제 해결을 위해 모든 테이블의 RLS를 끕니다.

ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
