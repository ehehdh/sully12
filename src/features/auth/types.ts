/**
 * 인증 관련 타입 정의
 */

// 사용자 정보
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: Date;
  lastLoginAt?: Date;
}

// 사용자 역할
export type UserRole = 'user' | 'moderator' | 'admin';

// 인증 상태
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

// 로그인 요청
export interface LoginRequest {
  email: string;
  password: string;
}

// 소셜 로그인 프로바이더
export type SocialProvider = 'google' | 'kakao' | 'github';

// 세션 정보
export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  user: User;
}

// 로그인 결과
export interface AuthResult {
  success: boolean;
  session?: Session;
  error?: string;
}

// 권한 체크 결과
export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}
