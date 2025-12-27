'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/useAuth';
import { User, Sparkles, ArrowRight, Check } from 'lucide-react';

export default function OnboardingPage() {
  const { user, isLoading, isAuthenticated, refresh } = useAuth();
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // 사용자 닉네임 미리 채우기
  useEffect(() => {
    if (user?.nickname) {
      setNickname(user.nickname);
    }
  }, [user]);

  // 비로그인 시 로그인 페이지로
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/login';
    }
  }, [isLoading, isAuthenticated]);

  // 이미 온보딩 완료된 사용자는 홈으로
  useEffect(() => {
    if (user && 'isOnboardingComplete' in user && user.isOnboardingComplete) {
      window.location.href = '/';
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }

    if (nickname.length < 2) {
      setError('닉네임은 2자 이상이어야 합니다.');
      return;
    }

    if (nickname.length > 20) {
      setError('닉네임은 20자 이하여야 합니다.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nickname: nickname.trim() }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '저장에 실패했습니다.');
        return;
      }

      // 성공
      setIsComplete(true);
      
      // 세션 새로고침 후 홈으로 이동
      await refresh();
      
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);

    } catch (err) {
      console.error('Onboarding error:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 mx-auto mb-6 bg-green-500 rounded-full flex items-center justify-center"
          >
            <Check className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white mb-2">환영합니다, {nickname}님! 🎉</h1>
          <p className="text-muted-foreground">잠시 후 메인 페이지로 이동합니다...</p>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -z-10 animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center"
            >
              <Sparkles className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-2">
              거의 다 왔어요! 🎯
            </h1>
            <p className="text-muted-foreground">
              토론에서 사용할 닉네임을 설정해주세요
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nickname Input */}
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-white/80 mb-2">
                닉네임
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  id="nickname"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    setError(null);
                  }}
                  placeholder="예: 토론왕_2024"
                  maxLength={20}
                  className="w-full h-14 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                2~20자, 다른 사용자에게 표시됩니다
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center"
              >
                {error}
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isSubmitting || !nickname.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                w-full h-14 flex items-center justify-center gap-2
                bg-gradient-to-r from-blue-500 to-purple-600
                hover:from-blue-600 hover:to-purple-700
                text-white font-semibold rounded-xl
                transition-all duration-200
                shadow-lg hover:shadow-xl
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>
                  <span>시작하기</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </form>

          {/* Info */}
          <div className="mt-6 text-center text-xs text-muted-foreground/70">
            <p>닉네임은 나중에 마이페이지에서 변경할 수 있어요</p>
          </div>
        </div>

        {/* Features Preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center"
        >
          <p className="text-sm text-muted-foreground mb-4">
            안토론에서 할 수 있는 것들
          </p>
          <div className="flex justify-center gap-4">
            <div className="px-4 py-2 bg-white/5 rounded-full text-xs text-white/70">
              🎯 실시간 토론
            </div>
            <div className="px-4 py-2 bg-white/5 rounded-full text-xs text-white/70">
              🤖 AI 사회자
            </div>
            <div className="px-4 py-2 bg-white/5 rounded-full text-xs text-white/70">
              📊 논리 점수
            </div>
          </div>
        </motion.div>
      </motion.div>
    </main>
  );
}
