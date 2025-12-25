/**
 * Politi-Log 기능 모듈 시스템 가이드
 * 
 * 각 기능은 독립적인 "블록"으로 구성됩니다.
 * 블록을 조립하여 전체 애플리케이션을 구성합니다.
 * 
 * 📁 폴더 구조 규칙:
 * 
 * features/
 * ├── [feature-name]/
 * │   ├── index.ts           # 공개 API (외부에서 접근하는 진입점)
 * │   ├── types.ts           # 타입 정의
 * │   ├── constants.ts       # 상수
 * │   ├── hooks/             # React hooks
 * │   │   └── use[Feature].ts
 * │   ├── components/        # UI 컴포넌트
 * │   │   └── [ComponentName].tsx
 * │   ├── services/          # 비즈니스 로직
 * │   │   └── [feature]Service.ts
 * │   ├── api/               # API 라우트 핸들러
 * │   │   └── route.ts
 * │   └── utils/             # 유틸리티 함수
 * │       └── [helper].ts
 */

/**
 * 기능 모듈 목록 (계획)
 * 
 * ✅ 구현됨
 * 🚧 진행 중
 * 📋 계획됨
 * 
 * [✅] core/         - 핵심 설정, 공통 유틸리티
 * [🚧] debate/       - 토론 핵심 로직
 * [🚧] ai-moderator/ - AI 중재자 시스템
 * [📋] auth/         - 인증/로그인
 * [📋] admin/        - 관리자 기능
 * [📋] spectator/    - 관전 모드
 * [📋] analytics/    - 분석/통계
 */

export const FEATURE_STATUS = {
  IMPLEMENTED: 'implemented',
  IN_PROGRESS: 'in_progress',
  PLANNED: 'planned',
} as const;

export const FEATURE_REGISTRY = {
  core: {
    name: 'Core',
    description: '핵심 설정 및 공통 유틸리티',
    status: 'implemented',
    dependencies: [],
  },
  debate: {
    name: 'Debate',
    description: '토론 핵심 로직 (방 관리, 단계 진행)',
    status: 'in_progress',
    dependencies: ['core'],
  },
  'ai-moderator': {
    name: 'AI Moderator',
    description: 'AI 중재자 시스템 (팩트체크, 오류검사)',
    status: 'in_progress',
    dependencies: ['core', 'debate'],
  },
  auth: {
    name: 'Authentication',
    description: '사용자 인증 및 로그인',
    status: 'planned',
    dependencies: ['core'],
  },
  admin: {
    name: 'Admin',
    description: '관리자 페이지 및 기능',
    status: 'planned',
    dependencies: ['core', 'auth'],
  },
  spectator: {
    name: 'Spectator',
    description: '관전 모드 및 투표',
    status: 'planned',
    dependencies: ['core', 'debate'],
  },
  analytics: {
    name: 'Analytics',
    description: '토론 분석 및 통계',
    status: 'planned',
    dependencies: ['core', 'debate'],
  },
} as const;
