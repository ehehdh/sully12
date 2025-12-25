# 🚀 Politi-Log 기능 개발 가이드

> 블록 단위로 기능을 추가하는 방법

## 개요

Politi-Log는 **기능 모듈(Feature Module)** 패턴을 사용합니다.
각 기능은 독립적인 "블록"으로 개발되며, 필요에 따라 조립할 수 있습니다.

---

## 📦 기능 모듈 구조

각 기능 모듈은 다음 구조를 따릅니다:

```
features/
└── [feature-name]/
    ├── index.ts           # 📤 공개 API (외부 진입점)
    ├── types.ts           # 📝 타입 정의
    ├── constants.ts       # 🔧 상수 정의
    │
    ├── services/          # 💼 비즈니스 로직
    │   └── [name]Service.ts
    │
    ├── hooks/             # 🪝 React Hooks
    │   └── use[Name].ts
    │
    ├── components/        # 🎨 UI 컴포넌트
    │   └── [Name].tsx
    │
    ├── api/               # 🌐 API 핸들러
    │   └── route.ts
    │
    └── utils/             # 🛠 유틸리티
        └── [helper].ts
```

---

## 🆕 새 기능 추가 예시: 알림 기능

### Step 1: 폴더 구조 생성

```bash
mkdir -p src/features/notifications/{services,hooks,components}
```

### Step 2: 타입 정의 (`types.ts`)

```typescript
// src/features/notifications/types.ts

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export type NotificationType = 
  | 'debate_invite'
  | 'debate_started'
  | 'turn_reminder'
  | 'verdict_ready'
  | 'system';

export interface NotificationSettings {
  enablePush: boolean;
  enableEmail: boolean;
  debateReminders: boolean;
}
```

### Step 3: 상수 정의 (`constants.ts`)

```typescript
// src/features/notifications/constants.ts

export const NOTIFICATION_TYPES = {
  debate_invite: { icon: '📩', color: 'blue' },
  debate_started: { icon: '🎯', color: 'green' },
  turn_reminder: { icon: '⏰', color: 'yellow' },
  verdict_ready: { icon: '🏆', color: 'purple' },
  system: { icon: '🔔', color: 'gray' },
} as const;

export const MAX_NOTIFICATIONS = 50;
export const NOTIFICATION_CHECK_INTERVAL = 30000; // 30초
```

### Step 4: 서비스 로직 (`services/notificationService.ts`)

```typescript
// src/features/notifications/services/notificationService.ts

import { Notification, NotificationType } from '../types';
import { MAX_NOTIFICATIONS } from '../constants';

export async function getNotifications(userId: string): Promise<Notification[]> {
  // Supabase에서 알림 조회
}

export async function markAsRead(notificationId: string): Promise<void> {
  // 읽음 처리
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string
): Promise<Notification> {
  // 알림 생성
}
```

### Step 5: React Hook (`hooks/useNotifications.ts`)

```typescript
// src/features/notifications/hooks/useNotifications.ts

import { useState, useEffect } from 'react';
import { Notification } from '../types';
import { getNotifications, markAsRead } from '../services/notificationService';
import { NOTIFICATION_CHECK_INTERVAL } from '../constants';

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 초기 로드 및 주기적 체크
  }, [userId]);

  const markNotificationAsRead = async (id: string) => {
    await markAsRead(id);
    // 상태 업데이트
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markNotificationAsRead,
  };
}
```

### Step 6: 컴포넌트 (`components/NotificationBell.tsx`)

```tsx
// src/features/notifications/components/NotificationBell.tsx

'use client';

import { useNotifications } from '../hooks/useNotifications';
import { NOTIFICATION_TYPES } from '../constants';

interface Props {
  userId: string;
}

export function NotificationBell({ userId }: Props) {
  const { notifications, unreadCount, markAsRead } = useNotifications(userId);

  return (
    <div className="relative">
      <button className="p-2">
        🔔
        {unreadCount > 0 && (
          <span className="badge">{unreadCount}</span>
        )}
      </button>
      {/* 드롭다운 메뉴 */}
    </div>
  );
}
```

### Step 7: 공개 API (`index.ts`)

```typescript
// src/features/notifications/index.ts

/**
 * 알림 기능 모듈
 * 
 * 📋 상태: 계획됨
 */

export * from './types';
export * from './constants';
export { useNotifications } from './hooks/useNotifications';
export { NotificationBell } from './components/NotificationBell';
export {
  getNotifications,
  markAsRead,
  createNotification,
} from './services/notificationService';
```

### Step 8: 모듈 레지스트리 등록

```typescript
// src/features/index.ts 에 추가

export const FEATURE_REGISTRY = {
  // ... 기존 모듈
  notifications: {
    name: 'Notifications',
    description: '알림 시스템',
    status: 'planned',
    dependencies: ['core', 'auth'],
  },
};
```

---

## 🔌 기능 모듈 사용 방법

### 다른 곳에서 import

```typescript
// 모듈에서 필요한 것만 import
import { 
  useNotifications, 
  NotificationBell,
  Notification,
} from '@/features/notifications';

// 또는 특정 파일에서 직접 import
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
```

### 페이지에서 사용

```tsx
// src/app/layout.tsx

import { NotificationBell } from '@/features/notifications';

export default function Layout({ children }) {
  return (
    <html>
      <body>
        <header>
          <NotificationBell userId={currentUserId} />
        </header>
        {children}
      </body>
    </html>
  );
}
```

---

## ✅ 체크리스트

새 기능 모듈 개발 시:

- [ ] `types.ts` 작성 완료
- [ ] `constants.ts` 작성 완료
- [ ] 서비스 로직 구현
- [ ] React Hook 구현 (필요시)
- [ ] 컴포넌트 구현 (필요시)
- [ ] `index.ts`에서 공개 API 정의
- [ ] `features/index.ts`에 모듈 등록
- [ ] README 또는 문서 업데이트

---

## 🎯 현재 구현된 모듈

| 모듈 | 상태 | 설명 |
|------|------|------|
| `core` | ✅ | 핵심 설정, 공통 유틸리티 |
| `debate` | 🚧 | 토론 핵심 로직 |
| `ai-moderator` | 🚧 | AI 중재자 시스템 |
| `auth` | 📋 | 인증/로그인 (구조만) |
| `admin` | 📋 | 관리자 기능 (구조만) |

### 다음 구현 우선순위

1. **auth** - 로그인 기능 완성
2. **admin** - 관리자 대시보드
3. **spectator** - 관전 모드
4. **analytics** - 토론 분석

---

## 💡 팁

1. **작게 시작하세요**: 최소한의 기능부터 구현하고 점진적으로 확장
2. **타입 먼저**: 항상 `types.ts`부터 작성
3. **의존성 최소화**: 다른 모듈에 대한 의존성을 최소화
4. **테스트 가능하게**: 서비스 로직은 순수 함수로 작성

---

좋은 코딩 되세요! 🚀
