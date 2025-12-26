'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { ArrowLeft, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

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
  total_messages: number;
}

export default function HistoryPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [records, setRecords] = useState<DebateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'win' | 'loss' | 'draw'>('all');
  const limit = 10;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/users/me/history?limit=${limit}&offset=${page * limit}`);
        const data = await res.json();
        
        if (data.records) {
          let filtered = data.records;
          if (filter !== 'all') {
            filtered = data.records.filter((r: DebateRecord) => r.result === filter);
          }
          setRecords(filtered);
          setTotal(data.total);
        }
      } catch (error) {
        console.error('Failed to fetch history:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchHistory();
    }
  }, [isAuthenticated, page, filter]);

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

  const totalPages = Math.ceil(total / limit);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/mypage">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              마이페이지
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">토론 기록</h1>
          <div className="w-24" />
        </div>

        {/* 필터 */}
        <div className="flex gap-2 mb-6">
          <Button 
            variant={filter === 'all' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => { setFilter('all'); setPage(0); }}
          >
            전체
          </Button>
          <Button 
            variant={filter === 'win' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => { setFilter('win'); setPage(0); }}
            className={filter === 'win' ? 'bg-green-600' : ''}
          >
            승리
          </Button>
          <Button 
            variant={filter === 'loss' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => { setFilter('loss'); setPage(0); }}
            className={filter === 'loss' ? 'bg-red-600' : ''}
          >
            패배
          </Button>
          <Button 
            variant={filter === 'draw' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => { setFilter('draw'); setPage(0); }}
          >
            무승부
          </Button>
        </div>

        {/* 기록 목록 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>토론 기록이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record, index) => (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/mypage/history/${record.id}`}>
                  <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg mb-1">{record.topic_title}</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          vs {record.opponentName}
                        </p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span className={`px-2 py-0.5 rounded ${
                            record.mySide === 'pro' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {record.mySide === 'pro' ? '찬성' : '반대'}
                          </span>
                          <span>{formatDate(record.ended_at)}</span>
                          <span>{formatDuration(record.duration_seconds)}</span>
                          <span>{record.total_messages}개 메시지</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                          record.result === 'win' 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : record.result === 'loss' 
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}>
                          {record.result === 'win' ? '승리' : record.result === 'loss' ? '패배' : '무승부'}
                        </span>
                        <p className="text-lg font-bold mt-2">
                          <span className={record.myScore > record.opponentScore ? 'text-green-400' : record.myScore < record.opponentScore ? 'text-red-400' : ''}>
                            {record.myScore}
                          </span>
                          <span className="text-muted-foreground mx-1">:</span>
                          <span className={record.opponentScore > record.myScore ? 'text-green-400' : record.opponentScore < record.myScore ? 'text-red-400' : ''}>
                            {record.opponentScore}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
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
