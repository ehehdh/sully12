'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/useAuth';

interface ReportUserButtonProps {
  targetUserId: string;
  targetUserName: string;
  roomId?: string;
  messageContent?: string;
  className?: string;
}

const REPORT_REASONS = [
  { value: 'offensive_language', label: '욕설/비하', description: '욕설, 비하 발언, 혐오 표현' },
  { value: 'spam', label: '스팸/도배', description: '의미 없는 메시지 반복' },
  { value: 'harassment', label: '괴롭힘', description: '개인을 대상으로 한 괴롭힘' },
  { value: 'inappropriate_content', label: '부적절한 내용', description: '토론과 무관한 부적절한 내용' },
  { value: 'cheating', label: '부정행위', description: 'AI 도구 부정 사용 의심 등' },
  { value: 'other', label: '기타', description: '위 항목에 해당하지 않는 사유' },
];

export function ReportUserButton({ 
  targetUserId, 
  targetUserName, 
  roomId,
  messageContent,
  className 
}: ReportUserButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // 로그인하지 않았거나 자신을 신고하려는 경우 버튼 표시하지 않음
  if (!isAuthenticated || !user || user.id === targetUserId) {
    return null;
  }

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError('신고 사유를 선택해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId: targetUserId,
          reportedUserName: targetUserName,
          reason: selectedReason,
          reasonDetail,
          roomId,
          messageContent
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
          setSelectedReason('');
          setReasonDetail('');
        }, 2000);
      } else {
        if (res.status === 429) {
          setError('이미 최근에 이 사용자를 신고하셨습니다.');
        } else {
          setError(data.error || '신고 접수에 실패했습니다.');
        }
      }
    } catch (err) {
      setError('신고 접수에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors ${className}`}
        title="신고하기"
      >
        <Flag className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 z-50"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-red-500/20">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold">사용자 신고</h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {success ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">✅</div>
                  <p className="text-green-400 font-medium">신고가 접수되었습니다.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    관리자가 검토 후 조치할 예정입니다.
                  </p>
                </div>
              ) : (
                <>
                  {/* Target User */}
                  <div className="p-3 bg-white/5 rounded-xl mb-4">
                    <p className="text-sm text-muted-foreground">신고 대상</p>
                    <p className="font-medium">{targetUserName}</p>
                  </div>

                  {/* Reason Selection */}
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground mb-2">신고 사유 *</p>
                    <div className="space-y-2">
                      {REPORT_REASONS.map((reason) => (
                        <label
                          key={reason.value}
                          className={`block p-3 rounded-xl cursor-pointer border transition-colors ${
                            selectedReason === reason.value
                              ? 'bg-red-500/20 border-red-500/30'
                              : 'bg-white/5 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="reason"
                              value={reason.value}
                              checked={selectedReason === reason.value}
                              onChange={(e) => setSelectedReason(e.target.value)}
                              className="hidden"
                            />
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedReason === reason.value
                                ? 'border-red-400 bg-red-400'
                                : 'border-white/30'
                            }`}>
                              {selectedReason === reason.value && (
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{reason.label}</p>
                              <p className="text-xs text-muted-foreground">{reason.description}</p>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Detail */}
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground mb-2">상세 설명 (선택)</p>
                    <textarea
                      value={reasonDetail}
                      onChange={(e) => setReasonDetail(e.target.value)}
                      placeholder="구체적인 상황을 설명해주세요..."
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl min-h-[80px] text-sm"
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsOpen(false)}
                      className="flex-1"
                    >
                      취소
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={loading || !selectedReason}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      {loading ? '처리 중...' : '신고하기'}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground text-center mt-4">
                    허위 신고 시 본인이 제재를 받을 수 있습니다.
                  </p>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
