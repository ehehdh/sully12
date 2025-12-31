'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

// 사용자 타입 정의
export interface User {
  id: string;
  kakaoId?: string;
  googleId?: string;
  nickname: string;
  profileImage: string | null;
  email: string | null;
  role: 'user' | 'moderator' | 'admin';
  createdAt: string;
  isOnboardingComplete: boolean;
}

// 인증 상태 타입
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

// 인증 컨텍스트 타입
interface AuthContextType extends AuthState {
  loginWithKakao: () => void;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

// 기본값
const defaultAuthState: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
};

// 컨텍스트 생성
const AuthContext = createContext<AuthContextType | null>(null);

// Provider 컴포넌트
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(defaultAuthState);

  // 사용자 정보 가져오기
  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store',
      });

      const data = await response.json();

      // 차단된 계정 처리 (403 응답)
      if (response.status === 403) {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: data.error || '계정이 차단되었습니다.',
        });
        // 로그인 페이지로 리다이렉트
        window.location.href = '/login?error=account_banned';
        return;
      }

      if (data.user) {
        // 정지된 계정 경고 처리
        const isSuspended = data.user.isSuspended || data.warning === 'Account is currently suspended';
        
        setState({
          user: data.user,
          isLoading: false,
          isAuthenticated: true,
          error: isSuspended ? '계정이 일시 정지되었습니다.' : null,
        });
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: data.error || null,
        });
      }
    } catch (error) {
      console.error('Auth fetch error:', error);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: 'Failed to fetch user',
      });
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // 카카오 로그인
  const loginWithKakao = useCallback(() => {
    window.location.href = '/api/auth/kakao';
  }, []);

  // 구글 로그인
  const loginWithGoogle = useCallback(() => {
    window.location.href = '/api/auth/google';
  }, []);

  // 로그아웃
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
      
      // 홈으로 리다이렉트
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  // 세션 새로고침
  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    await fetchUser();
  }, [fetchUser]);

  const value: AuthContextType = {
    ...state,
    loginWithKakao,
    loginWithGoogle,
    logout,
    refresh,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// 커스텀 훅
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// 로그인 필수 페이지용 HOC
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: { redirectTo?: string }
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    
    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        window.location.href = options?.redirectTo || '/login';
      }
    }, [isAuthenticated, isLoading]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
}
