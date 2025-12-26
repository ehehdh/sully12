'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, User, Shield, Ban, AlertTriangle, Clock,
  Trophy, MessageSquare, Flag, History, Check, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/useAuth';

interface UserDetail {
  id: string;
  nickname: string;
  email: string | null;
  profile_image: string | null;
  role: 'user' | 'moderator' | 'admin';
  is_banned: boolean;
  ban_reason: string | null;
  is_suspended: boolean;
  suspended_until: string | null;
  suspended_reason: string | null;
  warning_count: number;
  created_at: string;
  last_login_at: string | null;
}

interface Sanction {
  id: string;
  sanction_type: string;
  duration_days: number | null;
  reason: string;
  created_at: string;
}

interface Report {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter_name?: string;
  reported_user_name?: string;
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentAdmin } = useAuth();
  const userId = params.id as string;
  
  const [user, setUser] = useState<UserDetail | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [receivedReports, setReceivedReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // 제재 모달
  const [showSanctionModal, setShowSanctionModal] = useState(false);
  const [sanctionType, setSanctionType] = useState('warning');
  const [sanctionDays, setSanctionDays] = useState(1);
  const [sanctionReason, setSanctionReason] = useState('');

  useEffect(() => {
    const fetchUserDetail = async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}`);
        const data = await res.json();
        
        if (data.user) {
          setUser(data.user);
          setStats(data.stats);
          setSanctions(data.sanctions || []);
          setReceivedReports(data.reports?.received || []);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUserDetail();
    }
  }, [userId]);

  const handleRoleChange = async (newRole: string) => {
    if (!confirm(`역할을 ${newRole === 'admin' ? '관리자' : newRole === 'moderator' ? '중재자' : '사용자'}로 변경하시겠습니까?`)) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_role',
          role: newRole
        })
      });
      
      if (res.ok) {
        setUser(prev => prev ? { ...prev, role: newRole as any } : null);
        alert('역할이 변경되었습니다.');
      }
    } catch (error) {
      console.error('Role change failed:', error);
      alert('역할 변경에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSanction = async () => {
    if (!sanctionReason.trim()) {
      alert('사유를 입력해주세요.');
      return;
    }
    
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sanction',
          sanctionType,
          durationDays: sanctionType === 'suspend' ? sanctionDays : null,
          reason: sanctionReason,
          adminId: currentAdmin?.id
        })
      });
      
      if (res.ok) {
        alert('제재가 적용되었습니다.');
        setShowSanctionModal(false);
        setSanctionReason('');
        // 새로고침
        router.refresh();
        window.location.reload();
      }
    } catch (error) {
      console.error('Sanction failed:', error);
      alert('제재 적용에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      offensive_language: '욕설/비하',
      spam: '스팸/도배',
      harassment: '괴롭힘',
      inappropriate_content: '부적절한 내용',
      cheating: '부정행위',
      other: '기타'
    };
    return labels[reason] || reason;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground mb-4">사용자를 찾을 수 없습니다.</p>
        <Link href="/admin/users">
          <Button>목록으로</Button>
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center mb-8">
          <Link href="/admin/users">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              사용자 목록
            </Button>
          </Link>
        </div>

        {/* 사용자 프로필 카드 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-3xl p-6 mb-6"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {user.profile_image ? (
                <Image
                  src={user.profile_image}
                  alt={user.nickname}
                  width={80}
                  height={80}
                  className="rounded-full border-2 border-white/20"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-3xl font-bold">
                  <User className="w-10 h-10" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{user.nickname}</h1>
                {user.email && <p className="text-muted-foreground">{user.email}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    user.role === 'admin' && 'bg-red-500/20 text-red-400',
                    user.role === 'moderator' && 'bg-purple-500/20 text-purple-400',
                    user.role === 'user' && 'bg-blue-500/20 text-blue-400'
                  )}>
                    {user.role === 'admin' ? '관리자' : 
                     user.role === 'moderator' ? '중재자' : '사용자'}
                  </span>
                  {user.is_banned && (
                    <span className="px-3 py-1 rounded-full text-sm bg-red-500/20 text-red-400 flex items-center gap-1">
                      <Ban className="w-3 h-3" /> 영구차단
                    </span>
                  )}
                  {user.is_suspended && (
                    <span className="px-3 py-1 rounded-full text-sm bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 정지중
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* 액션 버튼 */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSanctionModal(true)}
              >
                제재
              </Button>
            </div>
          </div>

          {/* 상태 정보 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
            <div>
              <p className="text-sm text-muted-foreground">가입일</p>
              <p className="font-medium">{formatDate(user.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">마지막 로그인</p>
              <p className="font-medium">{formatDate(user.last_login_at)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">경고 횟수</p>
              <p className={cn("font-medium", user.warning_count > 0 && 'text-yellow-400')}>
                {user.warning_count}회
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">정지 해제일</p>
              <p className="font-medium">
                {user.is_suspended && user.suspended_until 
                  ? formatDate(user.suspended_until) 
                  : '-'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* 역할 변경 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
        >
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            역할 변경
          </h3>
          <div className="flex gap-2">
            <Button
              variant={user.role === 'user' ? 'default' : 'outline'}
              onClick={() => handleRoleChange('user')}
              disabled={actionLoading || user.role === 'user'}
            >
              사용자
            </Button>
            <Button
              variant={user.role === 'moderator' ? 'default' : 'outline'}
              onClick={() => handleRoleChange('moderator')}
              disabled={actionLoading || user.role === 'moderator'}
              className={user.role === 'moderator' ? 'bg-purple-600' : ''}
            >
              중재자
            </Button>
            <Button
              variant={user.role === 'admin' ? 'default' : 'outline'}
              onClick={() => handleRoleChange('admin')}
              disabled={actionLoading || user.role === 'admin'}
              className={user.role === 'admin' ? 'bg-red-600' : ''}
            >
              관리자
            </Button>
          </div>
        </motion.div>

        {/* 통계 */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
          >
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              토론 통계
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-white/5 rounded-xl">
                <p className="text-2xl font-bold">{stats.total_debates}</p>
                <p className="text-xs text-muted-foreground">총 토론</p>
              </div>
              <div className="text-center p-3 bg-green-500/10 rounded-xl">
                <p className="text-2xl font-bold text-green-400">{stats.wins}</p>
                <p className="text-xs text-muted-foreground">승리</p>
              </div>
              <div className="text-center p-3 bg-red-500/10 rounded-xl">
                <p className="text-2xl font-bold text-red-400">{stats.losses}</p>
                <p className="text-xs text-muted-foreground">패배</p>
              </div>
              <div className="text-center p-3 bg-blue-500/10 rounded-xl">
                <p className="text-2xl font-bold text-blue-400">{stats.win_rate?.toFixed(1) || 0}%</p>
                <p className="text-xs text-muted-foreground">승률</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* 제재 이력 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
        >
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-orange-400" />
            제재 이력
          </h3>
          {sanctions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">제재 이력이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {sanctions.map((sanction) => (
                <div key={sanction.id} className="p-3 bg-white/5 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-medium",
                      sanction.sanction_type === 'warning' && 'bg-yellow-500/20 text-yellow-400',
                      sanction.sanction_type === 'suspend' && 'bg-orange-500/20 text-orange-400',
                      sanction.sanction_type === 'ban' && 'bg-red-500/20 text-red-400',
                      sanction.sanction_type === 'unban' && 'bg-green-500/20 text-green-400'
                    )}>
                      {sanction.sanction_type === 'warning' ? '경고' :
                       sanction.sanction_type === 'suspend' ? `정지 ${sanction.duration_days}일` :
                       sanction.sanction_type === 'ban' ? '영구차단' : '차단해제'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(sanction.created_at)}
                    </span>
                  </div>
                  {sanction.reason && (
                    <p className="text-sm text-muted-foreground mt-2">{sanction.reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* 받은 신고 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6"
        >
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-400" />
            받은 신고
          </h3>
          {receivedReports.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">받은 신고가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {receivedReports.map((report) => (
                <div key={report.id} className="p-3 bg-white/5 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
                      {getReasonLabel(report.reason)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-1 rounded text-xs",
                        report.status === 'pending' && 'bg-yellow-500/20 text-yellow-400',
                        report.status === 'resolved' && 'bg-green-500/20 text-green-400',
                        report.status === 'dismissed' && 'bg-gray-500/20 text-gray-400'
                      )}>
                        {report.status === 'pending' ? '대기중' :
                         report.status === 'resolved' ? '처리완료' : '기각'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(report.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* 제재 모달 */}
      {showSanctionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 max-w-md w-full"
          >
            <h3 className="text-xl font-bold mb-4">제재 적용</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">제재 유형</label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={sanctionType === 'warning' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSanctionType('warning')}
                  >
                    경고
                  </Button>
                  <Button
                    variant={sanctionType === 'suspend' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSanctionType('suspend')}
                    className={sanctionType === 'suspend' ? 'bg-orange-600' : ''}
                  >
                    정지
                  </Button>
                  <Button
                    variant={sanctionType === 'ban' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSanctionType('ban')}
                    className={sanctionType === 'ban' ? 'bg-red-600' : ''}
                  >
                    영구차단
                  </Button>
                  <Button
                    variant={sanctionType === 'unban' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSanctionType('unban')}
                    className={sanctionType === 'unban' ? 'bg-green-600' : ''}
                  >
                    차단해제
                  </Button>
                </div>
              </div>
              
              {sanctionType === 'suspend' && (
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">정지 기간</label>
                  <select
                    value={sanctionDays}
                    onChange={(e) => setSanctionDays(Number(e.target.value))}
                    className="w-full p-2 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <option value={1}>1일</option>
                    <option value={3}>3일</option>
                    <option value={7}>7일</option>
                    <option value={14}>14일</option>
                    <option value={30}>30일</option>
                  </select>
                </div>
              )}
              
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">사유</label>
                <textarea
                  value={sanctionReason}
                  onChange={(e) => setSanctionReason(e.target.value)}
                  placeholder="제재 사유를 입력하세요..."
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-lg min-h-[100px]"
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowSanctionModal(false)}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                onClick={handleSanction}
                disabled={actionLoading}
                className={cn(
                  "flex-1",
                  sanctionType === 'ban' && 'bg-red-600 hover:bg-red-700',
                  sanctionType === 'unban' && 'bg-green-600 hover:bg-green-700'
                )}
              >
                {actionLoading ? '처리 중...' : '적용'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
