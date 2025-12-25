"use client";

import { motion, AnimatePresence } from "framer-motion";
import { User, Wifi, WifiOff, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Participant } from "@/lib/database.types";

interface ParticipantListProps {
  participants: Participant[];
  typingUsers: string[];
  myName?: string;
  className?: string;
}

export function ParticipantList({
  participants,
  typingUsers,
  myName,
  className,
}: ParticipantListProps) {
  const getStanceColor = (stance: string) => {
    switch (stance) {
      case "agree":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "disagree":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getStanceLabel = (stance: string) => {
    switch (stance) {
      case "agree":
        return "찬성";
      case "disagree":
        return "반대";
      default:
        return "중립";
    }
  };

  return (
    <div className={cn("p-4 bg-card/30 rounded-xl border border-white/10", className)}>
      <h3 className="font-bold text-sm text-muted-foreground mb-4 flex items-center gap-2">
        <User className="w-4 h-4" />
        참가자 ({participants.length}명)
      </h3>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {participants.map((participant) => {
            const isMe = participant.user_name === myName;
            const isTyping = typingUsers.includes(participant.user_name);

            return (
              <motion.div
                key={participant.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-colors",
                  isMe && "bg-white/5"
                )}
              >
                {/* 아바타 */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border",
                    getStanceColor(participant.stance)
                  )}
                >
                  {participant.user_name.charAt(0).toUpperCase()}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium text-sm truncate", isMe && "text-blue-400")}>
                      {participant.user_name}
                      {isMe && " (나)"}
                    </span>
                    {isTyping && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-1 text-xs text-muted-foreground"
                      >
                        <Keyboard className="w-3 h-3" />
                        <span className="animate-pulse">입력 중...</span>
                      </motion.div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded border",
                        getStanceColor(participant.stance)
                      )}
                    >
                      {getStanceLabel(participant.stance)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      점수: {participant.logic_score}
                    </span>
                  </div>
                </div>

                {/* 연결 상태 */}
                <div className="flex-shrink-0">
                  <Wifi className="w-4 h-4 text-green-500" />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {participants.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-4">
            아직 참가자가 없습니다
          </div>
        )}

        {participants.length === 1 && (
          <div className="text-center text-muted-foreground text-sm py-2 border-t border-white/5 mt-2 pt-2">
            <WifiOff className="w-4 h-4 inline-block mr-1" />
            상대방 대기 중...
          </div>
        )}
      </div>
    </div>
  );
}
