'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/useAuth';
import { ArrowLeft, Trophy, Target, TrendingUp, Calendar, ChevronRight, Medal, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface UserStats {
  total_debates: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  pro_debates: number;
  pro_wins: number;
  con_debates: number;
  con_wins: number;
  avg_score: number;
  highest_score: number;
  current_streak: number;
  best_win_streak: number;
  last_debate_at: string | null;
}

interface DebateRecord {
  id: string;
  topic_title: string;
  mySide: 'pro' | 'con';
  myScore: number;
  opponentScore: number;
  opponentName: string;
  result: 'win' | 'loss' | 'draw';
  ended_at: string;
  duration_seconds: number;
}

export default function MyPage() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentDebates, setRecentDebates] = useState<DebateRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        // 통계 가져오기
        const statsRes = await fetch('/api/users/me/stats');
        const statsData = await statsRes.json();
        if (statsData.stats) {
          setStats(statsData.stats);
        }

        // 최근 토론 기록 가져오기
        const historyRes = await fetch('/api/users/me/history?limit=5');
        const historyData = await historyRes.json();
        if (historyData.records) {
          setRecentDebates(historyData.records);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" />
          <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce delay-75" />
          <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce delay-150" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      {/* 배경 효과 */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl -z-10" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl -z-10" />

      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              홈으로
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">마이페이지</h1>
          <Button variant="ghost" size="sm" onClick={logout} className="text-red-400 hover:text-red-300">
            로그아웃
          </Button>
        </div>

        {/* 프로필 카드 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 mb-6"
        >
          <div className="flex items-center gap-4">
            {user.profileImage ? (
              <Image
                src={user.profileImage}
                alt={user.nickname}
                width={80}
                height={80}
                className="rounded-full border-2 border-white/20"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-3xl font-bold">
                {user.nickname.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold">{user.nickname}</h2>
              {user.email && (
                <p className="text-sm text-muted-foreground">{user.email}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                가입일: {new Date(user.createdAt).toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>
        </motion.div>

        {/* 통계 카드들 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* 전적 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center"
          >
            <Trophy className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
            <p className="text-2xl font-bold">{stats?.total_debates || 0}전</p>
            <p className="text-xs text-muted-foreground">
              {stats?.wins || 0}승 {stats?.losses || 0}패 {stats?.draws || 0}무
            </p>
          </motion.div>

          {/* 승률 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center"
          >
            <Target className="w-6 h-6 mx-auto mb-2 text-green-400" />
            <p className="text-2xl font-bold">{(stats?.win_rate || 0).toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">승률</p>
          </motion.div>

          {/* 평균 점수 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center"
          >
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-blue-400" />
            <p className="text-2xl font-bold">{(stats?.avg_score || 50).toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">평균 점수</p>
          </motion.div>

          {/* 연승 기록 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center"
          >
            <Flame className="w-6 h-6 mx-auto mb-2 text-orange-400" />
            <p className="text-2xl font-bold">{stats?.best_win_streak || 0}</p>
            <p className="text-xs text-muted-foreground">최고 연승</p>
          </motion.div>
        </div>

        {/* 포지션별 통계 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
        >
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Medal className="w-5 h-5 text-purple-400" />
            포지션별 통계
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <p className="text-blue-400 font-medium mb-1">찬성 포지션</p>
              <p className="text-xl font-bold">{stats?.pro_debates || 0}전 {stats?.pro_wins || 0}승</p>
              <p className="text-xs text-muted-foreground">
                승률 {stats?.pro_debates ? ((stats.pro_wins / stats.pro_debates) * 100).toFixed(0) : 0}%
              </p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-red-400 font-medium mb-1">반대 포지션</p>
              <p className="text-xl font-bold">{stats?.con_debates || 0}전 {stats?.con_wins || 0}승</p>
              <p className="text-xs text-muted-foreground">
                승률 {stats?.con_debates ? ((stats.con_wins / stats.con_debates) * 100).toFixed(0) : 0}%
              </p>
            </div>
          </div>
        </motion.div>

        {/* 최근 토론 기록 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              최근 토론 기록
            </h3>
            <Link href="/mypage/history">
              <Button variant="ghost" size="sm" className="text-cyan-400">
                전체보기 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {recentDebates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>아직 토론 기록이 없습니다.</p>
              <Link href="/">
                <Button className="mt-4" size="sm">첫 토론 시작하기</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDebates.map((debate) => (
                <Link key={debate.id} href={`/mypage/history/${debate.id}`}>
                  <div className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-4 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{debate.topic_title}</p>
                        <p className="text-sm text-muted-foreground">
                          vs {debate.opponentName} · {formatDate(debate.ended_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          debate.result === 'win' 
                            ? 'bg-green-500/20 text-green-400' 
                            : debate.result === 'loss' 
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {debate.result === 'win' ? '승리' : debate.result === 'loss' ? '패배' : '무승부'}
                        </span>
                        <p className="text-sm text-muted-foreground mt-1">
                          {debate.myScore} : {debate.opponentScore}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
