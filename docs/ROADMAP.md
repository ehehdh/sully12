# 🗺️ Politi-Log 개발 로드맵

> 최종 업데이트: 2024-12-30  
> 버전: 3.0

---

## 📊 프로젝트 현황

### ✅ 완료된 기능

#### 핵심 기능
- [x] 실시간 1:1 토론 시스템
- [x] AI 심판 (Groq API 기반)
- [x] 매칭 시스템 (이슈/랜덤)
- [x] 토론 기록 저장 및 조회
- [x] 논리 점수 시스템

#### 인증 시스템
- [x] 카카오 소셜 로그인
- [x] 구글 소셜 로그인
- [x] JWT 기반 서명된 세션 (보안 강화)
- [x] OAuth state/PKCE 적용

#### 관리 기능
- [x] 관리자 대시보드 기본 구조
- [x] 사용자 신고 시스템
- [x] 기본 제재 기능

---

## 🚀 진행 중인 기능

### Phase: 회원가입 시스템 개선 (v2.0)

**목표:** 이메일 회원가입, 약관 동의, 프로필 수집, 관리자 기능 강화

#### 진행 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| DB 스키마 확장 | ✅ 완료 | `migration_auth_system_v2.sql` |
| 암호화 유틸리티 | ✅ 완료 | `src/lib/crypto.ts` |
| 이메일 발송 모듈 | ✅ 완료 | `src/lib/email.ts` (Resend) |
| 인증 코드 API | ✅ 완료 | `send-code`, `verify-code` |
| 이메일 회원가입 API | ✅ 완료 | `register`, `login` |
| 비밀번호 재설정 API | ✅ 완료 | `reset-request`, `reset` |
| 회원가입 UI | 🔜 예정 | `/register` 페이지 |
| 로그인 UI 통합 | 🔜 예정 | 소셜 + 이메일 |
| 약관 페이지 | 🔜 예정 | `/terms`, `/terms/privacy` |
| 관리자 대시보드 확장 | 🔜 예정 | 사용자 상세, 활동 로그 |

---

## 📋 기술 스택

### 프론트엔드
- **Framework:** Next.js 14 (App Router)
- **UI:** React, TailwindCSS, Radix UI
- **State:** Zustand, React Query
- **Form:** React Hook Form, Zod

### 백엔드
- **Runtime:** Next.js API Routes (Edge 호환)
- **Database:** Supabase (PostgreSQL)
- **Auth:** 자체 JWT (jose 라이브러리)
- **AI:** Groq API (Llama 3)
- **Email:** Resend API

### 보안
- JWT 서명된 세션
- OAuth state + PKCE
- Rate Limiting (LRU Cache)
- 비밀번호 해싱 (PBKDF2)
- 인증 코드 해싱 (SHA-256)

---

## 🔐 보안 정책

### 비밀번호
- **NIST 준수**: 길이 기반 정책 (10자 이상)
- 흔한 비밀번호 10,000개 차단
- 사용자 정보 포함 차단
- 연속 문자/숫자 패턴 차단

### 인증
- 이메일 인증 코드: SHA-256 해시 저장
- 최대 5회 시도 제한
- 10분 만료
- Rate Limit: 이메일당 5회/시간, IP당 10회/시간

### 세션
- JWT (HS256)
- 사용자 세션: 7일
- 관리자 세션: 24시간
- HttpOnly, Secure, SameSite=Lax

---

## 📁 파일 구조 (인증 관련)

```
src/
├── lib/
│   ├── session.ts       # JWT 세션 관리
│   ├── crypto.ts        # 암호화 유틸리티
│   ├── email.ts         # 이메일 발송
│   ├── rateLimit.ts     # Rate Limiting
│   └── oauth.ts         # OAuth 보안
├── app/
│   ├── api/auth/
│   │   ├── email/
│   │   │   ├── send-code/     # 인증 코드 발송
│   │   │   ├── verify-code/   # 인증 코드 확인
│   │   │   ├── register/      # 이메일 회원가입
│   │   │   └── login/         # 이메일 로그인
│   │   ├── password/
│   │   │   ├── reset-request/ # 비밀번호 재설정 요청
│   │   │   └── reset/         # 비밀번호 재설정
│   │   ├── google/            # 구글 OAuth
│   │   ├── kakao/             # 카카오 OAuth
│   │   ├── me/                # 현재 사용자
│   │   ├── logout/            # 로그아웃
│   │   └── onboarding/        # 온보딩
│   └── (pages)/
│       ├── login/             # 로그인 페이지
│       ├── register/          # 회원가입 페이지
│       └── password-reset/    # 비밀번호 재설정
└── middleware.ts              # 인증 미들웨어
```

---

## 🗓️ 예정된 마일스톤

### v2.1 - 회원가입 UI (1.5일)
- [ ] 통합 로그인 페이지 (`/login`)
- [ ] 이메일 회원가입 다단계 폼 (`/register`)
- [ ] 비밀번호 재설정 페이지 (`/password-reset`)
- [ ] 약관 페이지 (`/terms`, `/terms/privacy`)

### v2.2 - 관리자 대시보드 확장 (2일)
- [ ] 사용자 목록 (검색, 필터, 페이지네이션)
- [ ] 사용자 상세 (프로필, 활동, 제재)
- [ ] 관리자 활동 로그
- [ ] 토론방 관리

### v2.3 - 추가 기능 (TBD)
- [ ] 소셜 계정에 비밀번호 연결
- [ ] 프로필 편집
- [ ] 계정 삭제

---

## 🔧 환경 변수

### 필수
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# 세션
SESSION_SECRET=  # 최소 32자

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
KAKAO_REST_API_KEY=
KAKAO_CLIENT_SECRET=

# AI
GROQ_API_KEY=
```

### 선택 (이메일 발송)
```env
RESEND_API_KEY=  # Resend API Key
FROM_EMAIL=noreply@yourdomain.com
```

---

## 📚 참고 문서

- [보안 수정 보고서](./SECURITY_REMEDIATION_PLAN.md)
- [환경 변수 가이드](./ENV_SETUP.md)
- [AI 프롬프트 가이드](./AI_PROMPT_GUIDE.md)

---

*이 문서는 프로젝트 진행에 따라 업데이트됩니다.*
