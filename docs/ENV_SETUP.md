# 🔧 환경 변수 설정 가이드

## 필수 환경 변수

보안 수정 후 다음 환경 변수를 `.env.local` 파일에 추가해야 합니다:

### 🔐 세션 보안 (새로 추가됨 - 필수!)

```bash
# JWT 세션 서명에 사용되는 비밀 키
# 최소 32자 이상의 랜덤 문자열을 사용하세요
SESSION_SECRET=DQ/OxhJ8vqPFdLm8dRLH3d+ulhIiIO7Pj6sFZk6X7nk=
```

**생성 방법:**

```bash
# macOS/Linux
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 기존 환경 변수

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 관리자
ADMIN_PASSWORD=your-admin-password

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Kakao OAuth
KAKAO_REST_API_KEY=your-kakao-rest-api-key
KAKAO_CLIENT_SECRET=your-kakao-client-secret
KAKAO_REDIRECT_URI=http://localhost:3000/api/auth/kakao/callback

# AI 서비스
GROQ_API_KEY=your-groq-api-key

# 앱 설정
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## ⚠️ 주의사항

1. **SESSION_SECRET 미설정 시**: 개발 환경에서는 폴백 값이 사용되지만, **프로덕션에서는 반드시 설정**해야 합니다.

2. **Vercel 배포 시**: Vercel 대시보드에서 환경 변수를 설정하세요:
   - Project Settings → Environment Variables
   - `SESSION_SECRET` 추가

3. **보안 권장사항**:
   - 환경 변수 값은 절대 커밋하지 마세요
   - 프로덕션과 개발 환경에서 다른 값을 사용하세요
   - 주기적으로 비밀 키를 교체하세요

## 데이터베이스 마이그레이션

토론 기록 공개/비공개 기능을 사용하려면 다음 SQL을 실행하세요:

```sql
-- 토론 기록 공개 여부 컬럼 추가
ALTER TABLE debate_records ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
```
