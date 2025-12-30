/**
 * OAuth 보안 유틸리티
 * - State 토큰 생성/검증
 * - PKCE 지원
 */
import { SignJWT, jwtVerify } from 'jose';

// OAuth state 토큰용 시크릿
function getOAuthSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secret + '-oauth');
}

interface OAuthStatePayload {
  nonce: string;
  provider: 'google' | 'kakao';
  redirectTo?: string;
}

/**
 * 암호학적으로 안전한 랜덤 문자열 생성
 */
export function generateRandomString(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * PKCE code_verifier 생성
 */
export function generateCodeVerifier(): string {
  return generateRandomString(32);
}

/**
 * PKCE code_challenge 생성 (S256)
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  // Base64URL 인코딩
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * OAuth state 토큰 생성
 */
export async function createOAuthState(provider: 'google' | 'kakao', redirectTo?: string): Promise<string> {
  const secret = getOAuthSecret();
  
  const payload: OAuthStatePayload = {
    nonce: generateRandomString(16),
    provider,
    redirectTo,
  };
  
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m') // 10분 후 만료
    .sign(secret);
}

/**
 * OAuth state 토큰 검증
 */
export async function verifyOAuthState(
  token: string, 
  expectedProvider: 'google' | 'kakao'
): Promise<{ valid: boolean; redirectTo?: string }> {
  try {
    const secret = getOAuthSecret();
    const { payload } = await jwtVerify(token, secret);
    
    const statePayload = payload as unknown as OAuthStatePayload;
    
    // Provider 일치 확인
    if (statePayload.provider !== expectedProvider) {
      console.error('OAuth state provider mismatch');
      return { valid: false };
    }
    
    return { 
      valid: true, 
      redirectTo: statePayload.redirectTo 
    };
  } catch (error) {
    console.error('OAuth state verification failed:', error);
    return { valid: false };
  }
}

// OAuth 쿠키 이름
export const OAUTH_STATE_COOKIE = 'oauth_state';
export const OAUTH_CODE_VERIFIER_COOKIE = 'oauth_code_verifier';

// 쿠키 옵션
export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 600, // 10분
  path: '/',
};
