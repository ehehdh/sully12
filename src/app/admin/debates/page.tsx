'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Trophy, Search, ChevronLeft, ChevronRight, Trash2, Eye, Clock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DebateRecord {
  id: string;
  topic_title: string;
  title: string;
  pro_user_name: string;
  con_user_name: string;
  winner: 'pro' | 'con' | 'draw' | 'cancelled';
  final_score_pro: number;
  final_score_con: number;
  total_messages: number;
  duration_seconds: number;
  ended_at: string;
}

export default function AdminDebatesPage() {
  const [records, setRecords] = useState<DebateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const limit = 15;

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/debates/archive?limit=${limit}&offset=${page * limit}`);
        const data = await res.json();
        
        if (data.records) {
          setRecords(data.records);
          setTotal(data.total || 0);
        }
      } catch (error) {
        console.error('Failed to fetch records:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [page]);

  const handleDelete = async (recordId: string) => {
    if (!confirm('정말 이 토론 기록을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/debates/records/${recordId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setRecords(records.filter(r => r.id !== recordId));
        setTotal(total - 1);
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins}분`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { 
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredRecords = search
    ? records.filter(r => 
        r.topic_title.toLowerCase().includes(search.toLowerCase()) ||
        r.pro_user_name.toLowerCase().includes(search.toLowerCase()) ||
        r.con_user_name.toLowerCase().includes(search.toLowerCase())
      )
    : records;

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
            <Trophy className="w-6 h-6 text-yellow-500" />
            토론 기록 관리
          </h1>
          <div className="w-24" />
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold">{total}</p>
            <p className="text-sm text-muted-foreground">총 토론</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-400">
              {records.filter(r => r.winner === 'pro').length}
            </p>
            <p className="text-sm text-muted-foreground">찬성 승</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-red-400">
              {records.filter(r => r.winner === 'con').length}
            </p>
            <p className="text-sm text-muted-foreground">반대 승</p>
          </div>
          <div className="bg-gray-500/10 border border-gray-500/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-gray-400">
              {records.filter(r => r.winner === 'draw').length}
            </p>
            <p className="text-sm text-muted-foreground">무승부</p>
          </div>
        </div>

        {/* 검색 */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="주제 또는 참가자 이름으로 검색..."
            className="pl-10 bg-white/5 border-white/10"
          />
        </div>

        {/* 기록 테이블 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              토론 기록이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="text-left p-4 font-medium">주제</th>
                    <th className="text-left p-4 font-medium">참가자</th>
                    <th className="text-center p-4 font-medium">결과</th>
                    <th className="text-center p-4 font-medium">점수</th>
                    <th className="text-center p-4 font-medium">통계</th>
                    <th className="text-center p-4 font-medium">날짜</th>
                    <th className="text-center p-4 font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <motion.tr
                      key={record.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="p-4">
                        <p className="font-medium">{record.topic_title}</p>
                        {record.title && record.title !== record.topic_title && (
                          <p className="text-xs text-muted-foreground">{record.title}</p>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          <span className="text-blue-400">👍 {record.pro_user_name}</span>
                          <span className="text-muted-foreground mx-2">vs</span>
                          <span className="text-red-400">👎 {record.con_user_name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          record.winner === 'pro' ? 'bg-blue-500/20 text-blue-400' :
                          record.winner === 'con' ? 'bg-red-500/20 text-red-400' :
                          record.winner === 'draw' ? 'bg-gray-500/20 text-gray-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {record.winner === 'pro' ? '찬성 승' :
                           record.winner === 'con' ? '반대 승' :
                           record.winner === 'draw' ? '무승부' : '취소'}
                        </span>
                      </td>
                      <td className="p-4 text-center font-mono">
                        <span className="text-blue-400">{record.final_score_pro}</span>
                        <span className="text-muted-foreground mx-1">:</span>
                        <span className="text-red-400">{record.final_score_con}</span>
                      </td>
                      <td className="p-4 text-center text-xs text-muted-foreground">
                        <div className="flex items-center justify-center gap-3">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {record.total_messages}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(record.duration_seconds)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center text-sm text-muted-foreground">
                        {formatDate(record.ended_at)}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link href={`/mypage/history/${record.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDelete(record.id)}
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
