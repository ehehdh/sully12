'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { KakaoLoginButton } from '@/components/auth/KakaoLoginButton';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { useAuth } from '@/lib/useAuth';
import { ArrowLeft } from 'lucide-react';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const errorMsg = searchParams.get('msg'); // 상세 에러 메시지
  const provider = searchParams.get('provider'); // 기존 가입 방법
  const { isAuthenticated, isLoading } = useAuth();

  // 이미 로그인되어 있으면 홈으로 리다이렉트
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      window.location.href = '/';
    }
  }, [isAuthenticated, isLoading]);

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
      default:
        return null;
    }
  };

  const errorMessage = getErrorMessage(error);

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
          {errorMessage && (
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
            </motion.div>
          )}

          {/* Social Login Buttons */}
          <div className="space-y-3">
            <KakaoLoginButton fullWidth size="lg" />
            <GoogleLoginButton fullWidth size="lg" />
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
