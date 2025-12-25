# 🚀 배포 가이드

> Politi-Log 배포 방법 및 환경 설정

## 📋 목차

1. [환경 변수](#환경-변수)
2. [Vercel 배포](#vercel-배포)
3. [Supabase 설정](#supabase-설정)
4. [도메인 설정](#도메인-설정)
5. [모니터링](#모니터링)

---

## 환경 변수

### 필수 환경 변수

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI
GROQ_API_KEY=your-groq-api-key
```

### 선택적 환경 변수 (Phase 3+)

```env
# Redis (영속성 레이어)
REDIS_URL=redis://localhost:6379

# 소셜 로그인
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
KAKAO_CLIENT_ID=

# 분석
NEXT_PUBLIC_GA_ID=
```

### 보안 주의사항

⚠️ **절대로 커밋하지 마세요:**
- `.env.local` 파일
- API 키가 포함된 파일
- 시크릿 토큰

---

## Vercel 배포

### 1. 프로젝트 연결

```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 프로젝트 초기화
vercel
```

### 2. 환경 변수 설정

Vercel Dashboard에서:

1. **Settings** → **Environment Variables**
2. 각 환경 변수 추가:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GROQ_API_KEY`

### 3. 빌드 설정

```json
// vercel.json (선택사항)
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

### 4. 배포

```bash
# 프로덕션 배포
vercel --prod

# 또는 GitHub 연동 시 자동 배포
```

---

## Supabase 설정

### 1. 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. **New Project** 클릭
3. 프로젝트 정보 입력

### 2. 데이터베이스 스키마 적용

```bash
# Supabase CLI 사용
supabase db push

# 또는 SQL Editor에서 직접 실행
# supabase_schema.sql 파일 내용 복사/붙여넣기
```

### 3. RLS (Row Level Security) 설정

```sql
-- rooms 테이블 RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rooms"
  ON rooms FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create rooms"
  ON rooms FOR INSERT
  WITH CHECK (true);
```

### 4. Realtime 활성화

1. **Database** → **Replication**
2. 필요한 테이블에 Realtime 활성화:
   - `rooms`
   - `messages`
   - `participants`

---

## 도메인 설정

### Vercel 도메인

1. **Settings** → **Domains**
2. 커스텀 도메인 추가
3. DNS 설정:
   - A Record: `76.76.21.21`
   - CNAME: `cname.vercel-dns.com`

### SSL/HTTPS

Vercel에서 자동으로 Let's Encrypt SSL 인증서 발급

---

## 모니터링

### Vercel Analytics

```typescript
// next.config.mjs
const nextConfig = {
  // Analytics 활성화
  experimental: {
    webVitals: true,
  },
};
```

### 로그 확인

```bash
# Vercel 로그
vercel logs your-deployment-url

# 실시간 로그
vercel logs --follow
```

### 에러 추적

Sentry 또는 다른 에러 추적 서비스 연동 권장

---

## 배포 체크리스트

### 배포 전

- [ ] 환경 변수 모두 설정
- [ ] 빌드 테스트 (`npm run build`)
- [ ] 린트 통과 (`npm run lint`)
- [ ] Supabase 스키마 동기화

### 배포 후

- [ ] 메인 페이지 접속 확인
- [ ] 토론방 생성 테스트
- [ ] AI 분석 기능 테스트
- [ ] 실시간 통신 테스트

---

## 트러블슈팅

### 빌드 실패

```bash
# 로컬에서 빌드 테스트
npm run build

# 캐시 삭제
rm -rf .next node_modules
npm install
npm run build
```

### 환경 변수 문제

- `NEXT_PUBLIC_` 접두사 확인 (클라이언트용)
- Vercel에서 환경 변수 올바르게 설정되었는지 확인

### Supabase 연결 오류

- URL 및 키 값 확인
- RLS 정책 확인
- Realtime 활성화 확인

---

## 롤백

```bash
# 이전 배포로 롤백
vercel rollback [deployment-url]
```

---

문제가 발생하면 이슈를 생성해주세요! 🐛
