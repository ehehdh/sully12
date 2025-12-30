/**
 * 보안 세션 관리 모듈
 * - JWT 기반 서명된 세션 토큰
 * - 세션 위조 방지
 */
import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// 세션 페이로드 타입 정의
export interface UserSessionPayload extends JWTPayload {
  userId: string;
  email?: string;
  nickname?: string;
  profileImage?: string | null;
  googleId?: string;
  kakaoId?: string;
  role?: string;
}

export interface AdminSessionPayload extends JWTPayload {
  isAdmin: boolean;
  createdAt: number;
}

// 쿠키 이름 상수
export const USER_SESSION_COOKIE = 'politi-log-session';
export const ADMIN_SESSION_COOKIE = 'politi-log-admin-session';

// JWT 시크릿 키 (환경 변수에서 로드)
function getJwtSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secret);
}

// ==================== 사용자 세션 ====================

/**
 * 사용자 세션 토큰 생성
 */
export async function createUserSession(payload: Omit<UserSessionPayload, 'iat' | 'exp'>): Promise<string> {
  const secret = getJwtSecret();
  
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7일 후 만료
    .sign(secret);
}

/**
 * 사용자 세션 토큰 검증
 */
export async function verifyUserSession(token: string): Promise<UserSessionPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload as UserSessionPayload;
  } catch (error) {
    console.error('User session verification failed:', error);
    return null;
  }
}

/**
 * 요청에서 사용자 세션 가져오기
 */
export async function getUserSession(request: NextRequest): Promise<UserSessionPayload | null> {
  const sessionCookie = request.cookies.get(USER_SESSION_COOKIE);
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  return verifyUserSession(sessionCookie.value);
}

/**
 * 서버 컴포넌트에서 사용자 세션 가져오기
 */
export async function getUserSessionFromCookies(): Promise<UserSessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(USER_SESSION_COOKIE);
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  return verifyUserSession(sessionCookie.value);
}

// ==================== 관리자 세션 ====================

/**
 * 관리자 세션 토큰 생성
 */
export async function createAdminSession(): Promise<string> {
  const secret = getJwtSecret();
  
  const payload: AdminSessionPayload = {
    isAdmin: true,
    createdAt: Date.now(),
  };
  
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h') // 24시간 후 만료
    .sign(secret);
}

/**
 * 관리자 세션 토큰 검증
 */
export async function verifyAdminSession(token: string): Promise<AdminSessionPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    
    // isAdmin 플래그 확인
    if (!(payload as AdminSessionPayload).isAdmin) {
      return null;
    }
    
    return payload as AdminSessionPayload;
  } catch (error) {
    console.error('Admin session verification failed:', error);
    return null;
  }
}

/**
 * 요청에서 관리자 세션 가져오기
 */
export async function getAdminSession(request: NextRequest): Promise<AdminSessionPayload | null> {
  const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE);
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  return verifyAdminSession(sessionCookie.value);
}

/**
 * 관리자 인증 확인 (API 라우트용)
 */
export async function requireAdminAuth(request: NextRequest): Promise<{ authorized: boolean; error?: string }> {
  const session = await getAdminSession(request);
  
  if (!session) {
    return { authorized: false, error: 'Unauthorized: Admin access required' };
  }
  
  return { authorized: true };
}

/**
 * 사용자 인증 확인 (API 라우트용)
 */
export async function requireUserAuth(request: NextRequest): Promise<{ 
  authorized: boolean; 
  session?: UserSessionPayload;
  error?: string 
}> {
  const session = await getUserSession(request);
  
  if (!session) {
    return { authorized: false, error: 'Unauthorized: Login required' };
  }
  
  return { authorized: true, session };
}
