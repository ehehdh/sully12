import { NextRequest, NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'politi-log-admin-session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24시간

/**
 * POST /api/admin/auth
 * 관리자 비밀번호 검증 및 세션 발급
 */
export async function POST(request: NextRequest) {
  try {
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
        { status: 401 }
      );
    }
    
    // 세션 데이터 생성
    const sessionData = {
      isAdmin: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION,
    };
    
    // Base64로 인코딩
    const sessionValue = Buffer.from(JSON.stringify(sessionData)).toString('base64');
    
    // 응답 생성 및 쿠키 설정
    const response = NextResponse.json({ success: true });
    
    response.cookies.set(ADMIN_COOKIE_NAME, sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION / 1000, // 초 단위
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
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}

/**
 * GET /api/admin/auth
 * 현재 관리자 세션 상태 확인
 */
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME);
  
  if (!sessionCookie?.value) {
    return NextResponse.json({ isAdmin: false });
  }
  
  try {
    const sessionData = JSON.parse(
      Buffer.from(sessionCookie.value, 'base64').toString('utf-8')
    );
    
    if (Date.now() > sessionData.expiresAt) {
      return NextResponse.json({ isAdmin: false });
    }
    
    return NextResponse.json({ 
      isAdmin: true,
      expiresAt: sessionData.expiresAt 
    });
    
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
