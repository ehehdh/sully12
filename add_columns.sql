-- rooms 테이블에 발언권 관련 컬럼 추가
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS current_speaker text;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS turn_started_at timestamptz;
