# 🎯 Politi-Log 회원 시스템 & 관리자 시스템 종합 계획

> 최종 업데이트: 2024-12-31
> 목적: 실제 배포를 위한 프로덕션-레디 시스템 설계

---

## 📋 목차

1. [현재 문제점 분석](#1-현재-문제점-분석)
2. [회원 시스템 설계](#2-회원-시스템-설계)
3. [관리자 시스템 설계](#3-관리자-시스템-설계)
4. [데이터베이스 스키마](#4-데이터베이스-스키마)
5. [API 엔드포인트 설계](#5-api-엔드포인트-설계)
6. [보안 정책](#6-보안-정책)
7. [구현 체크리스트](#7-구현-체크리스트)

---

## 1. 현재 문제점 분석

### 🚫 회원 탈퇴 500 에러
- **원인**: `users` 테이블의 `kakao_id` 컬럼이 `NOT NULL`로 설정되어 있어, 탈퇴 시 `kakao_id = null`로 업데이트할 때 제약조건 위반
- **해결**: `kakao_id`, `google_id`를 `NULLABLE`로 변경하고, Soft Delete 로직 적용

### 🚫 관리자 페이지 사용자 집계 불가
- **원인**: `deleted_at` 컬럼이 DB에 존재하지 않아 쿼리 실패
- **해결**: 마이그레이션 스크립트를 통해 필요한 모든 컬럼 추가

---

## 2. 회원 시스템 설계

### 2.1 회원가입 (Registration)

#### 지원 방식
| 방식 | 상태 | 설명 |
|------|------|------|
| Google OAuth | ✅ 구현됨 | 원클릭 소셜 로그인 |
| Kakao OAuth | ✅ 구현됨 | 원클릭 소셜 로그인 |
| 이메일 회원가입 | ⏳ 향후 | 이메일 인증 필요 |

#### 회원가입 플로우
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   소셜 로그인   │────▶│  사용자 정보 확인 │────▶│  신규/기존 분기  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                        │
                        ┌───────────────────────────────┼───────────────────────────────┐
                        ▼                               ▼                               ▼
                ┌───────────────┐              ┌───────────────┐              ┌───────────────┐
                │  신규 사용자  │              │  기존 사용자  │              │  탈퇴한 계정  │
                └───────┬───────┘              └───────┬───────┘              └───────┬───────┘
                        ▼                               ▼                               ▼
                ┌───────────────┐              ┌───────────────┐              ┌───────────────┐
                │ 온보딩 (닉네임)│              │  세션 갱신    │              │  복구 안내    │
                └───────────────┘              └───────────────┘              └───────────────┘
```

#### 수집 정보
| 필드 | 필수 | 소스 | 설명 |
|------|------|------|------|
| id | ✅ | 자동 생성 | UUID v4 |
| nickname | ✅ | 소셜 → 사용자 | 2~20자, 중복 불가 |
| email | ❌ | 소셜 | 선택적 공개 |
| profile_image | ❌ | 소셜 | URL |
| google_id | ❌ | Google OAuth | 연동 시 저장 |
| kakao_id | ❌ | Kakao OAuth | 연동 시 저장 |

### 2.2 로그인 (Login)

#### JWT 세션 관리
```typescript
// 세션 페이로드
interface UserSessionPayload {
  userId: string;      // UUID
  nickname: string;
  email?: string;
  profileImage?: string;
  googleId?: string;
  kakaoId?: string;
  role: 'user' | 'moderator' | 'admin';
  iat: number;         // 발급 시간
  exp: number;         // 만료 시간 (7일)
}
```

#### 로그인 상태 관리
| 상태 | 설명 | 처리 |
|------|------|------|
| 정상 | 활성 계정 | 세션 발급 |
| 정지됨 | suspended_until까지 정지 | 정지 안내 + 잔여기간 표시 |
| 차단됨 | 영구 차단 | 차단 안내 |
| 탈퇴됨 | deleted_at 존재 | 복구 가능 여부 안내 |

### 2.3 로그아웃 (Logout)

#### 처리 내용
1. 모든 인증 관련 쿠키 삭제
   - `politi-log-session`
   - `oauth_state`
   - `oauth_code_verifier`
2. 클라이언트 상태 초기화
3. 홈페이지로 리다이렉트

### 2.4 회원 탈퇴 (Account Deletion)

#### Soft Delete 방식
```sql
-- 탈퇴 처리 (하드 삭제 아님)
UPDATE users SET
  deleted_at = NOW(),
  nickname = 'Deleted User ' || SUBSTR(id::text, 1, 8),
  email = NULL,
  profile_image = NULL,
  kakao_id = NULL,
  google_id = NULL
WHERE id = $userId;
```

#### 탈퇴 후 데이터 처리
| 데이터 | 처리 | 이유 |
|--------|------|------|
| 닉네임 | 익명화 | 토론 기록 보존 |
| 이메일 | 삭제 | 개인정보 보호 |
| 프로필 이미지 | 삭제 | 개인정보 보호 |
| 소셜 ID | 삭제 | 재로그인 방지 |
| 토론 기록 | 보존 | 서비스 무결성 |
| 메시지 기록 | 보존 | 토론 맥락 유지 |

#### 복구 정책
- 탈퇴 후 30일 이내: 고객센터 통해 복구 가능
- 30일 이후: 개인정보 영구 삭제 (GDPR 준수)

### 2.5 프로필 관리

#### 수정 가능 항목
| 항목 | 제한사항 |
|------|----------|
| 닉네임 | 2~20자, 중복 불가 |
| 프로필 이미지 | 소셜에서 가져온 URL 사용 |
| 성별 | male/female/other/private |
| 생년월일 | DATE 형식 |
| 지역 | 자유 텍스트 |
| 소개글 | 최대 500자 |

---

## 3. 관리자 시스템 설계

### 3.1 관리자 인증

#### 로그인 방식
1. **비밀번호 인증** (현재): 환경변수에 저장된 비밀번호 확인
2. **향후 개선**: 관리자 계정 역할 기반 (role='admin')

```typescript
// 관리자 세션
interface AdminSessionPayload {
  isAdmin: boolean;
  adminId?: string;     // 추후 관리자 계정 연동 시
  adminNickname?: string;
  createdAt: number;
  exp: number;          // 24시간
}
```

### 3.2 관리자 대시보드 구성

#### 내부 관리 페이지 (/admin)
```
┌─────────────────────────────────────────────────────────────────┐
│                        관리자 대시보드                           │
├──────────────┬──────────────┬──────────────┬──────────────────────┤
│   사용자 관리 │   토론 관리  │   신고 관리  │   시스템 로그       │
├──────────────┼──────────────┼──────────────┼──────────────────────┤
│ • 사용자 목록 │ • 진행중 토론│ • 신고 목록  │ • 관리자 활동 로그  │
│ • 상태 변경  │ • 종료된 토론│ • 처리 내역  │ • 시스템 통계       │
│ • 제재 이력  │ • 주제 관리  │ • 제재 적용  │ • 오류 로그         │
└──────────────┴──────────────┴──────────────┴──────────────────────┘
```

#### 외부 Supabase 대시보드 연동
- **Supabase Dashboard**: 데이터베이스 직접 접근
- **실시간 모니터링**: Realtime 구독 현황
- **Auth 관리**: 인증 로그 확인
- **Storage**: 파일 저장소 관리

### 3.3 사용자 관리 기능

#### 조회 기능
| 기능 | 설명 |
|------|------|
| 전체 목록 | 페이지네이션 (15명/페이지) |
| 검색 | 닉네임, 이메일 검색 |
| 필터 | 역할(user/moderator/admin), 상태(active/suspended/banned/deleted) |
| 정렬 | 가입일, 마지막 로그인, 토론 수 |

#### 제재 기능
| 조치 | 설명 | 기간 |
|------|------|------|
| 경고 | warning_count 증가 | - |
| 정지 | 일시적 이용 제한 | 1일/7일/30일 |
| 차단 | 영구 이용 금지 | 영구 |
| 해제 | 정지/차단 해제 | - |

### 3.4 신고 처리 시스템

#### 신고 유형
```typescript
type ReportReason = 
  | 'offensive_language'     // 욕설/비하
  | 'spam'                   // 스팸/도배
  | 'harassment'             // 괴롭힘
  | 'inappropriate_content'  // 부적절한 내용
  | 'cheating'               // 부정행위
  | 'other';                 // 기타
```

#### 처리 상태
```
pending → reviewing → resolved/dismissed
```

#### 자동화 규칙 (향후)
- 경고 3회 → 자동 1일 정지
- 정지 3회 → 자동 7일 정지
- 심각한 위반 → 즉시 차단 검토

### 3.5 활동 로그

#### 기록 항목
| 이벤트 | 기록 내용 |
|--------|----------|
| 로그인 | 관리자 ID, IP, 시간 |
| 사용자 제재 | 대상, 조치 유형, 사유 |
| 신고 처리 | 신고 ID, 처리 결과 |
| 설정 변경 | 변경 항목, 이전/이후 값 |

---

## 4. 데이터베이스 스키마

### 4.1 users 테이블 (완전판)
```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- 소셜 로그인 ID (모두 NULLABLE, 하나 이상 필수)
  kakao_id TEXT UNIQUE,
  google_id TEXT UNIQUE,
  
  -- 기본 정보
  nickname VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  profile_image TEXT,
  
  -- 역할 및 상태
  role VARCHAR(20) NOT NULL DEFAULT 'user' 
    CHECK (role IN ('user', 'moderator', 'admin')),
  
  -- 제재 관련
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  ban_reason TEXT,
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  suspended_until TIMESTAMPTZ,
  suspended_reason TEXT,
  warning_count INTEGER NOT NULL DEFAULT 0,
  
  -- 추가 프로필 정보
  gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'private')),
  birth_date DATE,
  region VARCHAR(100),
  bio TEXT,
  
  -- 약관 동의
  agreed_terms BOOLEAN NOT NULL DEFAULT FALSE,
  agreed_privacy BOOLEAN NOT NULL DEFAULT FALSE,
  agreed_marketing BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- 활동 기록
  login_count INTEGER NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  
  -- 탈퇴 관리
  deleted_at TIMESTAMPTZ,
  
  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 최소 하나의 소셜 ID 필수 (탈퇴 시 예외)
  CONSTRAINT chk_has_social_id CHECK (
    deleted_at IS NOT NULL 
    OR kakao_id IS NOT NULL 
    OR google_id IS NOT NULL
  )
);

-- 인덱스
CREATE INDEX idx_users_nickname ON users(nickname);
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(is_banned, is_suspended);
CREATE INDEX idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_users_created ON users(created_at DESC);
```

### 4.2 user_stats 테이블 (통계)
```sql
CREATE TABLE public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  total_debates INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  
  pro_debates INTEGER NOT NULL DEFAULT 0,
  pro_wins INTEGER NOT NULL DEFAULT 0,
  con_debates INTEGER NOT NULL DEFAULT 0,
  con_wins INTEGER NOT NULL DEFAULT 0,
  
  avg_score NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  highest_score INTEGER NOT NULL DEFAULT 0,
  
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_win_streak INTEGER NOT NULL DEFAULT 0,
  
  last_debate_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.3 admin_activity_logs 테이블
```sql
CREATE TABLE public.admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL,
  admin_identifier VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  target_snapshot JSONB,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_logs_created ON admin_activity_logs(created_at DESC);
CREATE INDEX idx_admin_logs_action ON admin_activity_logs(action);
```

---

## 5. API 엔드포인트 설계

### 5.1 인증 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/auth/google` | Google 로그인 시작 |
| GET | `/api/auth/google/callback` | Google 콜백 처리 |
| GET | `/api/auth/kakao` | Kakao 로그인 시작 |
| GET | `/api/auth/kakao/callback` | Kakao 콜백 처리 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 현재 세션 확인 |

### 5.2 사용자 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/users/me` | 내 프로필 조회 |
| PATCH | `/api/users/me` | 내 프로필 수정 |
| DELETE | `/api/users/me` | 회원 탈퇴 |
| GET | `/api/users/me/stats` | 내 통계 조회 |
| GET | `/api/users/me/history` | 내 토론 기록 |

### 5.3 관리자 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/admin/auth` | 관리자 로그인 |
| GET | `/api/admin/users` | 사용자 목록 조회 |
| PATCH | `/api/admin/users` | 사용자 제재/해제 |
| GET | `/api/admin/users/[id]` | 사용자 상세 조회 |
| GET | `/api/admin/reports` | 신고 목록 조회 |
| PATCH | `/api/admin/reports/[id]` | 신고 처리 |
| GET | `/api/admin/logs` | 활동 로그 조회 |

---

## 6. 보안 정책

### 6.1 세션 보안
- JWT HS256 서명
- HttpOnly 쿠키 (XSS 방지)
- Secure 플래그 (HTTPS only)
- SameSite=Lax (CSRF 방지)

### 6.2 API 보안
- Rate Limiting: 분당 60회 (인증), 분당 10회 (비인증)
- CORS: 허용된 도메인만
- Input Validation: 모든 입력값 검증

### 6.3 관리자 보안
- 별도 세션 관리 (24시간 만료)
- IP 로깅
- 모든 행동 로그 기록

---

## 7. 구현 체크리스트

### Phase 1: 긴급 수정 (현재 버그 해결)
- [ ] users 테이블에 deleted_at 컬럼 추가
- [ ] kakao_id NOT NULL 제약조건 제거
- [ ] DELETE /api/users/me 수정
- [ ] 관리자 사용자 조회 API 수정

### Phase 2: 기능 완성
- [ ] 사용자 제재 기능 테스트
- [ ] 신고 처리 시스템 완성
- [ ] 관리자 활동 로그 UI 완성

### Phase 3: 고도화
- [ ] 이메일 알림 시스템
- [ ] 통계 대시보드
- [ ] 자동 제재 규칙

### Phase 4: 모니터링
- [ ] Supabase Dashboard 연동 가이드
- [ ] 알림 시스템 (Slack/Discord)
- [ ] 에러 트래킹 (Sentry)

---

## 📎 참조 문서
- [Supabase Auth 가이드](https://supabase.com/docs/guides/auth)
- [Next.js App Router 인증](https://nextjs.org/docs/app/building-your-application/authentication)
- [GDPR 준수 가이드라인](https://gdpr.eu/)
