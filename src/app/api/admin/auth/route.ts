import { NextRequest, NextResponse } from 'next/server';
import { createAdminSession, verifyAdminSession, ADMIN_SESSION_COOKIE } from '@/lib/session';
import { checkRateLimit, getRateLimitHeaders, getClientIP } from '@/lib/rateLimit';

const SESSION_DURATION = 24 * 60 * 60; // 24시간 (초 단위)

// 레이트 리밋 설정: 15분 동안 5회 시도 허용
const RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15분

/**
 * POST /api/admin/auth
 * 관리자 비밀번호 검증 및 세션 발급
 */
export async function POST(request: NextRequest) {
  try {
    // 레이트 리밋 체크
    const clientIP = getClientIP(request.headers);
    const rateLimitKey = `admin-login:${clientIP}`;
    const { allowed, remaining, resetAt } = checkRateLimit(
      rateLimitKey, 
      RATE_LIMIT_ATTEMPTS, 
      RATE_LIMIT_WINDOW_MS
    );
    
    if (!allowed) {
      const resetTime = Math.ceil((resetAt - Date.now()) / 1000 / 60); // 분 단위
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${resetTime} minutes.` },
        { 
          status: 429,
          headers: getRateLimitHeaders({ remaining, resetAt })
        }
      );
    }
    
    const { password } = await request.json();
    
    // 환경변수에서 관리자 비밀번호 가져오기
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD environment variable is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    // 비밀번호 검증
    if (password !== adminPassword) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { 
          status: 401,
          headers: getRateLimitHeaders({ remaining, resetAt })
        }
      );
    }
    
    // JWT 세션 토큰 생성
    const sessionToken = await createAdminSession();
    
    // 응답 생성 및 쿠키 설정
    const response = NextResponse.json({ success: true });
    
    response.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION,
      path: '/',
    });
    
    return response;
    
  } catch (error) {
    console.error('Admin auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/auth
 * 관리자 세션 로그아웃
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}

/**
 * GET /api/admin/auth
 * 현재 관리자 세션 상태 확인
 */
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE);
  
  if (!sessionCookie?.value) {
    return NextResponse.json({ isAdmin: false });
  }
  
  try {
    const session = await verifyAdminSession(sessionCookie.value);
    
    if (!session) {
      return NextResponse.json({ isAdmin: false });
    }
    
    return NextResponse.json({ 
      isAdmin: true,
      createdAt: session.createdAt
    });
    
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
