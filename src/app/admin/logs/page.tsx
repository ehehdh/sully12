'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, History, Search, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AdminLog {
  id: string;
  admin_id: string;
  admin_identifier: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_snapshot: any;
  details: any;
  ip_address: string | null;
  created_at: string;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AdminLog | null>(null);
  const limit = 20;

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
        ...(actionFilter && { action: actionFilter }),
        ...(targetFilter && { targetType: targetFilter }),
        ...(search && { search }),
      });

      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      const data = await res.json();

      if (data.logs) {
        setLogs(data.logs);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, targetFilter, search]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getJsonText = (value: any) => {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return value;
      }
    }
    return JSON.stringify(value, null, 2);
  };

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
            <History className="w-6 h-6 text-indigo-400" />
            활동 로그
          </h1>
          <div className="w-24" />
        </div>

        {/* 필터 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="관리자/액션/대상 검색..."
              className="pl-10 bg-white/5 border-white/10"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(0);
            }}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg"
          >
            <option value="">모든 액션</option>
            <option value="ban_user">사용자 차단</option>
            <option value="unban_user">차단 해제</option>
            <option value="suspend_user">사용자 정지</option>
            <option value="unsuspend_user">정지 해제</option>
            <option value="force_end_room">토론방 종료</option>
            <option value="delete_room">토론방 삭제</option>
          </select>
          <select
            value={targetFilter}
            onChange={(e) => {
              setTargetFilter(e.target.value);
              setPage(0);
            }}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg"
          >
            <option value="">모든 대상</option>
            <option value="user">사용자</option>
            <option value="room">토론방</option>
            <option value="report">신고</option>
          </select>
        </div>

        {/* 로그 테이블 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              활동 로그가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="text-left p-4 font-medium">액션</th>
                    <th className="text-left p-4 font-medium">관리자</th>
                    <th className="text-left p-4 font-medium">대상</th>
                    <th className="text-center p-4 font-medium">IP</th>
                    <th className="text-center p-4 font-medium">시간</th>
                    <th className="text-center p-4 font-medium">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="p-4">
                        <span
                          className={cn(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            log.action.includes('ban') && 'bg-red-500/20 text-red-400',
                            log.action.includes('suspend') && 'bg-yellow-500/20 text-yellow-400',
                            log.action.includes('room') && 'bg-blue-500/20 text-blue-400'
                          )}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {log.admin_identifier || 'admin'}
                      </td>
                      <td className="p-4 text-sm">
                        <div className="text-muted-foreground">
                          {log.target_type || '-'}
                        </div>
                        {log.target_id && (
                          <div className="text-xs text-muted-foreground break-all">
                            {log.target_id}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center text-xs text-muted-foreground">
                        {log.ip_address || '-'}
                      </td>
                      <td className="p-4 text-center text-xs text-muted-foreground">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="p-4 text-center">
                        {(log.details || log.target_snapshot) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        )}
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

      {/* 상세 모달 */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">로그 상세</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                닫기
              </Button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">액션</p>
                <p className="font-medium">{selectedLog.action}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">관리자</p>
                <p>{selectedLog.admin_identifier || 'admin'}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">대상</p>
                <p>{selectedLog.target_type || '-'}</p>
                {selectedLog.target_id && (
                  <p className="text-xs text-muted-foreground break-all">{selectedLog.target_id}</p>
                )}
              </div>
              {selectedLog.details && (
                <div>
                  <p className="text-muted-foreground mb-2">상세 정보</p>
                  <pre className="whitespace-pre-wrap bg-black/30 p-3 rounded-lg text-xs">
                    {getJsonText(selectedLog.details)}
                  </pre>
                </div>
              )}
              {selectedLog.target_snapshot && (
                <div>
                  <p className="text-muted-foreground mb-2">대상 스냅샷</p>
                  <pre className="whitespace-pre-wrap bg-black/30 p-3 rounded-lg text-xs">
                    {getJsonText(selectedLog.target_snapshot)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
