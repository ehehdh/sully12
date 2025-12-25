"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Clock, AlertTriangle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { DebateStage } from "@/lib/database.types";
import { DEBATE_STAGES } from "@/lib/debateStages";

// 턴당 발언 시간 (초)
const TURN_DURATION_SECONDS = 60;

interface DebateTimerProps {
  stage: DebateStage;
  stageStartedAt: Date | null;
  turnStartedAt?: Date | null;
  currentSpeaker?: string | null;
  isMyTurn?: boolean;
  onTimeUp?: () => void;
  className?: string;
  serverTimeOffset?: number; // 서버 시간과의 차이 (ms)
  duration?: number; // 제한 시간 (초)
}

export function DebateTimer({ 
  stage, 
  stageStartedAt, 
  turnStartedAt,
  currentSpeaker,
  isMyTurn = false,
  onTimeUp, 
  className,
  serverTimeOffset = 0,
  duration = 60
}: DebateTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(-1);
  const stageConfig = DEBATE_STAGES[stage];

  const formatTime = (seconds: number): string => {
    if (seconds < 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimerColor = useCallback((seconds: number): string => {
    if (seconds < 0) return "text-muted-foreground";
    if (seconds <= 10) return "text-red-500";
    if (seconds <= 30) return "text-yellow-500";
    return "text-green-400";
  }, []);

  const getProgressColor = useCallback((seconds: number): string => {
    if (seconds <= 10) return "bg-red-500";
    if (seconds <= 30) return "bg-yellow-500";
    return "bg-green-500";
  }, []);

  useEffect(() => {
    // 대기 중이거나 판정 중에는 타이머 표시 안함
    if (stage === 'waiting' || stage === 'verdict_pending') {
      setRemainingSeconds(-1);
      return;
    }

    // 턴 기반 타이머 - turnStartedAt 사용
    const startTime = turnStartedAt || stageStartedAt;
    if (!startTime) {
      setRemainingSeconds(-1);
      return;
    }

    const updateTimer = () => {
      // 로컬 시간에 오차를 더해 서버 시간 추정
      const now = new Date(Date.now() + serverTimeOffset);
      const elapsed = (now.getTime() - startTime.getTime()) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      setRemainingSeconds(Math.floor(remaining));

      // 시간 초과 시 콜백 (내 턴일 때만)
      if (remaining <= 0 && isMyTurn && onTimeUp) {
        onTimeUp();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [stage, stageStartedAt, turnStartedAt, isMyTurn, onTimeUp, serverTimeOffset]);

  const progress = remainingSeconds >= 0
    ? Math.max(0, (remainingSeconds / TURN_DURATION_SECONDS) * 100)
    : 100;

  return (
    <div className={cn("p-4 bg-card/30 rounded-xl border border-white/10", className)}>
      {/* 현재 단계 표시 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {stageConfig.nameKr}
          </span>
        </div>
        {remainingSeconds >= 0 && remainingSeconds <= 10 && (
          <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
        )}
      </div>

      {/* 현재 발언자 표시 */}
      {currentSpeaker && stage !== 'waiting' && stage !== 'verdict_pending' && (
        <div className={cn(
          "flex items-center justify-center gap-2 mb-3 p-2 rounded-lg",
          isMyTurn ? "bg-green-500/20 text-green-300" : "bg-yellow-500/20 text-yellow-300"
        )}>
          <User className="w-4 h-4" />
          <span className="text-sm font-medium">
            {isMyTurn ? "내 발언 차례" : `${currentSpeaker}님 발언 중`}
          </span>
        </div>
      )}

      {/* 타이머 */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <Clock className={cn("w-5 h-5", getTimerColor(remainingSeconds))} />
        <motion.span
          key={remainingSeconds}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          className={cn(
            "text-3xl font-mono font-bold tabular-nums",
            getTimerColor(remainingSeconds)
          )}
        >
          {formatTime(remainingSeconds)}
        </motion.span>
      </div>

      {/* 진행 바 */}
      {remainingSeconds >= 0 && (
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full", getProgressColor(remainingSeconds))}
            initial={{ width: "100%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* 단계 설명 */}
      <p className="text-xs text-muted-foreground text-center mt-3">
        {stage === 'waiting' 
          ? "상대방 입장 대기 중..."
          : `발언 시간: ${TURN_DURATION_SECONDS}초`
        }
      </p>
    </div>
  );
}
