'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/useAuth';
import { ArrowLeft, Trophy, Target, TrendingUp, Calendar, ChevronRight, Medal, Flame, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
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
  const { user, isAuthenticated, isLoading: authLoading, logout, refresh } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentDebates, setRecentDebates] = useState<DebateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileForm, setProfileForm] = useState({
    nickname: '',
    region: '',
    bio: '',
    gender: '',
    birthDate: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const [profileRes, statsRes, historyRes] = await Promise.all([
          fetch('/api/users/me', { credentials: 'include', cache: 'no-store' }),
          fetch('/api/users/me/stats', { credentials: 'include' }),
          fetch('/api/users/me/history?limit=5', { credentials: 'include' }),
        ]);

        const [profileData, statsData, historyData] = await Promise.all([
          profileRes.json(),
          statsRes.json(),
          historyRes.json(),
        ]);

        if (profileRes.ok && profileData.user) {
          setProfileForm({
            nickname: profileData.user.nickname || '',
            region: profileData.user.region || '',
            bio: profileData.user.bio || '',
            gender: profileData.user.gender || '',
            birthDate: profileData.user.birthDate || '',
          });
        } else if (user) {
          setProfileForm((prev) => ({
            ...prev,
            nickname: user.nickname,
          }));
        }

        if (statsData.stats) {
          setStats(statsData.stats);
        }

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
  }, [isAuthenticated, authLoading, router, user]);

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

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const trimmedNickname = profileForm.nickname.trim();
    const trimmedRegion = profileForm.region.trim();
    const trimmedBio = profileForm.bio.trim();

    if (!trimmedNickname) {
      setProfileError('닉네임을 입력해주세요.');
      return;
    }

    if (trimmedNickname.length < 2 || trimmedNickname.length > 20) {
      setProfileError('닉네임은 2~20자여야 합니다.');
      return;
    }

    setProfileSaving(true);
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nickname: trimmedNickname,
          region: trimmedRegion || null,
          bio: trimmedBio || null,
          gender: profileForm.gender || null,
          birthDate: profileForm.birthDate || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setProfileError(data.error || '정보 수정에 실패했습니다.');
        return;
      }

      setProfileForm((prev) => ({
        ...prev,
        nickname: trimmedNickname,
        region: trimmedRegion,
        bio: trimmedBio,
      }));

      if (user && trimmedNickname !== user.nickname) {
        await refresh();
      }

      setProfileSuccess('정보가 저장되었습니다.');
    } catch (error) {
      console.error('Profile update error:', error);
      setProfileError('서버 오류가 발생했습니다.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== '탈퇴') {
      setDeleteError('확인 문구를 정확히 입력해주세요.');
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const response = await fetch('/api/users/me', {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok) {
        setDeleteError(data.error || '회원 탈퇴에 실패했습니다.');
        return;
      }

      window.location.href = '/';
    } catch (error) {
      console.error('Delete account error:', error);
      setDeleteError('서버 오류가 발생했습니다.');
    } finally {
      setDeleteLoading(false);
    }
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

        {/* 프로필 수정 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
        >
          <h3 className="font-bold mb-4">내 정보 수정</h3>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label htmlFor="profile-nickname" className="block text-sm font-medium text-white/80 mb-2">
                닉네임
              </label>
              <input
                id="profile-nickname"
                type="text"
                value={profileForm.nickname}
                onChange={(e) => {
                  setProfileForm((prev) => ({ ...prev, nickname: e.target.value }));
                  setProfileError(null);
                  setProfileSuccess(null);
                }}
                maxLength={20}
                className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
              <p className="mt-2 text-xs text-muted-foreground">2~20자, 중복 불가</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-gender" className="block text-sm font-medium text-white/80 mb-2">
                  성별 (선택)
                </label>
                <select
                  id="profile-gender"
                  value={profileForm.gender}
                  onChange={(e) => {
                    setProfileForm((prev) => ({ ...prev, gender: e.target.value }));
                    setProfileError(null);
                    setProfileSuccess(null);
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
                <label htmlFor="profile-birth-date" className="block text-sm font-medium text-white/80 mb-2">
                  생년월일 (선택)
                </label>
                <input
                  id="profile-birth-date"
                  type="date"
                  value={profileForm.birthDate}
                  onChange={(e) => {
                    setProfileForm((prev) => ({ ...prev, birthDate: e.target.value }));
                    setProfileError(null);
                    setProfileSuccess(null);
                  }}
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile-region" className="block text-sm font-medium text-white/80 mb-2">
                관심 지역 (선택)
              </label>
              <input
                id="profile-region"
                type="text"
                value={profileForm.region}
                onChange={(e) => {
                  setProfileForm((prev) => ({ ...prev, region: e.target.value }));
                  setProfileError(null);
                  setProfileSuccess(null);
                }}
                placeholder="예: 서울, 부산, 경기"
                className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
            </div>

            <div>
              <label htmlFor="profile-bio" className="block text-sm font-medium text-white/80 mb-2">
                소개글 (선택)
              </label>
              <textarea
                id="profile-bio"
                value={profileForm.bio}
                onChange={(e) => {
                  setProfileForm((prev) => ({ ...prev, bio: e.target.value }));
                  setProfileError(null);
                  setProfileSuccess(null);
                }}
                placeholder="짧은 자기소개를 입력해주세요"
                className="w-full min-h-[120px] p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
            </div>

            {profileError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                {profileSuccess}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={profileSaving} className="min-w-[120px]">
                {profileSaving ? '저장 중...' : '저장하기'}
              </Button>
              <span className="text-xs text-muted-foreground">
                저장 후 즉시 프로필에 반영됩니다
              </span>
            </div>
          </form>
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

        {/* 회원 탈퇴 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 bg-white/5 border border-red-500/20 rounded-2xl p-6"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-1" />
              <div>
                <h3 className="font-bold text-red-400 mb-1">회원 탈퇴</h3>
                <p className="text-sm text-muted-foreground">
                  탈퇴 시 계정은 비활성화되며, 이후 일정 기간 후 영구 삭제됩니다.
                </p>
              </div>
            </div>
            <Dialog
              open={deleteOpen}
              onOpenChange={(open) => {
                setDeleteOpen(open);
                if (!open) {
                  setDeleteConfirm('');
                  setDeleteError(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="destructive">회원 탈퇴</Button>
              </DialogTrigger>
              <DialogContent className="bg-[#1a1a1f] border border-white/10">
                <DialogHeader>
                  <DialogTitle>회원 탈퇴</DialogTitle>
                  <DialogDescription>
                    탈퇴하면 복구가 어려울 수 있습니다. 계속하려면 아래에 확인 문구를 입력하세요.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    확인 문구: <span className="text-white">탈퇴</span>
                  </p>
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => {
                      setDeleteConfirm(e.target.value);
                      setDeleteError(null);
                    }}
                    placeholder="탈퇴"
                    className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                  />
                  {deleteError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                      {deleteError}
                    </div>
                  )}
                </div>
                <DialogFooter className="mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteOpen(false)}
                    disabled={deleteLoading}
                  >
                    취소
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleteLoading || deleteConfirm !== '탈퇴'}
                  >
                    {deleteLoading ? '처리 중...' : '탈퇴 진행'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
