'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowLeft, Users, Search, ChevronLeft, ChevronRight, 
  Shield, Ban, AlertTriangle, User, MoreVertical 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface UserData {
  id: string;
  kakao_id: string;
  nickname: string;
  email: string | null;
  profile_image: string | null;
  role: 'user' | 'moderator' | 'admin';
  is_banned: boolean;
  is_suspended: boolean;
  suspended_until: string | null;
  warning_count: number;
  created_at: string;
  last_login_at: string | null;
  stats: {
    total_debates: number;
    wins: number;
    win_rate: number;
  } | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const limit = 15;

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter })
      });
      
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      
      if (data.users) {
        setUsers(data.users);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchUsers();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleUserAction = async (
    targetUser: UserData,
    action: 'ban' | 'unban' | 'suspend' | 'unsuspend'
  ) => {
    const actionLabelMap: Record<typeof action, string> = {
      ban: '차단',
      unban: '차단 해제',
      suspend: '정지',
      unsuspend: '정지 해제',
    };

    const label = actionLabelMap[action];
    if (!confirm(`${targetUser.nickname}님을 ${label}하시겠어요?`)) return;

    setActionLoadingId(targetUser.id);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUser.id,
          action,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || `${label} 처리에 실패했습니다.`);
        return;
      }

      await fetchUsers();
    } catch (error) {
      console.error('Admin action error:', error);
      alert(`${label} 처리 중 오류가 발생했습니다.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              관리자 메인
            </Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            사용자 관리
          </h1>
          <div className="w-24" />
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold">{total}</p>
            <p className="text-sm text-muted-foreground">전체 사용자</p>
          </div>
          <div 
            className={cn(
              "border rounded-xl p-4 text-center cursor-pointer transition-colors",
              statusFilter === '' ? 'bg-green-500/20 border-green-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'
            )}
            onClick={() => { setStatusFilter(''); setPage(0); }}
          >
            <p className="text-3xl font-bold text-green-400">
              {users.filter(u => !u.is_banned && !u.is_suspended).length}
            </p>
            <p className="text-sm text-muted-foreground">활성</p>
          </div>
          <div 
            className={cn(
              "border rounded-xl p-4 text-center cursor-pointer transition-colors",
              statusFilter === 'suspended' ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'
            )}
            onClick={() => { setStatusFilter('suspended'); setPage(0); }}
          >
            <p className="text-3xl font-bold text-yellow-400">
              {users.filter(u => u.is_suspended).length}
            </p>
            <p className="text-sm text-muted-foreground">정지</p>
          </div>
          <div 
            className={cn(
              "border rounded-xl p-4 text-center cursor-pointer transition-colors",
              statusFilter === 'banned' ? 'bg-red-500/20 border-red-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'
            )}
            onClick={() => { setStatusFilter('banned'); setPage(0); }}
          >
            <p className="text-3xl font-bold text-red-400">
              {users.filter(u => u.is_banned).length}
            </p>
            <p className="text-sm text-muted-foreground">차단</p>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="닉네임 또는 이메일로 검색..."
              className="pl-10 bg-white/5 border-white/10"
            />
          </form>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg"
          >
            <option value="">모든 역할</option>
            <option value="user">일반 사용자</option>
            <option value="moderator">중재자</option>
            <option value="admin">관리자</option>
          </select>
        </div>

        {/* 사용자 테이블 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              사용자가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="text-left p-4 font-medium">사용자</th>
                    <th className="text-center p-4 font-medium">역할</th>
                    <th className="text-center p-4 font-medium">상태</th>
                    <th className="text-center p-4 font-medium">경고</th>
                    <th className="text-center p-4 font-medium">토론</th>
                    <th className="text-center p-4 font-medium">가입일</th>
                    <th className="text-center p-4 font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {user.profile_image ? (
                            <Image
                              src={user.profile_image}
                              alt={user.nickname}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                              <User className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{user.nickname}</p>
                            <p className="text-xs text-muted-foreground">{user.email || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          user.role === 'admin' && 'bg-red-500/20 text-red-400',
                          user.role === 'moderator' && 'bg-purple-500/20 text-purple-400',
                          user.role === 'user' && 'bg-blue-500/20 text-blue-400'
                        )}>
                          {user.role === 'admin' ? '관리자' : 
                           user.role === 'moderator' ? '중재자' : '사용자'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {user.is_banned ? (
                          <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400 flex items-center justify-center gap-1">
                            <Ban className="w-3 h-3" />
                            차단
                          </span>
                        ) : user.is_suspended ? (
                          <span className="px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400 flex items-center justify-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            정지
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                            활성
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={cn(
                          "font-medium",
                          user.warning_count > 0 && 'text-yellow-400'
                        )}>
                          {user.warning_count}
                        </span>
                      </td>
                      <td className="p-4 text-center text-sm">
                        {user.stats ? (
                          <span>
                            {user.stats.total_debates}전 {user.stats.wins}승
                            <span className="text-muted-foreground ml-1">
                              ({user.stats.win_rate?.toFixed(0) || 0}%)
                            </span>
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-center text-sm text-muted-foreground">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleUserAction(
                                user,
                                user.is_suspended ? 'unsuspend' : 'suspend'
                              )
                            }
                            disabled={actionLoadingId === user.id}
                            className={cn(
                              user.is_suspended ? 'text-yellow-400' : 'text-muted-foreground'
                            )}
                            title={user.is_suspended ? '정지 해제' : '정지'}
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleUserAction(
                                user,
                                user.is_banned ? 'unban' : 'ban'
                              )
                            }
                            disabled={actionLoadingId === user.id}
                            className={cn(
                              user.is_banned ? 'text-red-400' : 'text-muted-foreground'
                            )}
                            title={user.is_banned ? '차단 해제' : '차단'}
                          >
                            <Ban className="w-4 h-4" />
                          </Button>
                          <Link href={`/admin/users/${user.id}`}>
                            <Button variant="ghost" size="sm" title="상세 보기">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
