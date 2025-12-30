/**
 * 레이트 리밋 모듈
 * - IP 기반 요청 제한
 * - 무차별 대입 공격 방지
 */
import { LRUCache } from 'lru-cache';

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
}

// LRU 캐시 설정 (최대 500개 엔트리, 15분 TTL)
const rateLimitCache = new LRUCache<string, RateLimitEntry>({
  max: 500,
  ttl: 15 * 60 * 1000, // 15분
});

/**
 * 레이트 리밋 체크
 * @param key - 고유 식별자 (예: IP 주소, 사용자 ID 등)
 * @param limit - 허용되는 최대 시도 횟수
 * @param windowMs - 시간 윈도우 (밀리초)
 * @returns 허용 여부와 남은 시도 횟수
 */
export function checkRateLimit(
  key: string, 
  limit: number, 
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitCache.get(key);
  
  if (!entry) {
    // 첫 시도
    rateLimitCache.set(key, { count: 1, firstAttempt: now });
    return { 
      allowed: true, 
      remaining: limit - 1,
      resetAt: now + windowMs
    };
  }
  
  const windowExpiry = entry.firstAttempt + windowMs;
  
  if (now > windowExpiry) {
    // 윈도우 만료, 새로 시작
    rateLimitCache.set(key, { count: 1, firstAttempt: now });
    return { 
      allowed: true, 
      remaining: limit - 1,
      resetAt: now + windowMs
    };
  }
  
  if (entry.count >= limit) {
    // 제한 초과
    return { 
      allowed: false, 
      remaining: 0,
      resetAt: windowExpiry
    };
  }
  
  // 시도 횟수 증가
  entry.count++;
  rateLimitCache.set(key, entry);
  
  return { 
    allowed: true, 
    remaining: limit - entry.count,
    resetAt: windowExpiry
  };
}

/**
 * 레이트 리밋 헤더 생성
 */
export function getRateLimitHeaders(result: { remaining: number; resetAt: number }): Record<string, string> {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
  };
}

/**
 * IP 주소 추출 헬퍼
 * @param requestOrHeaders - NextRequest 또는 Headers 객체
 */
export function getClientIP(requestOrHeaders: { headers: Headers } | Headers): string {
  const headers = 'headers' in requestOrHeaders && typeof requestOrHeaders.headers.get === 'function'
    ? requestOrHeaders.headers 
    : requestOrHeaders as Headers;
  
  // Vercel, Cloudflare 등의 프록시 헤더 확인
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

