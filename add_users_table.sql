-- ============================================================
-- Users 테이블 추가 (카카오 로그인용)
-- ============================================================

-- Users table (사용자)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  kakao_id text UNIQUE NOT NULL,
  email text,
  nickname text NOT NULL,
  profile_image text,
  role text DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  created_at timestamptz DEFAULT now(),
  last_login_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 정책 생성
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Service role can manage users" ON public.users;

CREATE POLICY "Users can view all users" ON public.users 
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage users" ON public.users 
  FOR ALL USING (true);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON public.users(kakao_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- participants 테이블에 user_id 컬럼 추가 (선택적)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'participants' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.participants 
    ADD COLUMN user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_participants_user_id ON public.participants(user_id);
  END IF;
END $$;
