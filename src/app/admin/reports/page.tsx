'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  ArrowLeft, Flag, Search, ChevronLeft, ChevronRight, 
  Clock, Check, X, AlertTriangle, Eye, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/useAuth';

interface Report {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reported_user_id: string;
  reported_user_name: string;
  reason: string;
  reason_detail: string | null;
  message_content: string | null;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  action_taken: string | null;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export default function AdminReportsPage() {
  const { user: currentAdmin } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ pending: 0, reviewing: 0, resolved: 0, dismissed: 0 });
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('pending');
  const limit = 15;

  // 처리 모달
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionTaken, setActionTaken] = useState('none');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
        ...(statusFilter && { status: statusFilter })
      });
      
      const res = await fetch(`/api/admin/reports?${params}`);
      const data = await res.json();
      
      if (data.reports) {
        setReports(data.reports);
        setTotal(data.total || 0);
        setStats(data.stats || { pending: 0, reviewing: 0, resolved: 0, dismissed: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [page, statusFilter]);

  const handleProcess = async (status: 'reviewing' | 'resolved' | 'dismissed') => {
    if (!selectedReport) return;
    
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: selectedReport.id,
          status,
          adminId: currentAdmin?.id,
          adminNote: actionNote,
          actionTaken: status === 'resolved' ? actionTaken : 'none'
        })
      });
      
      if (res.ok) {
        alert('처리되었습니다.');
        setSelectedReport(null);
        setActionNote('');
        setActionTaken('none');
        fetchReports();
      }
    } catch (error) {
      console.error('Process failed:', error);
      alert('처리에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
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
            <Flag className="w-6 h-6 text-red-500" />
            신고 관리
          </h1>
          <div className="w-24" />
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div 
            className={cn(
              "border rounded-xl p-4 text-center cursor-pointer transition-colors",
              statusFilter === 'pending' ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'
            )}
            onClick={() => { setStatusFilter('pending'); setPage(0); }}
          >
            <Clock className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
            <p className="text-3xl font-bold text-yellow-400">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">대기중</p>
          </div>
          <div 
            className={cn(
              "border rounded-xl p-4 text-center cursor-pointer transition-colors",
              statusFilter === 'reviewing' ? 'bg-blue-500/20 border-blue-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'
            )}
            onClick={() => { setStatusFilter('reviewing'); setPage(0); }}
          >
            <Eye className="w-6 h-6 mx-auto mb-2 text-blue-400" />
            <p className="text-3xl font-bold text-blue-400">{stats.reviewing}</p>
            <p className="text-sm text-muted-foreground">검토중</p>
          </div>
          <div 
            className={cn(
              "border rounded-xl p-4 text-center cursor-pointer transition-colors",
              statusFilter === 'resolved' ? 'bg-green-500/20 border-green-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'
            )}
            onClick={() => { setStatusFilter('resolved'); setPage(0); }}
          >
            <Check className="w-6 h-6 mx-auto mb-2 text-green-400" />
            <p className="text-3xl font-bold text-green-400">{stats.resolved}</p>
            <p className="text-sm text-muted-foreground">처리완료</p>
          </div>
          <div 
            className={cn(
              "border rounded-xl p-4 text-center cursor-pointer transition-colors",
              statusFilter === 'dismissed' ? 'bg-gray-500/20 border-gray-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'
            )}
            onClick={() => { setStatusFilter('dismissed'); setPage(0); }}
          >
            <X className="w-6 h-6 mx-auto mb-2 text-gray-400" />
            <p className="text-3xl font-bold text-gray-400">{stats.dismissed}</p>
            <p className="text-sm text-muted-foreground">기각</p>
          </div>
        </div>

        {/* 신고 목록 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {statusFilter === 'pending' ? '대기중인 신고가 없습니다.' : '신고가 없습니다.'}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {reports.map((report) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 hover:bg-white/5 cursor-pointer"
                  onClick={() => setSelectedReport(report)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
                          {getReasonLabel(report.reason)}
                        </span>
                        <span className={cn(
                          "px-2 py-1 rounded text-xs",
                          report.status === 'pending' && 'bg-yellow-500/20 text-yellow-400',
                          report.status === 'reviewing' && 'bg-blue-500/20 text-blue-400',
                          report.status === 'resolved' && 'bg-green-500/20 text-green-400',
                          report.status === 'dismissed' && 'bg-gray-500/20 text-gray-400'
                        )}>
                          {report.status === 'pending' ? '대기중' :
                           report.status === 'reviewing' ? '검토중' :
                           report.status === 'resolved' ? '처리완료' : '기각'}
                        </span>
                      </div>
                      <p className="font-medium">
                        <span className="text-blue-400">{report.reporter_name}</span>
                        <span className="text-muted-foreground mx-2">→</span>
                        <span className="text-red-400">{report.reported_user_name}</span>
                      </p>
                      {report.reason_detail && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {report.reason_detail}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(report.created_at)}
                      </p>
                      {report.action_taken && report.action_taken !== 'none' && (
                        <span className="text-xs text-orange-400">
                          제재: {report.action_taken}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
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

      {/* 신고 처리 모달 */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">신고 상세</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedReport(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* 신고 정보 */}
              <div className="p-4 bg-white/5 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
                    {getReasonLabel(selectedReport.reason)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(selectedReport.created_at)}
                  </span>
                </div>
                <p className="mb-2">
                  신고자: <span className="text-blue-400">{selectedReport.reporter_name}</span>
                </p>
                <p className="mb-2">
                  피신고자: <Link href={`/admin/users/${selectedReport.reported_user_id}`}>
                    <span className="text-red-400 underline">{selectedReport.reported_user_name}</span>
                  </Link>
                </p>
                {selectedReport.reason_detail && (
                  <div className="mt-3 p-3 bg-black/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">상세 사유:</p>
                    <p className="text-sm">{selectedReport.reason_detail}</p>
                  </div>
                )}
                {selectedReport.message_content && (
                  <div className="mt-3 p-3 bg-black/20 rounded-lg">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> 관련 메시지:
                    </p>
                    <p className="text-sm">{selectedReport.message_content}</p>
                  </div>
                )}
              </div>
              
              {/* 처리 (대기중/검토중일 때만) */}
              {(selectedReport.status === 'pending' || selectedReport.status === 'reviewing') && (
                <>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">조치 선택</label>
                    <select
                      value={actionTaken}
                      onChange={(e) => setActionTaken(e.target.value)}
                      className="w-full p-2 bg-white/5 border border-white/10 rounded-lg"
                    >
                      <option value="none">조치 없음</option>
                      <option value="warning">경고</option>
                      <option value="suspend_1d">1일 정지</option>
                      <option value="suspend_7d">7일 정지</option>
                      <option value="suspend_30d">30일 정지</option>
                      <option value="ban">영구 차단</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">관리자 메모</label>
                    <textarea
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder="처리 사유나 메모를 입력하세요..."
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-lg min-h-[80px]"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    {selectedReport.status === 'pending' && (
                      <Button
                        variant="outline"
                        onClick={() => handleProcess('reviewing')}
                        disabled={actionLoading}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        검토 시작
                      </Button>
                    )}
                    <Button
                      onClick={() => handleProcess('resolved')}
                      disabled={actionLoading}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      처리 완료
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleProcess('dismissed')}
                      disabled={actionLoading}
                      className="flex-1"
                    >
                      <X className="w-4 h-4 mr-2" />
                      기각
                    </Button>
                  </div>
                </>
              )}
              
              {/* 이미 처리된 경우 */}
              {(selectedReport.status === 'resolved' || selectedReport.status === 'dismissed') && (
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-sm text-muted-foreground mb-2">처리 결과</p>
                  <p className="font-medium">
                    {selectedReport.status === 'resolved' ? '처리 완료' : '기각'}
                  </p>
                  {selectedReport.action_taken && selectedReport.action_taken !== 'none' && (
                    <p className="text-orange-400 mt-1">
                      조치: {selectedReport.action_taken}
                    </p>
                  )}
                  {selectedReport.admin_note && (
                    <p className="text-sm text-muted-foreground mt-2">
                      메모: {selectedReport.admin_note}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
