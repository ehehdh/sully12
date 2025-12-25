// Enhanced in-memory store for debate rooms
// In production, this would be replaced with Supabase/PostgreSQL

import { DebateStage, DebateSettings } from './database.types';

export type Message = {
  id: string;
  role: "user" | "moderator" | "system" | "opponent";
  content: string;
  timestamp: Date;
  senderName?: string;
  type?: "text" | "fact-check" | "fallacy-alert" | "stage-change" | "verdict";
  fallacyDetected?: string | null;
  factCheckStatus?: string | null;
};

export type Room = {
  id: string;
  topic: string;
  title?: string; // 방 제목
  description?: string; // 방 설명
  stance: "agree" | "disagree" | "neutral";
  settings: DebateSettings; // 토론 설정
  participants: string[];
  messages: Message[];
  logicScore: number; // Legacy
  logicScorePro: number;
  logicScoreCon: number;
  stage: DebateStage;
  stageStartedAt: string;
  createdAt: Date;
  // 발언권 관리
  currentTurn: number; // 현재 발언자의 인덱스 (0 또는 1)
  isSpeaking: boolean; // 현재 발언 중인지
  lastSpeaker: string | null; // 마지막 발언자 이름
  turnStartedAt: string; // 현재 턴 시작 시간
  observers: string[]; // 관전자 목록
};

// Global store with HMR support
const globalForStore = global as unknown as { store: { rooms: Room[] } };

export const store = globalForStore.store || {
  rooms: []
};

if (process.env.NODE_ENV !== 'production') globalForStore.store = store;

export const getRooms = () => store.rooms;

export const createRoom = (
  topic: string, 
  stance: "agree" | "disagree" | "neutral", 
  creatorName: string,
  title?: string,
  description?: string,
  settings?: DebateSettings
): Room => {
  const now = new Date();
  
  // 기본 설정
  const defaultSettings: DebateSettings = {
    introduction: { duration: 60, turns: 1 },
    rebuttal: { duration: 120, turns: 1 },
    cross: { duration: 180, turns: 1 },
    closing: { duration: 60, turns: 1 }
  };
  
  const newRoom: Room = {
    id: Math.random().toString(36).substring(7),
    topic,
    title: title || topic,
    description,
    stance,
    settings: settings || defaultSettings,
    participants: [creatorName],
    messages: [{
      id: "system-1",
      role: "moderator",
      content: `🏟️ **토론방 개설**\n\n주제: **${topic}**\n\n상대방을 기다리는 중입니다. 상대방이 입장하면 입론 단계가 시작됩니다.`,
      timestamp: now,
      type: "text"
    }],
    logicScore: 50,
    logicScorePro: 50,
    logicScoreCon: 50,
    stage: 'waiting',
    stageStartedAt: now.toISOString(),
    createdAt: now,
    // 발언권 초기화
    currentTurn: 0, // 방 만든 사람이 첫 발언
    isSpeaking: false,
    lastSpeaker: null,
    turnStartedAt: now.toISOString(),
    observers: [],
  };
  
  store.rooms.push(newRoom);
  return newRoom;
};

export const joinRoom = (roomId: string, userName: string): Room | null => {
  const room = store.rooms.find(r => r.id === roomId);
  
  if (room) {
    // 이미 참가자인 경우
    if (room.participants.includes(userName)) {
      return room;
    }
    
    // 이미 관전자인 경우
    if (room.observers.includes(userName)) {
      return room;
    }
    
    // 참가자 정원(2명) 체크
    if (room.participants.length < 2) {
      room.participants.push(userName);
      
      // 시스템 메시지: 사용자 입장
      room.messages.push({
        id: Date.now().toString(),
        role: "system",
        content: `👋 ${userName} 님이 토론자로 입장하셨습니다.`,
        timestamp: new Date(),
        type: "text"
      });
      console.log(`[joinRoom] ${userName} joined room ${roomId} as participant.`);
    } else {
      // 정원 초과 시 관전자로 입장
      room.observers.push(userName);
      
      // 시스템 메시지: 관전자 입장
      room.messages.push({
        id: Date.now().toString(),
        role: "system",
        content: `👀 ${userName} 님이 관전자로 입장하셨습니다.`,
        timestamp: new Date(),
        type: "text"
      });
      console.log(`[joinRoom] ${userName} joined room ${roomId} as observer.`);
    }

    // 2명 이상이고 아직 대기 중이면 토론 시작
    console.log(`[joinRoom] Checking start condition: participants=${room.participants.length}, stage=${room.stage}`);
    
    if (room.participants.length >= 2 && room.stage === 'waiting') {
      const now = new Date();
      room.stage = 'opening_pro';
      room.stageStartedAt = now.toISOString();
      // 첫 발언자(방 생성자)의 턴 시작
      room.turnStartedAt = now.toISOString();
      room.currentTurn = 0;
      
      room.messages.push({
        id: (Date.now() + 1).toString(),
        role: "moderator",
        content: `📢 **[입론 단계 시작]**\n\n양측 모두 입장하셨습니다!\n\n**${room.participants[0]}** 님부터 발언해주세요.\n\n이제부터 양측은 주제에 대한 기본 입장을 1분 내에 발표해주세요.\n\n✅ 핵심 주장을 명확하게\n✅ 근거를 간결하게 제시\n❌ 상대방 공격 금지 (입론 단계)`,
        timestamp: new Date(),
        type: "stage-change"
      });
      
      console.log(`[joinRoom] Debate started in room ${roomId}! First speaker: ${room.participants[0]}`);
    }
    
    return room;
  }
  
  return null;
};

export const addMessage = (roomId: string, message: Message): Room | null => {
  const room = store.rooms.find(r => r.id === roomId);
  
  if (room) {
    room.messages.push(message);
    return room;
  }
  
  return null;
};

export const updateRoomStage = (
  roomId: string, 
  stage: DebateStage
): Room | null => {
  const room = store.rooms.find(r => r.id === roomId);
  
  if (room) {
    room.stage = stage;
    room.stageStartedAt = new Date().toISOString();
    return room;
  }
  
  return null;
};

export const updateLogicScores = (
  roomId: string, 
  proChange: number, 
  conChange: number
): Room | null => {
  const room = store.rooms.find(r => r.id === roomId);
  
  if (room) {
    room.logicScorePro = Math.min(100, Math.max(0, room.logicScorePro + proChange));
    room.logicScoreCon = Math.min(100, Math.max(0, room.logicScoreCon + conChange));
    return room;
  }
  
  return null;
};

// 참가자 퇴장
export const leaveRoom = (roomId: string, userName: string): { room: Room | null; deleted: boolean } => {
  const roomIndex = store.rooms.findIndex(r => r.id === roomId);
  
  if (roomIndex === -1) {
    return { room: null, deleted: false };
  }
  
  const room = store.rooms[roomIndex];
  
  // 참가자 목록에서 제거
  room.participants = room.participants.filter(p => p !== userName);
  
  // 퇴장 메시지 추가
  room.messages.push({
    id: Date.now().toString(),
    role: "system",
    content: `👋 ${userName} 님이 퇴장하셨습니다.`,
    timestamp: new Date(),
    type: "text"
  });
  
  // 모든 참가자가 나가면 방 삭제
  if (room.participants.length === 0) {
    store.rooms.splice(roomIndex, 1);
    console.log(`Room ${roomId} deleted: all participants left`);
    return { room: null, deleted: true };
  }
  
  return { room, deleted: false };
};

// 방 직접 삭제
export const deleteRoom = (roomId: string): boolean => {
  const roomIndex = store.rooms.findIndex(r => r.id === roomId);
  
  if (roomIndex !== -1) {
    store.rooms.splice(roomIndex, 1);
    console.log(`Room ${roomId} manually deleted`);
    return true;
  }
  
  return false;
};

// 빈 방 정리 (주기적 호출용)
export const cleanupEmptyRooms = (): number => {
  const initialCount = store.rooms.length;
  store.rooms = store.rooms.filter(room => room.participants.length > 0);
  const deletedCount = initialCount - store.rooms.length;
  
  if (deletedCount > 0) {
    console.log(`Cleanup: ${deletedCount} empty rooms deleted`);
  }
  
  return deletedCount;
};

// ============================================================
// 발언권 관리 함수들
// ============================================================

// 발언 가능 여부 확인
export const canSpeak = (roomId: string, userName: string): boolean => {
  const room = store.rooms.find(r => r.id === roomId);
  if (!room) return false;
  
  // 대기 중이거나 판정 중에는 발언 불가
  if (room.stage === 'waiting' || room.stage === 'verdict_pending') return false;
  
  // 참가자가 2명 미만이면 자유 발언
  if (room.participants.length < 2) return true;
  
  // 현재 발언 중이면 다른 사람 발언 불가
  if (room.isSpeaking && room.lastSpeaker !== userName) return false;
  
  // 현재 턴인 사람만 발언 가능
  const currentSpeaker = room.participants[room.currentTurn];
  return currentSpeaker === userName;
};

// 발언 시작
export const startSpeaking = (roomId: string, userName: string): boolean => {
  const room = store.rooms.find(r => r.id === roomId);
  if (!room) return false;
  
  if (!canSpeak(roomId, userName)) return false;
  
  room.isSpeaking = true;
  room.lastSpeaker = userName;
  console.log(`[Turn] ${userName} started speaking in room ${roomId}`);
  return true;
};

// 발언 종료 및 턴 넘기기
export const endSpeaking = (roomId: string, userName: string): boolean => {
  const room = store.rooms.find(r => r.id === roomId);
  if (!room) return false;
  
  if (room.lastSpeaker !== userName) return false;
  
  room.isSpeaking = false;
  
  // 턴 넘기기 (0 -> 1 -> 0 -> 1...)
  if (room.participants.length >= 2) {
    room.currentTurn = (room.currentTurn + 1) % room.participants.length;
    // 새 턴 시작 시간 기록
    room.turnStartedAt = new Date().toISOString();
  }
  
  const nextSpeaker = room.participants[room.currentTurn];
  console.log(`[Turn] ${userName} ended speaking. Next turn: ${nextSpeaker}, Turn started at: ${room.turnStartedAt}`);
  
  return true;
};

// 현재 발언자 정보 조회
export const getTurnInfo = (roomId: string): { 
  currentSpeaker: string | null; 
  isSpeaking: boolean;
  turnIndex: number;
} | null => {
  const room = store.rooms.find(r => r.id === roomId);
  if (!room) return null;
  
  return {
    currentSpeaker: room.participants[room.currentTurn] || null,
    isSpeaking: room.isSpeaking,
    turnIndex: room.currentTurn,
  };
};

