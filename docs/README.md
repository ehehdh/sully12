# Politi-Log

> AI 기반 실시간 토론 플랫폼

## 📝 프로젝트 소개

Politi-Log는 AI 중재자가 진행하는 구조화된 온라인 토론 플랫폼입니다. 논리적 오류 검사, 팩트 체크, 독성 언어 감지 등 AI 기능을 통해 건설적인 토론 문화를 만들어갑니다.

### 주요 기능

- 🏛️ **구조화된 토론**: 12단계 토론 형식 (입론 → 교차조사 → 반박 → 최종변론)
- 🤖 **AI 중재자**: 실시간 논리 오류 감지 및 팩트 체크
- 📊 **점수 시스템**: 논증 품질에 따른 실시간 점수 변동
- 🏆 **AI 판정**: 토론 종료 후 AI의 공정한 승패 판정

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local` 파일 생성:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 📁 프로젝트 구조

```
politi-log/
├── docs/                    # 📚 문서
├── src/
│   ├── app/                 # Next.js 페이지
│   ├── components/          # UI 컴포넌트
│   ├── config/              # 설정 (AI 프롬프트)
│   ├── features/            # 기능 모듈
│   │   ├── auth/            # 인증
│   │   ├── admin/           # 관리자
│   │   ├── debate/          # 토론 핵심
│   │   └── ai-moderator/    # AI 중재자
│   └── lib/                 # 유틸리티
└── supabase/                # DB 스키마
```

## 📖 문서

자세한 내용은 [docs/](./docs/) 폴더를 참고하세요:

- [아키텍처](./docs/ARCHITECTURE.md)
- [기능 개발 가이드](./docs/FEATURE_DEVELOPMENT_GUIDE.md)
- [AI 프롬프트 가이드](./docs/AI_PROMPT_GUIDE.md)
- [기여 가이드](./docs/CONTRIBUTING.md)
- [배포 가이드](./docs/DEPLOYMENT.md)

## 🛠 기술 스택

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase
- **AI**: Groq API (Llama 3.1)
- **Database**: Supabase (PostgreSQL)
- **State**: Zustand

## 📜 라이선스

MIT License
