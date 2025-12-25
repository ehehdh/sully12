"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  ShieldAlert, 
  Bot, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  Gavel,
  MessageSquare,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Message as DBMessage, MessageType } from "@/lib/database.types";

// Extended Message type for UI
export interface Message {
  id: string;
  role: "user" | "opponent" | "moderator" | "system";
  content: string;
  timestamp: Date;
  type?: MessageType;
  senderName?: string;
  sender_session_id?: string | null;
  fallacyDetected?: string | null;
  factCheckStatus?: string | null;
}

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onTyping?: (isTyping: boolean) => void;
  isTyping?: boolean;
  typingUsers?: string[];
  disabled?: boolean;
  stage?: string;
  turnMessage?: string | null;
  isMyTurn?: boolean;
  onFactCheck?: (claim: string) => void;
  myName?: string; // 현재 사용자 이름 (메시지 정렬용 - 폴백)
  mySessionId?: string; // 현재 사용자 세션 ID (메시지 정렬용 - 우선)
  timeLeft?: number; // 남은 시간 (초)
}

export function ChatInterface({
  messages,
  onSendMessage,
  onTyping,
  isTyping,
  typingUsers = [],
  disabled = false,
  stage = "cross",
  turnMessage = null,
  isMyTurn = true,
  onFactCheck,
  myName = "",
  mySessionId = "",
  timeLeft = -1,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isFactCheckMode, setIsFactCheckMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // 타이핑 상태 관리
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);

      if (onTyping) {
        onTyping(true);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          onTyping(false);
        }, 2000);
      }
    },
    [onTyping]
  );

  // 메시지 전송
  const handleSend = useCallback(() => {
    if (!input.trim() || disabled) return;

    // 팩트체크 모드일 경우
    if (isFactCheckMode && onFactCheck) {
      onFactCheck(input);
      setInput("");
      setIsFactCheckMode(false);
      return;
    }

    // 간단한 독성 체크 (클라이언트 사이드)
    const toxicWords = ["바보", "멍청", "죽어", "ㅅㅂ", "ㅄ"];
    if (toxicWords.some((word) => input.includes(word))) {
      alert("⚠️ 토론에서는 정중한 언어를 사용해주세요.\n\n감정보다는 논리입니다.");
      return;
    }

    onSendMessage(input);
    setInput("");
    
    if (onTyping) {
      onTyping(false);
    }
  }, [input, disabled, onSendMessage, onTyping, isFactCheckMode, onFactCheck]);

  // 메시지 타입별 아이콘
  const getMessageIcon = (type?: MessageType) => {
    switch (type) {
      case "fact-check":
        return <HelpCircle className="w-3 h-3" />;
      case "fallacy-alert":
        return <ShieldAlert className="w-3 h-3" />;
      case "stage-change":
        return <Gavel className="w-3 h-3" />;
      case "verdict":
        return <CheckCircle2 className="w-3 h-3" />;
      default:
        return <Bot className="w-3 h-3" />;
    }
  };

  // 메시지 스타일
  const getMessageStyle = (msg: Message) => {
    const base = "max-w-[80%] p-3 rounded-2xl text-sm shadow-md relative";

    switch (msg.role) {
      case "user":
        return cn(base, "bg-blue-600 text-white rounded-br-none");
      case "opponent":
        return cn(base, "bg-secondary text-secondary-foreground rounded-bl-none");
      case "system":
        return cn(
          base,
          "bg-gray-500/20 text-gray-400 text-center w-full max-w-full italic"
        );
      case "moderator":
        // 타입별로 다른 스타일
        switch (msg.type) {
          case "fallacy-alert":
            return cn(
              base,
              "bg-red-900/50 border-2 border-red-500/50 text-red-100 w-full max-w-[95%] mx-auto"
            );
          case "fact-check":
            return cn(
              base,
              "bg-yellow-900/50 border-2 border-yellow-500/50 text-yellow-100 w-full max-w-[95%] mx-auto"
            );
          case "stage-change":
            return cn(
              base,
              "bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-2 border-blue-500/30 text-blue-100 w-full max-w-[95%] mx-auto"
            );
          case "verdict":
            return cn(
              base,
              "bg-gradient-to-r from-amber-900/50 to-orange-900/50 border-2 border-amber-500/50 text-amber-100 w-full max-w-[95%] mx-auto"
            );
          default:
            return cn(
              base,
              "bg-purple-900/50 border border-purple-500/30 text-purple-100 w-full max-w-[90%] mx-auto"
            );
        }
      default:
        return base;
    }
  };

  // 중재자 메시지 헤더
  const getModeratorHeader = (msg: Message) => {
    const labels: Record<string, string> = {
      "fallacy-alert": "⚠️ 논리적 오류 감지",
      "fact-check": "📋 팩트 체크",
      "stage-change": "📢 단계 전환",
      "verdict": "🏆 최종 판정",
    };

    return labels[msg.type || ""] || "🤖 AI 중재자";
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto bg-card/30 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
      {/* 채팅 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            // 본인 메시지인지 확인 (session_id 우선, 이름은 폴백)
            const msgSessionId = (msg as any).sender_session_id;
            const isMyMessage = msg.role === "user" && (
              (mySessionId && msgSessionId === mySessionId) || 
              (!msgSessionId && msg.senderName === myName)
            );
            const isOpponentMessage = msg.role === "user" && !isMyMessage;
            const isSystemMessage = msg.role === "moderator" || msg.role === "system";
            
            // 디버그 로그 (user 메시지만)
            if (msg.role === "user") {
              console.log('[Msg Debug]', { 
                msgId: msg.id, 
                msgSessionId, 
                mySessionId, 
                match: msgSessionId === mySessionId,
                senderName: msg.senderName, 
                myName,
                isMyMessage 
              });
            }
            
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "flex w-full",
                  isMyMessage && "justify-end",
                  isOpponentMessage && "justify-start",
                  isSystemMessage && "justify-center"
                )}
              >
                <div className={cn(
                  getMessageStyle(msg),
                  // 상대방 메시지 스타일 오버라이드
                  isOpponentMessage && "bg-gray-700/50 text-gray-100 border-gray-600 rounded-xl rounded-bl-none"
                )}>
                  {/* Moderator Header */}
                  {msg.role === "moderator" && (
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider opacity-80">
                      {getMessageIcon(msg.type)}
                      {getModeratorHeader(msg)}
                    </div>
                  )}

                  {/* Sender Name (for user messages) */}
                  {msg.role === "user" && msg.senderName && (
                    <div className={cn(
                      "text-[10px] opacity-70 mb-1 font-bold",
                      isMyMessage ? "text-right" : "text-left"
                    )}>
                      {isMyMessage ? "나" : msg.senderName}
                    </div>
                  )}

                  {/* Fallacy Badge */}
                  {msg.fallacyDetected && (
                    <div className="inline-flex items-center gap-1 bg-red-500/30 text-red-300 text-xs px-2 py-0.5 rounded-full mb-2">
                      <AlertCircle className="w-3 h-3" />
                      {msg.fallacyDetected}
                    </div>
                  )}

                  {/* Message Content */}
                  <div className={cn(
                    "whitespace-pre-wrap",
                    msg.type === "verdict" && "prose prose-invert prose-sm max-w-none"
                  )}>
                    {msg.content}
                  </div>

                  {/* Timestamp */}
                  <span className={cn(
                    "text-[10px] opacity-50 block mt-2",
                    isMyMessage ? "text-right" : isOpponentMessage ? "text-left" : "text-right"
                  )}>
                    {msg.timestamp instanceof Date
                      ? msg.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing Indicators */}
        {(isTyping || typingUsers.length > 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-secondary text-secondary-foreground p-3 rounded-2xl rounded-bl-none text-sm">
              <span className="flex items-center gap-2">
                <MessageSquare className="w-3 h-3" />
                {typingUsers.length > 0
                  ? `${typingUsers.join(", ")} 입력 중...`
                  : "상대방이 입력 중..."}
                <span className="animate-pulse">...</span>
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* 입력 영역 */}
      <div className="p-4 bg-background/50 border-t border-white/5">
        {/* 발언권 메시지 */}
        {/* 발언권 메시지 */}
        {turnMessage && (
          <div className="mb-3 p-2 bg-yellow-500/20 text-yellow-300 text-sm rounded-lg text-center flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            {turnMessage}
            {timeLeft >= 0 && !isMyTurn && (
               <span className="font-mono font-bold border-l border-yellow-500/30 pl-2 ml-2">
                 {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
               </span>
            )}
          </div>
        )}
        
        {isMyTurn && !disabled && (
          <div className="mb-3 p-2 bg-green-500/20 text-green-300 text-sm rounded-lg text-center flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>지금은 당신의 발언 차례입니다!</span>
             {timeLeft >= 0 && (
               <span className="font-mono font-bold border-l border-green-500/30 pl-2 ml-2">
                 {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
               </span>
             )}
          </div>
        )}
        
        {/* 팩트체크 모드 표시 */}
        {isFactCheckMode && (
          <div className="mb-3 p-2 bg-orange-500/20 text-orange-300 text-sm rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              상대방 주장의 팩트체크를 요청합니다. 검증할 내용을 입력하세요.
            </div>
            <button 
              onClick={() => setIsFactCheckMode(false)}
              className="text-orange-400 hover:text-orange-200"
            >
              취소
            </button>
          </div>
        )}
        
        <div className="flex gap-2">
          {/* 팩트체크 버튼 (내 차례일 때만 표시) */}
          {onFactCheck && isMyTurn && !disabled && !isFactCheckMode && (
            <Button
              onClick={() => setIsFactCheckMode(true)}
              size="icon"
              variant="outline"
              className="border-orange-500/50 text-orange-400 hover:bg-orange-500/20"
              title="상대 주장 팩트체크 요청"
            >
              <Search className="w-4 h-4" />
            </Button>
          )}
          
          <Input
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              isFactCheckMode
                ? "검증할 상대방의 주장을 입력하세요..."
                : disabled && turnMessage
                ? turnMessage
                : disabled
                ? "현재 단계에서는 입력할 수 없습니다"
                : "당신의 주장을 입력하세요..."
            }
            className={cn(
              "bg-secondary/50 border-none focus-visible:ring-blue-500 flex-1",
              disabled && "opacity-50",
              isFactCheckMode && "ring-2 ring-orange-500/50"
            )}
            disabled={disabled}
          />
          <Button
            onClick={handleSend}
            size="icon"
            className={cn(
              "transition-colors",
              isFactCheckMode
                ? "bg-orange-600 hover:bg-orange-700"
                : disabled
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            )}
            disabled={disabled}
          >
            {isFactCheckMode ? (
              <Search className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
