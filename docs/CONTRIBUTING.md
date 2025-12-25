# 🤝 기여 가이드라인

> Politi-Log 프로젝트에 기여하는 방법

## 📋 목차

1. [시작하기](#시작하기)
2. [개발 환경 설정](#개발-환경-설정)
3. [Git 워크플로우](#git-워크플로우)
4. [코드 스타일](#코드-스타일)
5. [Pull Request 가이드](#pull-request-가이드)
6. [코드 리뷰](#코드-리뷰)

---

## 시작하기

### 1. 저장소 Fork

GitHub에서 저장소를 Fork합니다.

### 2. 로컬에 Clone

```bash
git clone https://github.com/YOUR_USERNAME/politi-log.git
cd politi-log
```

### 3. Upstream 설정

```bash
git remote add upstream https://github.com/ORIGINAL_OWNER/politi-log.git
```

---

## 개발 환경 설정

### 필수 요구사항

- Node.js 18.x 이상
- npm 9.x 이상

### 설치

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 열어 필요한 값 입력

# 개발 서버 실행
npm run dev
```

---

## Git 워크플로우

### 브랜치 전략

```
main                    # 프로덕션 배포
├── develop             # 개발 통합 브랜치
│   ├── feature/xyz     # 새 기능
│   ├── fix/xyz         # 버그 수정
│   └── refactor/xyz    # 리팩토링
```

### 브랜치 명명 규칙

```bash
# 기능 추가
feature/add-login-page
feature/implement-spectator-mode

# 버그 수정
fix/timer-not-working
fix/memory-leak

# 리팩토링
refactor/extract-ai-service
refactor/optimize-queries
```

### 새 브랜치 생성

```bash
# 최신 develop 브랜치에서 시작
git checkout develop
git pull upstream develop
git checkout -b feature/your-feature-name
```

---

## 커밋 메시지 규칙

### 형식

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 종류

| Type | 설명 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서 수정 |
| `style` | 코드 포맷팅 (기능 변경 없음) |
| `refactor` | 코드 리팩토링 |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드/설정 변경 |

### 예시

```bash
# 기능 추가
git commit -m "feat(auth): add Google login support"

# 버그 수정
git commit -m "fix(timer): resolve countdown not stopping on stage change"

# 리팩토링
git commit -m "refactor(ai): extract prompt templates to config"
```

---

## 코드 스타일

### TypeScript

- **Strict 모드 사용**: `tsconfig.json`의 strict 옵션 활성화
- **명시적 타입**: 함수 반환 타입 명시 권장
- **any 최소화**: 불가피한 경우 `// eslint-disable-next-line` 사용

### 파일명 규칙

| 유형 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 | PascalCase | `ChatInterface.tsx` |
| 서비스/훅 | camelCase | `roomService.ts`, `useDebate.ts` |
| 상수/타입 | camelCase | `constants.ts`, `types.ts` |
| 폴더 | kebab-case | `ai-moderator/` |

### Import 순서

```typescript
// 1. 외부 라이브러리
import React from 'react';
import { useRouter } from 'next/navigation';

// 2. 내부 모듈 (features)
import { useDebate } from '@/features/debate';

// 3. 컴포넌트
import { Button } from '@/components/ui/button';

// 4. 유틸리티/타입
import { formatTime } from '@/lib/utils';
import type { DebateRoom } from '@/features/debate/types';
```

---

## Pull Request 가이드

### PR 생성 전 체크리스트

- [ ] 코드가 정상적으로 빌드됨 (`npm run build`)
- [ ] 린트 오류 없음 (`npm run lint`)
- [ ] 관련 타입 정의 추가
- [ ] 필요시 문서 업데이트

### PR 템플릿

```markdown
## 📝 변경 사항

<!-- 무엇을 변경했는지 설명 -->

## 🎯 관련 이슈

<!-- #123 형식으로 연결 -->
Closes #

## 📸 스크린샷

<!-- UI 변경이 있는 경우 -->

## ✅ 체크리스트

- [ ] 빌드 통과
- [ ] 린트 통과
- [ ] 타입 정의 추가
- [ ] 문서 업데이트

## 🧪 테스트 방법

<!-- 변경 사항을 어떻게 테스트할 수 있는지 -->
```

---

## 코드 리뷰

### 리뷰어 가이드라인

1. **존중하는 태도**: 건설적인 피드백 제공
2. **구체적으로**: "이상해요" 대신 "이 부분이 X 때문에 문제가 될 수 있어요"
3. **대안 제시**: 문제점 지적 시 가능하면 해결책도 제안

### 리뷰 우선순위

1. 🔴 **버그/보안**: 즉시 수정 필요
2. 🟡 **설계/성능**: 중요하지만 논의 가능
3. 🟢 **스타일/취향**: 선택사항

---

## 💬 커뮤니케이션

- **이슈**: 버그 리포트, 기능 요청
- **Discussion**: 아이디어 논의
- **PR 코멘트**: 코드 관련 피드백

---

감사합니다! 🙏
