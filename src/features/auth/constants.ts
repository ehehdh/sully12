/**
 * 인증 관련 상수
 */

// 세션 설정
export const SESSION_CONFIG = {
  // 세션 만료 시간 (밀리초)
  EXPIRY_MS: 7 * 24 * 60 * 60 * 1000, // 7일
  
  // 리프레시 토큰 만료 시간
  REFRESH_EXPIRY_MS: 30 * 24 * 60 * 60 * 1000, // 30일
  
  // 세션 갱신 임계값 (만료 1시간 전 갱신)
  REFRESH_THRESHOLD_MS: 60 * 60 * 1000,
  
  // 로컬 스토리지 키
  STORAGE_KEY: 'politi-log-session',
} as const;

// 권한 레벨
export const PERMISSION_LEVELS = {
  user: 1,
  moderator: 5,
  admin: 10,
} as const;

// 보호된 라우트
export const PROTECTED_ROUTES = [
  '/admin',
  '/admin/*',
  '/debate/create',
  '/profile',
  '/settings',
] as const;

// 공개 라우트 (인증 불필요)
export const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/debate/[id]/spectate',
] as const;

// 인증 에러 메시지
export const AUTH_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
  EXPIRED_SESSION: '세션이 만료되었습니다. 다시 로그인해주세요.',
  NETWORK_ERROR: '네트워크 오류가 발생했습니다.',
  UNAUTHORIZED: '권한이 없습니다.',
  EMAIL_NOT_VERIFIED: '이메일 인증이 필요합니다.',
} as const;

// 소셜 로그인 설정
export const SOCIAL_AUTH_CONFIG = {
  google: {
    name: 'Google',
    icon: 'google',
    color: '#4285F4',
  },
  kakao: {
    name: 'Kakao',
    icon: 'kakao',
    color: '#FEE500',
  },
  github: {
    name: 'GitHub',
    icon: 'github',
    color: '#333333',
  },
} as const;
