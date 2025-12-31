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
    const updateData: Record<string, unknown> = {};
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration for user deletion');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 먼저 현재 사용자 정보 확인
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, nickname, deleted_at')
      .eq('id', session.userId)
      .single();

    if (fetchError || !existingUser) {
      console.error('User not found for deletion:', fetchError);
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (existingUser.deleted_at) {
      return NextResponse.json({ error: '이미 탈퇴한 계정입니다.' }, { status: 400 });
    }

    // Soft Delete 처리
    const anonymizedNickname = `탈퇴회원_${session.userId.slice(0, 8)}`;
    
    // 기본 업데이트 데이터 (필수 필드만)
    const baseUpdateData = {
      deleted_at: new Date().toISOString(),
      nickname: anonymizedNickname,
    };

    // 추가 필드들 (컬럼이 존재하지 않아도 에러 나지 않도록 별도 처리)
    const additionalFields: Record<string, unknown> = {
      email: null,
      profile_image: null,
      bio: null,
      region: null,
    };

    // 첫 번째 시도: 소셜 ID 포함 업데이트
    let updateSuccess = false;
    try {
      const { error: fullUpdateError } = await supabase
        .from('users')
        .update({
          ...baseUpdateData,
          ...additionalFields,
          kakao_id: null,
          google_id: null,
        })
        .eq('id', session.userId);

      if (!fullUpdateError) {
        updateSuccess = true;
      } else {
        console.warn('Full update failed, trying without social IDs:', fullUpdateError.message);
      }
    } catch (e) {
      console.warn('Full update threw exception:', e);
    }

    // 두 번째 시도: 소셜 ID 제외
    if (!updateSuccess) {
      try {
        const { error: partialUpdateError } = await supabase
          .from('users')
          .update({
            ...baseUpdateData,
            ...additionalFields,
          })
          .eq('id', session.userId);

        if (!partialUpdateError) {
          updateSuccess = true;
        } else {
          console.warn('Partial update failed, trying minimal:', partialUpdateError.message);
        }
      } catch (e) {
        console.warn('Partial update threw exception:', e);
      }
    }

    // 세 번째 시도: 최소 업데이트
    if (!updateSuccess) {
      const { error: minimalUpdateError } = await supabase
        .from('users')
        .update(baseUpdateData)
        .eq('id', session.userId);

      if (minimalUpdateError) {
        console.error('All update attempts failed:', minimalUpdateError);
        return NextResponse.json({ 
          error: '회원 탈퇴 처리에 실패했습니다. 관리자에게 문의해주세요.' 
        }, { status: 500 });
      }
    }

    console.log(`User soft-deleted: ${session.userId} (was: ${existingUser.nickname})`);

    const response = NextResponse.json({
      success: true,
      message: '회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.'
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
