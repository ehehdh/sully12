import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserSession, createUserSession, USER_SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/me
 * 내 정보 조회 (프로필 상세)
 */
export async function GET(request: NextRequest) {
  const session = await getUserSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: user, error } = await supabase
      .from('users')
      .select(
        'id, nickname, email, profile_image, created_at, region, bio, gender, birth_date'
      )
      .eq('id', session.userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        profileImage: user.profile_image,
        createdAt: user.created_at,
        region: user.region,
        bio: user.bio,
        gender: user.gender,
        birthDate: user.birth_date,
      }
    });
  } catch (error) {
    console.error('User fetch error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/users/me
 * 내 정보 수정 (닉네임, 프로필 등)
 */
export async function PATCH(request: NextRequest) {
  const session = await getUserSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { nickname, region, bio, gender, birthDate } = body;

    // Supabase 연결
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 업데이트할 데이터 준비
    const updateData: Record<string, any> = {};
    if (region !== undefined) updateData.region = region;
    if (bio !== undefined) updateData.bio = bio;
    if (gender !== undefined) updateData.gender = gender;
    if (birthDate !== undefined) updateData.birth_date = birthDate;

    // 닉네임 변경 시 중복 체크
    if (nickname && nickname !== session.nickname) {
      if (nickname.length < 2 || nickname.length > 20) {
        return NextResponse.json({ error: '닉네임은 2~20자여야 합니다.' }, { status: 400 });
      }

      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('nickname', nickname)
        .neq('id', session.userId) // 내 닉네임 제외
        .single();
      
      if (existingUser) {
        return NextResponse.json({ error: '이미 사용 중인 닉네임입니다.' }, { status: 409 });
      }
      updateData.nickname = nickname;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: '변경할 내용이 없습니다.' });
    }

    // DB 업데이트
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', session.userId)
      .select()
      .single();

    if (error || !updatedUser) {
      console.error('Update user error:', error);
      return NextResponse.json({ error: '정보 수정에 실패했습니다.' }, { status: 500 });
    }

    // 닉네임이 변경되었다면 세션(JWT) 갱신 필요
    let newSessionToken = null;
    if (updateData.nickname) {
      newSessionToken = await createUserSession({
        ...session,
        nickname: updatedUser.nickname,
      });
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        nickname: updatedUser.nickname,
        region: updatedUser.region,
        bio: updatedUser.bio,
      }
    });

    // 새 세션 쿠키 설정
    if (newSessionToken) {
      response.cookies.set(USER_SESSION_COOKIE, newSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });
    }

    return response;

  } catch (error) {
    console.error('User update error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/users/me
 * 회원 탈퇴 (Soft Delete)
 */
export async function DELETE(request: NextRequest) {
  const session = await getUserSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Soft Delete 처리 (deleted_at 설정)
    // 실제 데이터 삭제가 아니라 비활성화 처리입니다.
    // 개인정보 보관 기간 정책에 따라 추후 영구 삭제 스케줄링이 필요할 수 있습니다.
    const { error } = await supabase
      .from('users')
      .update({ 
        deleted_at: new Date().toISOString(),
        nickname: `Deleted User ${session.userId.slice(0, 8)}`, // 닉네임 익명화
        kakao_id: null, // 소셜 연동 해제
        google_id: null, // 소셜 연동 해제
        // email은 보관할 수도 있고 삭제할 수도 있음 (정책에 따라)
      })
      .eq('id', session.userId);

    if (error) {
      console.error('User delete error:', error);
      return NextResponse.json({ error: '회원 탈퇴 처리에 실패했습니다.' }, { status: 500 });
    }

    const response = NextResponse.json({
      success: true,
      message: '회원 탈퇴가 완료되었습니다.'
    });

    // 세션 쿠키 삭제 (로그아웃)
    response.cookies.delete(USER_SESSION_COOKIE);
    
    // OAuth 관련 쿠키도 삭제 (재로그인 방지)
    response.cookies.delete('oauth_state');
    response.cookies.delete('oauth_code_verifier');

    return response;

  } catch (error) {
    console.error('User delete error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
