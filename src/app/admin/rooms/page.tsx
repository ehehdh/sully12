'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, DoorOpen, Search, ChevronLeft, ChevronRight, Ban, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface RoomData {
  id: string;
  topic: string;
  title: string | null;
  description: string | null;
  stance: string;
  stage: string;
  created_at: string;
  updated_at: string;
  participant_count: number;
}

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'ended' | ''>('active');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const limit = 15;

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await fetch(`/api/admin/rooms?${params.toString()}`);
      const data = await res.json();
      if (data.rooms) {
        setRooms(data.rooms);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [page, statusFilter]);

  const handleForceEnd = async (roomId: string) => {
    if (!confirm('해당 토론방을 강제 종료하시겠습니까?')) return;

    const reason = prompt('강제 종료 사유를 입력하세요 (선택)');
    setActionLoadingId(roomId);
    try {
      const res = await fetch('/api/admin/rooms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, action: 'end', reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '강제 종료에 실패했습니다.');
        return;
      }

      fetchRooms();
    } catch (error) {
      console.error('Force end error:', error);
      alert('강제 종료에 실패했습니다.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (roomId: string) => {
    if (!confirm('해당 토론방과 모든 기록을 삭제하시겠습니까?')) return;

    setActionLoadingId(roomId);
    try {
      const res = await fetch(`/api/admin/rooms?id=${roomId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '삭제에 실패했습니다.');
        return;
      }
      fetchRooms();
    } catch (error) {
      console.error('Delete room error:', error);
      alert('삭제에 실패했습니다.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredRooms = search
    ? rooms.filter((room) =>
        `${room.topic} ${room.title || ''}`.toLowerCase().includes(search.toLowerCase())
      )
    : rooms;

  const totalPages = Math.ceil(total / limit);

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              관리자 메인
            </Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DoorOpen className="w-6 h-6 text-emerald-500" />
            토론방 관리
          </h1>
          <div className="w-24" />
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold">{total}</p>
            <p className="text-sm text-muted-foreground">전체 토론방</p>
          </div>
          <div
            className={cn(
              'border rounded-xl p-4 text-center cursor-pointer transition-colors',
              statusFilter === 'active'
                ? 'bg-green-500/20 border-green-500/30'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            )}
            onClick={() => {
              setStatusFilter('active');
              setPage(0);
            }}
          >
            <Users className="w-6 h-6 mx-auto mb-2 text-green-400" />
            <p className="text-3xl font-bold text-green-400">
              {rooms.filter((room) => room.stage !== 'ended').length}
            </p>
            <p className="text-sm text-muted-foreground">진행중</p>
          </div>
          <div
            className={cn(
              'border rounded-xl p-4 text-center cursor-pointer transition-colors',
              statusFilter === 'ended'
                ? 'bg-gray-500/20 border-gray-500/30'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            )}
            onClick={() => {
              setStatusFilter('ended');
              setPage(0);
            }}
          >
            <Ban className="w-6 h-6 mx-auto mb-2 text-gray-400" />
            <p className="text-3xl font-bold text-gray-400">
              {rooms.filter((room) => room.stage === 'ended').length}
            </p>
            <p className="text-sm text-muted-foreground">종료됨</p>
          </div>
          <div
            className={cn(
              'border rounded-xl p-4 text-center cursor-pointer transition-colors',
              statusFilter === ''
                ? 'bg-blue-500/20 border-blue-500/30'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            )}
            onClick={() => {
              setStatusFilter('');
              setPage(0);
            }}
          >
            <DoorOpen className="w-6 h-6 mx-auto mb-2 text-blue-400" />
            <p className="text-3xl font-bold text-blue-400">{rooms.length}</p>
            <p className="text-sm text-muted-foreground">현재 페이지</p>
          </div>
        </div>

        {/* 검색 */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="주제 또는 제목으로 검색..."
            className="pl-10 bg-white/5 border-white/10"
          />
        </div>

        {/* 토론방 목록 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              토론방이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="text-left p-4 font-medium">주제</th>
                    <th className="text-center p-4 font-medium">상태</th>
                    <th className="text-center p-4 font-medium">참여</th>
                    <th className="text-center p-4 font-medium">생성일</th>
                    <th className="text-center p-4 font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRooms.map((room) => (
                    <motion.tr
                      key={room.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="p-4">
                        <p className="font-medium">{room.topic}</p>
                        {room.title && (
                          <p className="text-xs text-muted-foreground">{room.title}</p>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={cn(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            room.stage === 'ended'
                              ? 'bg-gray-500/20 text-gray-400'
                              : 'bg-green-500/20 text-green-400'
                          )}
                        >
                          {room.stage === 'ended' ? '종료' : '진행중'}
                        </span>
                      </td>
                      <td className="p-4 text-center text-sm text-muted-foreground">
                        {room.participant_count}명
                      </td>
                      <td className="p-4 text-center text-sm text-muted-foreground">
                        {formatDate(room.created_at)}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleForceEnd(room.id)}
                            disabled={room.stage === 'ended' || actionLoadingId === room.id}
                            className="text-yellow-400"
                          >
                            <Ban className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(room.id)}
                            disabled={actionLoadingId === room.id}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
