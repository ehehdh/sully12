# Politi-Log

> 🏛️ AI 기반 실시간 토론 플랫폼

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)

## 📝 소개

Politi-Log는 AI 중재자가 진행하는 구조화된 온라인 토론 플랫폼입니다.

### ✨ 주요 기능

- 🏛️ **12단계 구조화된 토론**: 입론 → 교차조사 → 반박 → 최종변론
- 🤖 **AI 중재자**: 실시간 논리 오류 감지 및 팩트 체크
- 📊 **점수 시스템**: 논증 품질에 따른 실시간 점수 변동
- 🏆 **AI 판정**: 공정한 승패 판정

## 🚀 빠른 시작

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local

# 개발 서버 실행
npm run dev
```

## 📖 문서

모든 문서는 [docs/](./docs/) 폴더에 있습니다:

| 문서 | 설명 |
|------|------|
| [README](./docs/README.md) | 프로젝트 상세 소개 |
| [ARCHITECTURE](./docs/ARCHITECTURE.md) | 시스템 아키텍처 |
| [FEATURE_DEVELOPMENT](./docs/FEATURE_DEVELOPMENT_GUIDE.md) | 기능 개발 가이드 |
| [AI_PROMPT](./docs/AI_PROMPT_GUIDE.md) | AI 프롬프트 관리 |
| [CONTRIBUTING](./docs/CONTRIBUTING.md) | 기여 가이드 |
| [DEPLOYMENT](./docs/DEPLOYMENT.md) | 배포 가이드 |

## 🛠 기술 스택

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **AI**: Groq API (Llama 3.1)

## 📁 프로젝트 구조

```
politi-log/
├── docs/                # 📚 문서
├── src/
│   ├── app/             # Next.js 페이지
│   ├── components/      # UI 컴포넌트
│   ├── config/          # 설정 (AI 프롬프트)
│   ├── features/        # 기능 모듈
│   └── lib/             # 유틸리티
└── supabase/            # DB 스키마
```

## 📜 라이선스

MIT License
