/**
 * 관리자 기능 상수
 */

// 관리자 메뉴 항목
export const ADMIN_MENU_ITEMS = [
  {
    id: 'dashboard',
    label: '대시보드',
    icon: 'LayoutDashboard',
    path: '/admin',
    permission: 'admin',
  },
  {
    id: 'topics',
    label: '토론 주제 관리',
    icon: 'MessageSquare',
    path: '/admin/topics',
    permission: 'admin',
  },
  {
    id: 'users',
    label: '사용자 관리',
    icon: 'Users',
    path: '/admin/users',
    permission: 'admin',
  },
  {
    id: 'prompts',
    label: 'AI 프롬프트 설정',
    icon: 'Bot',
    path: '/admin/prompts',
    permission: 'admin',
  },
  {
    id: 'settings',
    label: '시스템 설정',
    icon: 'Settings',
    path: '/admin/settings',
    permission: 'admin',
  },
  {
    id: 'logs',
    label: '활동 로그',
    icon: 'FileText',
    path: '/admin/logs',
    permission: 'admin',
  },
] as const;

// 기본 시스템 설정
export const DEFAULT_SYSTEM_SETTINGS = {
  maxRoomsPerUser: 3,
  maxParticipantsPerRoom: 2,
  defaultDebateDuration: 1200, // 20분
  enableAIModeration: true,
  enableSpectatorMode: false,
  maintenanceMode: false,
} as const;

// 사용자 상태 옵션
export const USER_STATUS_OPTIONS = [
  { value: 'active', label: '활성', color: 'green' },
  { value: 'suspended', label: '정지', color: 'yellow' },
  { value: 'banned', label: '차단', color: 'red' },
] as const;

// 역할 옵션
export const ROLE_OPTIONS = [
  { value: 'user', label: '일반 사용자', level: 1 },
  { value: 'moderator', label: '모더레이터', level: 5 },
  { value: 'admin', label: '관리자', level: 10 },
] as const;

// 프롬프트 카테고리
export const PROMPT_CATEGORIES = [
  { id: 'fallacy', label: '논리 오류 검사', icon: 'AlertTriangle' },
  { id: 'fact', label: '팩트 체크', icon: 'CheckCircle' },
  { id: 'toxicity', label: '독성 언어 검사', icon: 'Shield' },
  { id: 'verdict', label: '최종 판정', icon: 'Scale' },
  { id: 'opponent', label: 'AI 상대방', icon: 'Bot' },
] as const;
