"use client";

import { useState, Suspense, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ChatInterface, Message } from "@/components/debate/ChatInterface";
import { LogicThermometer } from "@/components/debate/LogicThermometer";
import { DebateTimer } from "@/components/debate/DebateTimer";
import { ParticipantList } from "@/components/debate/ParticipantList";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Wifi, WifiOff, SkipForward, LogOut } from "lucide-react";
import Link from "next/link";
import { useAppStore } from "@/lib/useAppStore";
import { DebateStage, Participant, DebateSettings } from "@/lib/database.types";
import { DEBATE_STAGES, getNextStage } from "@/lib/debateStages";
import { cn } from "@/lib/utils";
import { getSessionId } from "@/lib/sessionId";

function DebateContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const issueId = params.id as string;
  const userStance = searchParams.get("stance") || "neutral";
  const isMulti = searchParams.get("isMulti") === "true";

  const stanceLabel =
    userStance === "agree" ? "찬성" : userStance === "disagree" ? "반대" : "중립";

  const user = useAppStore((state) => state.user);
  const typingUsers = useAppStore((state) => state.typingUsers);

  // 세션 ID (탭마다 고유)
  const [sessionId, setSessionId] = useState<string>("");
  
  // 토론 상태
  const [messages, setMessages] = useState<Message[]>([]);
  const [logicScorePro, setLogicScorePro] = useState(50);
  const [logicScoreCon, setLogicScoreCon] = useState(50);
  const [stage, setStage] = useState<DebateStage>("waiting");
  const [stageStartedAt, setStageStartedAt] = useState<Date | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [roomDeleted, setRoomDeleted] = useState(false);
  const [myRole, setMyRole] = useState<string>("observer");
  
  // 발언권 상태
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [currentTurnOwner, setCurrentTurnOwner] = useState<'host' | 'opponent' | null>(null);
  const [turnCount, setTurnCount] = useState<number>(0);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [turnStartedAt, setTurnStartedAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(-1);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]); // Optimistic UI
  const [isEarlyExiting, setIsEarlyExiting] = useState(false);
  const [myName, setMyName] = useState<string>("");
  const myNameRef = useRef<string>(""); // ref로 동기적 접근 가능
  const [isObserver, setIsObserver] = useState(false);
  const hasJoinedRef = useRef(false);
  const isDeletedRef = useRef(false);
  const [debateSettings, setDebateSettings] = useState<DebateSettings | null>(null);
  
  // 세션 ID 초기화
  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  // 방 입장 API 호출
  const joinRoomApi = useCallback(async () => {
    // 세션 ID가 없으면 대기
    if (!sessionId) {
      return null;
    }
    
    try {
      // 사용자 이름이 없으면 세션 스토리지에서 가져오거나 생성
      let userName = user?.name;
      if (!userName) {
        const STORAGE_KEY = `debate_anon_name_${issueId}`;
        let storedName = sessionStorage.getItem(STORAGE_KEY);
        
        if (!storedName) {
          const randomId = Math.floor(Math.random() * 10000);
          storedName = `익명의 토론자 ${randomId}`;
          sessionStorage.setItem(STORAGE_KEY, storedName);
        }
        userName = storedName;
      }
      
      const res = await fetch(`/api/realtime/rooms/${issueId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId,
          userName, 
          stance: userStance 
        }),
      });

      if (!res.ok) {
        if (res.status === 404) {
          setRoomDeleted(true);
          router.push("/");
          return null;
        }
        throw new Error("Failed to join room");
      }

      const data = await res.json();
      setHasJoined(true);
      
      // 역할 설정
      if (data.myRole) {
        setMyRole(data.myRole);
        setIsObserver(data.myRole === 'observer');
      }
      
      return { ...data, myName: userName };
    } catch (error) {
      console.error("Failed to join room:", error);
      return null;
    }
  }, [issueId, user, userStance, router, sessionId]);

  // API 호출 함수들
  const fetchRoomData = useCallback(async () => {
    if (roomDeleted || isDeletedRef.current) return;
    
    try {
      const requestTime = Date.now();
      const res = await fetch(`/api/realtime/rooms/${issueId}`);
      
      // 방이 삭제되었으면 이슈 페이지로 리다이렉트
      if (res.status === 404) {
        if (!isDeletedRef.current) {
          isDeletedRef.current = true;
          setRoomDeleted(true);
          setIsConnected(false);
          alert("⚠️ 토론이 종료되었습니다.\n\n상대방이 퇴장하여 토론방이 삭제되었습니다.");
          router.push("/");
        }
        return;
      }
      
      if (!res.ok) throw new Error("Room not found");

      const data = await res.json();
      
      // 서버 시간 동기화 (오차 계산)
      if (data.current_time) {
        const serverTime = new Date(data.current_time).getTime();
        const responseTime = Date.now();
        // 네트워크 지연 시간(RTT/2)을 고려하여 서버 시간 추정
        // 하지만 간단하게 응답 받은 시점의 서버 시간과 로컬 시간의 차이만 계산해도 충분함
        const offset = serverTime - responseTime;
        setServerTimeOffset(offset);
      }
      
      if (data.settings) {
        setDebateSettings(data.settings);
      }
      
      const messagesArray = Array.isArray(data.messages) ? data.messages : [];
      const serverMessages = messagesArray.map((m: any) => ({
          ...m,
          timestamp: m.created_at ? new Date(m.created_at) : new Date(),
          senderName: m.sender_name,
          sender_session_id: m.sender_session_id,
        }));
      setMessages(serverMessages);
      
      // Pending 메시지 정리 (서버에 반영된 것 제거)
      setPendingMessages(prev => prev.filter(p => !serverMessages.some((m: any) => 
          m.content === p.content && 
          m.sender_session_id === p.sender_session_id // && timestamp check if needed
      )));

      setParticipants(Array.isArray(data.participants) ? data.participants : []);
      setStage((data.stage as DebateStage) || 'waiting');
      setStageStartedAt(data.stage_started_at ? new Date(data.stage_started_at) : new Date());
      setLogicScorePro(data.logic_score_pro || 50);
      setLogicScoreCon(data.logic_score_con || 50);
      
      // 발언권 정보 업데이트
      const speaker = data.current_speaker || null;
      const turnOwner = data.current_turn_owner || null;
      const tCount = data.turn_count || 0;
      const phaseStart = data.phase_start_time ? new Date(data.phase_start_time) : (data.turn_started_at ? new Date(data.turn_started_at) : null);

      setCurrentSpeaker(speaker);
      setCurrentTurnOwner(turnOwner);
      setTurnCount(tCount);
      setTurnStartedAt(phaseStart);
      
      const participants = Array.isArray(data.participants) ? data.participants : [];
      
      // 내 참가자 정보 찾기 (session_id 또는 이름으로)
      const currentUserName = myNameRef.current || myName || user?.name || "";
      let myParticipant = participants.find((p: any) => p.user_name === currentUserName);
      
      // 이름으로 못 찾으면 role로 찾기 (내가 저장한 myRole 사용)
      if (!myParticipant && myRole !== 'observer') {
        myParticipant = participants.find((p: any) => p.role === myRole);
      }
      
      const myRoleFromDB = myParticipant?.role || myRole; // DB role 우선
      const myNameFromDB = myParticipant?.user_name;
      
      // [엄격한 턴제] 발언권 판단 로직
      let canSpeak = false;
      if (myRoleFromDB === 'observer') {
        canSpeak = false;
      } else if (data.stage === 'waiting' || data.stage === 'verdict') {
        canSpeak = false;
      } else if (turnOwner) {
        canSpeak = turnOwner === myRoleFromDB;
      } else {
        // Migration 이전 등 turnOwner가 없을 경우 안전한 기본값
        if (data.stage === 'introduction') canSpeak = myRoleFromDB === 'host';
        else canSpeak = false;
      }
      
      console.log('[Turn Debug]', { 
        myNameFromDB, 
        myRoleFromDB, 
        speaker, 
        canSpeak, 
        participants: participants.map((p: any) => ({ name: p.user_name, role: p.role }))
      });
      
      setIsMyTurn(canSpeak);
      
      // 관전자 여부 확인
      setIsObserver(myRoleFromDB === 'observer');
      
      // 턴 시작 시간 업데이트
      if (data.turn_started_at) {
        setTurnStartedAt(new Date(data.turn_started_at));
      }
      
      setIsConnected(true);
    } catch (error) {
      console.error("Failed to fetch room data:", error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [issueId, roomDeleted, router]);

  // 초기 입장 및 폴링 + Heartbeat
  useEffect(() => {
    // 세션 ID가 없으면 대기
    if (!sessionId) return;
    
    let pollingInterval: NodeJS.Timeout;
    let heartbeatInterval: NodeJS.Timeout;

    const initRoom = async () => {
      // 이미 입장 시도했으면 폴링만 시작
      if (hasJoinedRef.current) {
        await fetchRoomData();
        pollingInterval = setInterval(fetchRoomData, 1000);
        return;
      }

      hasJoinedRef.current = true;

      // 먼저 입장 API 호출
      const joinResult = await joinRoomApi();
      if (joinResult) {
        if (joinResult.myName) {
          setMyName(joinResult.myName);
          myNameRef.current = joinResult.myName; // ref도 동시에 업데이트
        }
        // 입장 성공 시 데이터 설정
        const roomData = joinResult.room;
        
        const messagesArray = Array.isArray(joinResult.messages) ? joinResult.messages : [];
        setMessages(
          messagesArray.map((m: any) => ({
            ...m,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
          }))
        );
        setStage(roomData.stage || 'waiting');
        setStageStartedAt(roomData.stage_started_at ? new Date(roomData.stage_started_at) : new Date());
        setLogicScorePro(roomData.logic_score_pro || 50);
        setLogicScoreCon(roomData.logic_score_con || 50);
        setIsConnected(true);
        setIsLoading(false);
      }
      
      // 입장 후 폴링 시작
      pollingInterval = setInterval(fetchRoomData, 1000);
      
      // Heartbeat 시작 (5초마다)
      heartbeatInterval = setInterval(async () => {
        try {
          await fetch(`/api/realtime/rooms/${issueId}/join`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
        } catch (e) {
          console.error("Heartbeat failed:", e);
        }
      }, 5000);
    };

    initRoom();

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [joinRoomApi, fetchRoomData, sessionId, issueId]);

  const timerTriggeredRef = useRef<string>("");

  // 타이머 계산 및 자동 턴 넘기기
  // 타이머 계산 및 자동 턴 넘기기
  // 타이머 계산 및 자동 턴 넘기기
  useEffect(() => {
    if (stage === 'waiting' || stage === 'verdict_pending' || stage === 'ended') {
      setTimeLeft(-1);
      return;
    }

    const config = DEBATE_STAGES[stage];
    let duration = config?.durationSeconds || 60;

    const startTime = turnStartedAt || stageStartedAt;
    
    if (!startTime) return;

    const updateTimer = () => {
      const elapsed = (Date.now() - startTime.getTime()) / 1000;
      const remaining = Math.max(0, Math.ceil(duration - elapsed));
      setTimeLeft(remaining);

      // 시간이 다 되었고, 내 턴이라면 턴 넘기기 요청
      if (remaining === 0 && duration > 0 && isMyTurn) {
        const triggerKey = `${stage}-${turnCount}`;
        if (timerTriggeredRef.current !== triggerKey) {
          timerTriggeredRef.current = triggerKey;
          console.log("Auto switching turn...", triggerKey);
          
          fetch(`/api/realtime/rooms/${issueId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'switch_turn' })
          }).catch(err => console.error("Turn switch failed:", err));
        }
      }
    };

    updateTimer(); // 즉시 실행
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [stage, turnStartedAt, stageStartedAt, turnCount, isMyTurn, issueId]);

  // 메시지 전송
  const handleSendMessage = useCallback(
    async (content: string) => {
      // 발신자 이름 (myNameRef 우선 사용)
      const senderName = myNameRef.current || myName || user?.name || "익명";
      
      // 즉시 UI 업데이트 (pendingMessages 사용) - session_id 포함!
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
        senderName: senderName,
        sender_session_id: sessionId,
        type: 'text',
        fallacyDetected: null,
        factCheckStatus: null,
      };
      setPendingMessages((prev) => [...prev, optimisticMessage]);

      try {
        const res = await fetch(`/api/realtime/rooms/${issueId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            role: "user",
            senderName: senderName,
            stance: userStance,
            sessionId: sessionId,
          }),
        });

        // 발언권 없음 응답 처리
        if (res.status === 403) {
          const errorData = await res.json();
          if (errorData.error === "NOT_YOUR_TURN") {
            // 낙관적 업데이트 롤백
            setPendingMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
            alert(`⏳ ${errorData.message}\n\n상대방의 발언이 끝나면 발언할 수 있습니다.`);
            return;
          }
        }

        if (!res.ok) throw new Error("Failed to send message");

        const data = await res.json();
        
        // 상태 업데이트
        if (data.room) {
             setStage(data.room.stage as DebateStage);
             setStageStartedAt(new Date(data.room.stage_started_at));
             setLogicScorePro(data.room.logic_score_pro);
             setLogicScoreCon(data.room.logic_score_con);
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        // 실패 시 낙관적 업데이트 롤백
        setPendingMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      }
    },
    [issueId, user, userStance]
  );

  // 팩트체크 요청
  const handleFactCheck = useCallback(
    async (claim: string) => {
      try {
        const res = await fetch(`/api/realtime/rooms/${issueId}/factcheck`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            claim,
            senderName: user?.name || "익명",
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          if (error.error === "NOT_YOUR_TURN") {
            alert("팩트체크는 자신의 발언 차례에만 요청할 수 있습니다.");
          }
          return;
        }

        const data = await res.json();

        // 메시지 추가
        const newMessages = data.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));

        setMessages((prev) => [...prev, ...newMessages]);
      } catch (error) {
        console.error("Failed to request fact check:", error);
      }
    },
    [issueId, user]
  );

  // 단계 수동 전환
  const handleAdvanceStage = useCallback(async () => {
    const nextStage = getNextStage(stage);
    if (!nextStage) return;

    try {
      const res = await fetch(`/api/realtime/rooms/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "advance_stage",
          newStage: nextStage,
        }),
      });

      if (!res.ok) throw new Error("Failed to advance stage");

      const data = await res.json();
      setStage(data.room.stage);
      setStageStartedAt(new Date(data.room.stage_started_at));
      if (data.room.turn_started_at) {
        setTurnStartedAt(new Date(data.room.turn_started_at));
      }

      if (data.message) {
        setMessages((prev) => [
          ...prev,
          {
            ...data.message,
            timestamp: new Date(data.message.timestamp),
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to advance stage:", error);
    }
  }, [issueId, stage]);

  // 타이머 종료 시 자동 전환
  // 현재 단계의 제한 시간 계산
  const getCurrentDuration = useCallback(() => {
    // 설정보다 Stage Config 우선 사용 (Strict Mode)
    // DEBATE_STAGES는 import 되어 있어야 함
    return DEBATE_STAGES[stage]?.durationSeconds || 60;
  }, [stage]);

  const handleTimeUp = useCallback(() => {
    handleAdvanceStage();
  }, [handleAdvanceStage]);

  // 토론방 퇴장 핸들러
  const handleLeaveRoom = useCallback(async () => {
    if (isLeaving || !sessionId) return;
    setIsLeaving(true);

    try {
      // 퇴장 API 호출 (세션 기반)
      await fetch(`/api/realtime/rooms/${issueId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      router.push("/");
    } catch (error) {
      console.error("Failed to leave room:", error);
      router.push("/");
    }
  }, [issueId, router, isLeaving, sessionId]);

  // 페이지 언마운트 시 퇴장 처리 (브라우저 닫기/새로고침)
  useEffect(() => {
    if (!sessionId) return;
    
    const handleBeforeUnload = () => {
      // sendBeacon으로 비동기 요청 (브라우저 종료 시에도 전송됨)
      navigator.sendBeacon(
        `/api/realtime/rooms/${issueId}/leave`,
        JSON.stringify({ sessionId })
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [issueId, sessionId]);

  // 내 점수 (입장에 따라)
  const myScore = userStance === "agree" ? logicScorePro : logicScoreCon;
  const opponentScore = userStance === "agree" ? logicScoreCon : logicScorePro;

  // [엄격한 턴제] 입력 비활성화 조건
  const isInputDisabled = stage === "waiting" || stage === "verdict_pending" || stage === "ended" || isObserver || !isMyTurn;
  
  // 발언권 메시지 생성
  let turnMessage: string | null = null;
  if (isObserver) {
    turnMessage = "👀 관전 모드입니다 (발언 불가)";
  } else if (stage === "waiting") {
    turnMessage = "⏳ 상대방을 기다리는 중입니다...";
  } else if (stage === "verdict_pending") {
    turnMessage = "🤖 AI가 판정 중입니다...";
  } else if (stage === "ended") {
    turnMessage = "🏁 토론이 종료되었습니다.";
  } else if (!isMyTurn) {
      if (currentTurnOwner) {
         const owner = participants.find(p => p.role === currentTurnOwner);
         const ownerName = owner?.user_name || (currentTurnOwner === 'host' ? '찬성 측' : '반대 측');
         turnMessage = `🔊 ${ownerName}님이 발언 중입니다...`;
      } else {
         turnMessage = "⏳ 상대방의 발언을 기다리는 중...";
      }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="flex gap-2 justify-center mb-4">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" />
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce delay-100" />
            <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce delay-200" />
          </div>
          <p className="text-muted-foreground">토론장에 입장 중...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 헤더 */}
      <header className="flex items-center justify-between mb-6 max-w-7xl mx-auto w-full">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleLeaveRoom}
          disabled={isLeaving}
        >
          {isLeaving ? (
            <>퇴장 중...</>
          ) : (
            <>
              <LogOut className="w-4 h-4 mr-2" /> 나가기
            </>
          )}
        </Button>
        <h1 className="text-xl font-bold text-center">
          주제:{" "}
          <span className="text-blue-400 capitalize">
            {issueId?.toString().replace(/-/g, " ")}
          </span>
        </h1>
        <div className="w-20" />
      </header>

      {/* [New] 상단 스테이지 표시줄 */}
      <div className="max-w-7xl mx-auto w-full mb-4 px-4">
        <div className="bg-secondary/20 border border-white/10 rounded-xl p-4 flex items-center justify-between shadow-lg backdrop-blur-sm">
           <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isMyTurn ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                 {isMyTurn ? '🎤 나의 턴' : '⏳ 대기 중'}
              </div>
              <div>
                 <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                   {DEBATE_STAGES[stage]?.nameKr || stage}
                 </h2>
                 <p className="text-xs text-muted-foreground">
                   {DEBATE_STAGES[stage]?.description}
                 </p>
              </div>
           </div>
           
           {/* 조기 종료 버튼 */}
           {isMyTurn && timeLeft > 0 && DEBATE_STAGES[stage]?.durationSeconds > 0 && (
             <Button 
               onClick={async () => {
                  try {
                    setIsEarlyExiting(true);
                    await fetch(`/api/realtime/rooms/${issueId}`, {
                      method: 'PATCH',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ action: 'switch_turn' }) // switch_turn -> nextStage
                    });
                  } catch(e) { console.error(e); }
                  finally { setIsEarlyExiting(false); }
               }}
               disabled={isEarlyExiting}
               variant="secondary"
               className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20"
             >
               발언 종료 (턴 넘기기)
             </Button>
           )}
        </div>
      </div>

      <div className="flex-1 flex gap-6 max-w-7xl mx-auto w-full">
      {/* 좌측 패널 */}
      <div className="hidden lg:flex flex-col gap-4 w-72">
        {/* 연결 상태 */}
        <div className="flex items-center gap-2 px-4 py-2 bg-card/30 rounded-lg border border-white/5">
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-500">연결됨</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-500">연결 끊김</span>
            </>
          )}
        </div>

        {/* 내 입장 */}
        <div className="p-4 bg-card/30 rounded-xl border border-white/5">
          <h3 className="font-bold mb-2 text-sm text-muted-foreground">나의 입장</h3>
          <div
            className={cn(
              "text-2xl font-bold capitalize",
              userStance === "agree"
                ? "text-blue-400"
                : userStance === "disagree"
                ? "text-red-400"
                : "text-gray-400"
            )}
          >
            {stanceLabel}
          </div>
        </div>

        {/* 토론 타이머 */}
        <DebateTimer
          stage={stage}
          stageStartedAt={stageStartedAt}
          turnStartedAt={turnStartedAt}
          currentSpeaker={currentSpeaker}
          isMyTurn={isMyTurn}
          onTimeUp={handleTimeUp}
          serverTimeOffset={serverTimeOffset}
          duration={getCurrentDuration()}
        />

        {/* 논리 점수 */}
        <div className="p-4 bg-card/30 rounded-xl border border-white/5 flex-1">
          <h3 className="font-bold mb-4 text-sm text-muted-foreground">논리 점수</h3>
          <div className="flex justify-around">
            <div className="text-center">
              <LogicThermometer score={myScore} />
              <p className="text-xs text-muted-foreground mt-2">나</p>
            </div>
            <div className="text-center">
              <LogicThermometer score={opponentScore} />
              <p className="text-xs text-muted-foreground mt-2">상대</p>
            </div>
          </div>
        </div>

        {/* 수동 단계 전환 버튼 (토론 시작 후에만 표시) */}
        {/* 수동 단계 전환 버튼 (토론 시작 후에만 표시) */}
        {stage !== "verdict_pending" && stage !== "ended" && stage !== "waiting" && participants.length >= 2 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdvanceStage}
            className="gap-2"
          >
            <SkipForward className="w-4 h-4" />
            다음 단계로
          </Button>
        )}
      </div>

      {/* 중앙: 채팅 */}
      <div className="flex-1">
        <ChatInterface
          messages={[...messages, ...pendingMessages].sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime())}
          onSendMessage={handleSendMessage}
          typingUsers={typingUsers}
          disabled={isInputDisabled}
          stage={stage}
          turnMessage={turnMessage}
          isMyTurn={isMyTurn}
          onFactCheck={handleFactCheck}
          myName={myNameRef.current || myName || user?.name || "익명의 토론자"}
          mySessionId={sessionId || ""}
          timeLeft={timeLeft}
        />
      </div>

      {/* 우측 패널 */}
      <div className="hidden lg:flex flex-col gap-4 w-72">
        {/* 참가자 목록 */}
        <ParticipantList
          participants={participants}
          typingUsers={typingUsers}
          myName={user?.name}
        />

        {/* 단계 진행 표시 */}
        <div className="p-4 bg-card/30 rounded-xl border border-white/5">
          <h3 className="font-bold mb-3 text-sm text-muted-foreground">토론 단계</h3>
          <div className="space-y-2">
            {(Object.keys(DEBATE_STAGES) as DebateStage[])
              .filter(s => s !== 'waiting' && s !== 'ended') // Show only main stages
              .map((s, idx) => {
              const config = DEBATE_STAGES[s];
              const isCurrent = stage === s;
              // Simple strict comparison might be tricky with object keys order.
              // Use explicit list if needed. But Object.keys on DEBATE_STAGES is definition order (Wait, check debateStages.ts). 
              // DEBATE_STAGES is const object. Order is generally preserved.
              // Better logic: Find index in keys.
              const allStages = Object.keys(DEBATE_STAGES) as DebateStage[];
              const currentIndex = allStages.indexOf(stage);
              const thisIndex = allStages.indexOf(s);
              const isPast = currentIndex > thisIndex;

              return (
                <div
                  key={s}
                  className={cn(
                    "flex items-center gap-2 text-sm p-2 rounded-lg transition-colors",
                    isCurrent
                      ? "bg-blue-500/20 text-blue-400"
                      : isPast
                      ? "text-green-400"
                      : "text-muted-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      isCurrent
                        ? "bg-blue-500 animate-pulse"
                        : isPast
                        ? "bg-green-500"
                        : "bg-gray-500"
                    )}
                  />
                  <span>{config.nameKr}</span>
                  {isCurrent && (
                    <span className="text-xs ml-auto">진행 중</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

export default function DebatePage() {
  return (
    <main className="min-h-screen bg-background p-4 flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500" />

      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-10">토론장 입장 중...</div>
          </div>
        }
      >
        <DebateContent />
      </Suspense>
    </main>
  );
}
