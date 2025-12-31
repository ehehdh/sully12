'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { ArrowLeft } from 'lucide-react';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get('error');
  const errorMsg = searchParams.get('msg');
  const provider = searchParams.get('provider');
  const until = searchParams.get('until');
  const { isAuthenticated, isLoading } = useAuth();
  
  // 로그인 진행 중 상태
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 이미 로그인되어 있으면 홈으로 리다이렉트
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // 로그인 성공한 경우 - 에러 파라미터 있어도 무시하고 홈으로
      window.location.href = '/';
    }
  }, [isAuthenticated, isLoading]);

  // 에러가 있지만 로그인이 가능한 경우 (DB에서 차단 해제된 경우)
  // 새로고침 없이 에러 표시하되, 로그인 시도 가능하게
  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case 'kakao_auth_failed':
        return '카카오 로그인이 취소되었거나 실패했습니다.';
      case 'google_auth_failed':
        return '구글 로그인이 취소되었거나 실패했습니다.';
      case 'token_failed':
        return '인증 토큰을 받아오는데 실패했습니다.';
      case 'user_info_failed':
        return '사용자 정보를 가져오는데 실패했습니다.';
      case 'db_error':
        return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      case 'no_code':
        return '인증 코드가 없습니다.';
      case 'config_error':
        return '서버 설정에 문제가 있습니다.';
      case 'email_exists':
        return `이미 ${provider || '다른 방법'}으로 가입된 이메일입니다. ${provider || '해당 방법'}으로 로그인해주세요.`;
      case 'account_banned':
        return '🚫 이 계정은 서비스 이용이 영구 제한되었습니다. 관리자가 차단을 해제했다면 다시 로그인해보세요.';
      case 'account_suspended':
        if (until) {
          try {
            const suspendedUntil = new Date(until).toLocaleString('ko-KR');
            return `⚠️ 이 계정은 ${suspendedUntil}까지 일시 정지되었습니다.`;
          } catch {
            return '⚠️ 이 계정은 현재 일시 정지 상태입니다.';
          }
        }
        return '⚠️ 이 계정은 현재 일시 정지 상태입니다.';
      case 'account_deleted':
        return '❌ 탈퇴한 계정입니다. 새로 가입하시려면 로그인 버튼을 클릭하세요.';
      case 'invalid_state':
        return '보안 검증에 실패했습니다. 다시 시도해주세요.';
      case 'email_not_verified':
        return '이메일 인증이 필요합니다. 이메일을 확인해주세요.';
      default:
        return null;
    }
  };

  const errorMessage = getErrorMessage(error);

  // 로그인 버튼 클릭 핸들러 - URL에서 에러 파라미터 제거 후 로그인 진행
  const handleLogin = (provider: 'google' | 'kakao') => {
    setIsLoggingIn(true);
    
    // URL 에러 파라미터 제거 (히스토리에서도 정리)
    if (error) {
      window.history.replaceState({}, '', '/login');
    }
    
    // 로그인 페이지로 이동
    window.location.href = `/api/auth/${provider}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -z-10 animate-pulse" />

      {/* Back Button */}
      <Link 
        href="/" 
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>홈으로</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Login Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <motion.h1
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 via-white to-purple-400 bg-clip-text text-transparent mb-3"
            >
              안토론
            </motion.h1>
            <p className="text-muted-foreground">
              로그인하고 토론에 참여하세요
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && !isLoggingIn && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center"
            >
              <p>{errorMessage}</p>
              {errorMsg && (
                <p className="mt-2 text-xs text-red-400/70 break-all">
                  상세: {errorMsg}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                💡 문제가 해결되었다면 아래 버튼으로 다시 로그인하세요
              </p>
            </motion.div>
          )}

          {/* Social Login Buttons */}
          <div className="space-y-3">
            {/* Kakao Login Button */}
            <motion.button
              onClick={() => handleLogin('kakao')}
              disabled={isLoggingIn}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full h-14 px-8 text-lg flex items-center justify-center gap-3 bg-[#FEE500] hover:bg-[#FDD800] text-[#191919] font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {isLoggingIn ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
              ) : (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path
                      fill="#191919"
                      d="M12 3C6.477 3 2 6.463 2 10.691c0 2.676 1.785 5.037 4.475 6.376-.143.508-.919 3.274-.949 3.489 0 0-.019.161.085.222.104.061.226.014.226.014.299-.042 3.461-2.265 4.009-2.648.702.1 1.434.152 2.154.152 5.523 0 10-3.463 10-7.691S17.523 3 12 3z"
                    />
                  </svg>
                  <span>카카오로 시작하기</span>
                </>
              )}
            </motion.button>

            {/* Google Login Button */}
            <motion.button
              onClick={() => handleLogin('google')}
              disabled={isLoggingIn}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full h-14 px-8 text-lg flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl border border-gray-200 disabled:opacity-50"
            >
              {isLoggingIn ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700"></div>
              ) : (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Google로 시작하기</span>
                </>
              )}
            </motion.button>
          </div>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-4 bg-background text-muted-foreground">
                간편하게 시작하세요
              </span>
            </div>
          </div>

          {/* Additional Info */}
          <div className="text-center text-xs text-muted-foreground/70 space-y-2">
            <p>
              로그인 시{' '}
              <Link href="/terms" className="text-white/80 underline">
                이용약관
              </Link>
              {' '}및{' '}
              <Link href="/privacy" className="text-white/80 underline">
                개인정보처리방침
              </Link>
              에 동의하게 됩니다.
            </p>
          </div>
        </div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 grid grid-cols-3 gap-4 text-center"
        >
          <div className="p-4 bg-white/5 rounded-xl border border-white/5">
            <div className="text-2xl mb-2">🎯</div>
            <div className="text-xs text-muted-foreground">실시간 토론</div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/5">
            <div className="text-2xl mb-2">🤖</div>
            <div className="text-xs text-muted-foreground">AI 사회자</div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/5">
            <div className="text-2xl mb-2">📊</div>
            <div className="text-xs text-muted-foreground">논리 점수</div>
          </div>
        </motion.div>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
