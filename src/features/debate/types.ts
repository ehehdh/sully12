/**
 * 토론 관련 타입 정의
 */

// 토론 방 상태
export interface DebateRoom {
  id: string;
  topic: string;
  title: string;
  description?: string;
  status: RoomStatus;
  stage: DebateStage;
  settings: DebateSettings;
  participants: Participant[];
  observers: Observer[];
  scores: DebateScores;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
}

// 방 상태
export type RoomStatus = 'waiting' | 'in_progress' | 'paused' | 'ended' | 'abandoned';

// 토론 단계 (전체 목록)
export type DebateStage =
  | 'waiting'
  | 'opening_pro'
  | 'opening_con'
  | 'cross_exam_con_ask'
  | 'cross_exam_pro_answer'
  | 'cross_exam_pro_ask'
  | 'cross_exam_con_answer'
  | 'rebuttal_con'
  | 'rebuttal_pro'
  | 'closing_con'
  | 'closing_pro'
  | 'verdict_pending'
  | 'ended';

// 토론 설정
export interface DebateSettings {
  maxParticipants: number;
  allowSpectators: boolean;
  stageDurations: Record<DebateStage, number>;
  enableAIModeration: boolean;
  enableVoting: boolean;
}

// 참가자
export interface Participant {
  id: string;
  sessionId: string;
  userId?: string; // 로그인 사용자의 경우
  displayName: string;
  stance: 'pro' | 'con';
  role: 'host' | 'opponent';
  isOnline: boolean;
  joinedAt: Date;
  lastActiveAt: Date;
}

// 관전자
export interface Observer {
  id: string;
  sessionId: string;
  displayName: string;
  joinedAt: Date;
}

// 점수
export interface DebateScores {
  pro: number;
  con: number;
  history: ScoreChange[];
}

// 점수 변동 기록
export interface ScoreChange {
  timestamp: Date;
  side: 'pro' | 'con';
  change: number;
  reason: string;
}

// 메시지
export interface DebateMessage {
  id: string;
  roomId: string;
  senderId?: string;
  senderName: string;
  role: 'user' | 'moderator' | 'system' | 'opponent';
  content: string;
  type: MessageType;
  metadata?: MessageMetadata;
  createdAt: Date;
}

// 메시지 타입
export type MessageType = 
  | 'text'
  | 'stage-change'
  | 'fallacy-alert'
  | 'fact-check'
  | 'verdict'
  | 'system';

// 메시지 메타데이터
export interface MessageMetadata {
  fallacyDetected?: string;
  factCheckStatus?: 'verified' | 'disputed' | 'unverified';
  scoreChange?: number;
  stage?: DebateStage;
}

// 단계 설정
export interface StageConfig {
  id: DebateStage;
  name: string;
  nameKr: string;
  description: string;
  durationSeconds: number;
  turnOwner: 'host' | 'opponent' | null;
  nextStage: DebateStage | null;
  aiIntroMessage: string;
}

// 방 생성 요청
export interface CreateRoomRequest {
  topic: string;
  title: string;
  description?: string;
  creatorName: string;
  creatorStance: 'pro' | 'con';
  settings?: Partial<DebateSettings>;
}

// 방 참가 요청
export interface JoinRoomRequest {
  roomId: string;
  sessionId: string;
  displayName: string;
  preferredStance?: 'pro' | 'con';
}

// 방 목록 필터
export interface RoomListFilter {
  status?: RoomStatus;
  topic?: string;
  hasOpenSpot?: boolean;
  sortBy?: 'created_at' | 'participants';
  order?: 'asc' | 'desc';
}
