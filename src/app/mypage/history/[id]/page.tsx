'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/useAuth';
import { ArrowLeft, Clock, MessageSquare, Trophy, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DebateRecord {
  id: string;
  topic_title: string;
  title: string;
  pro_user_name: string;
  con_user_name: string;
  winner: 'pro' | 'con' | 'draw';
  final_score_pro: number;
  final_score_con: number;
  verdict_summary: string;
  total_messages: number;
  duration_seconds: number;
  started_at: string;
  ended_at: string;
}

interface Message {
  id: string;
  role: 'user' | 'opponent' | 'moderator' | 'system';
  content: string;
  sender_name: string;
  message_type: string;
  stage: string;
  original_created_at: string;
}

export default function DebateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [record, setRecord] = useState<DebateRecord | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const recordId = params.id as string;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/debates/records/${recordId}`);
        const data = await res.json();
        
        if (data.record) {
          setRecord(data.record);
        }
        if (data.messages) {
          setMessages(data.messages);
        }
      } catch (error) {
        console.error('Failed to fetch detail:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && recordId) {
      fetchDetail();
    }
  }, [isAuthenticated, authLoading, recordId, router]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground mb-4">기록을 찾을 수 없습니다.</p>
        <Link href="/mypage/history">
          <Button>목록으로 돌아가기</Button>
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center mb-8">
          <Link href="/mypage/history">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              기록 목록
            </Button>
          </Link>
        </div>

        {/* 토론 정보 카드 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-3xl p-6 mb-6"
        >
          <h1 className="text-2xl font-bold mb-2">{record.topic_title}</h1>
          {record.title && record.title !== record.topic_title && (
            <p className="text-muted-foreground mb-4">{record.title}</p>
          )}

          {/* 대결 정보 */}
          <div className="flex items-center justify-center gap-4 my-6">
            <div className="text-center flex-1">
              <div className={cn(
                "text-sm px-3 py-1 rounded-full inline-block mb-2",
                record.winner === 'pro' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
              )}>
                찬성
                {record.winner === 'pro' && ' 👑'}
              </div>
              <p className="font-bold text-lg">{record.pro_user_name}</p>
              <p className="text-3xl font-bold text-blue-400">{record.final_score_pro}</p>
            </div>

            <div className="text-4xl font-bold text-muted-foreground">VS</div>

            <div className="text-center flex-1">
              <div className={cn(
                "text-sm px-3 py-1 rounded-full inline-block mb-2",
                record.winner === 'con' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              )}>
                반대
                {record.winner === 'con' && ' 👑'}
              </div>
              <p className="font-bold text-lg">{record.con_user_name}</p>
              <p className="text-3xl font-bold text-red-400">{record.final_score_con}</p>
            </div>
          </div>

          {/* 결과 */}
          <div className="text-center py-4 border-t border-white/10">
            <span className={cn(
              "px-6 py-2 rounded-full text-lg font-bold",
              record.winner === 'draw' 
                ? 'bg-gray-500/20 text-gray-400'
                : 'bg-yellow-500/20 text-yellow-400'
            )}>
              {record.winner === 'draw' ? '무승부' : record.winner === 'pro' ? '찬성 측 승리' : '반대 측 승리'}
            </span>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/10">
            <div className="text-center">
              <Clock className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-medium">{formatDuration(record.duration_seconds)}</p>
              <p className="text-xs text-muted-foreground">소요 시간</p>
            </div>
            <div className="text-center">
              <MessageSquare className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-medium">{record.total_messages}개</p>
              <p className="text-xs text-muted-foreground">메시지</p>
            </div>
            <div className="text-center">
              <Trophy className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-medium">{Math.abs(record.final_score_pro - record.final_score_con)}</p>
              <p className="text-xs text-muted-foreground">점수 차이</p>
            </div>
          </div>
        </motion.div>

        {/* AI 판정 요약 */}
        {record.verdict_summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-6 mb-6"
          >
            <h3 className="font-bold mb-3 flex items-center gap-2">
              🤖 AI 판정 요약
            </h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{record.verdict_summary}</p>
          </motion.div>
        )}

        {/* 토론 내용 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6"
        >
          <h3 className="font-bold mb-4">토론 내용</h3>
          
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={cn(
                  "p-3 rounded-xl",
                  message.role === 'moderator' && 'bg-purple-500/10 border border-purple-500/20',
                  message.role === 'system' && 'bg-gray-500/10 border border-gray-500/20 text-center text-sm',
                  message.role === 'user' && 'bg-blue-500/10 border border-blue-500/20',
                  message.role === 'opponent' && 'bg-red-500/10 border border-red-500/20'
                )}
              >
                {message.role !== 'system' && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {message.role === 'moderator' ? '🤖 사회자' : message.sender_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(message.original_created_at)}
                    </span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
