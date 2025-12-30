'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/useAuth';
import { User, Sparkles, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';

export default function OnboardingPage() {
  const { user, isLoading, isAuthenticated, refresh } = useAuth();
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [region, setRegion] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedMarketing, setAgreedMarketing] = useState(false);
  const [isUnder14Confirmed, setIsUnder14Confirmed] = useState(false);

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

    if (!agreedTerms || !agreedPrivacy || !isUnder14Confirmed) {
      setError('필수 약관 및 만 14세 이상 확인에 동의해야 합니다.');
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
        body: JSON.stringify({
          nickname: nickname.trim(),
          gender: gender || null,
          birthDate: birthDate || null,
          region: region.trim() || null,
          agreedTerms,
          agreedPrivacy,
          agreedMarketing,
          isUnder14Confirmed,
        }),
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

            {/* Additional Profile Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-white/80 mb-2">
                  성별 (선택)
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => {
                    setGender(e.target.value);
                    setError(null);
                  }}
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                >
                  <option value="">선택 안함</option>
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                  <option value="other">기타</option>
                  <option value="private">비공개</option>
                </select>
              </div>
              <div>
                <label htmlFor="birthDate" className="block text-sm font-medium text-white/80 mb-2">
                  생년월일 (선택)
                </label>
                <input
                  type="date"
                  id="birthDate"
                  value={birthDate}
                  onChange={(e) => {
                    setBirthDate(e.target.value);
                    setError(null);
                  }}
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="region" className="block text-sm font-medium text-white/80 mb-2">
                관심 지역 (선택)
              </label>
              <input
                type="text"
                id="region"
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setError(null);
                }}
                placeholder="예: 서울, 부산, 경기"
                className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
            </div>

            {/* Agreements */}
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-medium text-white/80">약관 동의</p>
              <label className="flex items-start gap-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => {
                    setAgreedTerms(e.target.checked);
                    setError(null);
                  }}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10"
                />
                <span>
                  <Link href="/terms" className="text-white/80 underline">
                    이용약관
                  </Link>{' '}
                  동의 (필수)
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={agreedPrivacy}
                  onChange={(e) => {
                    setAgreedPrivacy(e.target.checked);
                    setError(null);
                  }}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10"
                />
                <span>
                  <Link href="/privacy" className="text-white/80 underline">
                    개인정보 처리방침
                  </Link>{' '}
                  동의 (필수)
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={agreedMarketing}
                  onChange={(e) => {
                    setAgreedMarketing(e.target.checked);
                    setError(null);
                  }}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10"
                />
                <span>마케팅 정보 수신 동의 (선택)</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isUnder14Confirmed}
                  onChange={(e) => {
                    setIsUnder14Confirmed(e.target.checked);
                    setError(null);
                  }}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10"
                />
                <span>만 14세 이상입니다 (필수)</span>
              </label>
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
              disabled={
                isSubmitting ||
                !nickname.trim() ||
                !agreedTerms ||
                !agreedPrivacy ||
                !isUnder14Confirmed
              }
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
