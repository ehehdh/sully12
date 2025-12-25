import { create } from 'zustand';
import { DebateStage, Message, Participant } from './database.types';

// ============================================================
// 사용자 정보 타입
// ============================================================

type PoliticalStance = {
  economic: number;
  social: number;
  diplomatic: number;
};

type User = {
  id?: string;
  name: string;
  politicalStance: PoliticalStance;
};

// ============================================================
// 실시간 토론방 상태 타입
// ============================================================

interface RealtimeDebateState {
  roomId: string | null;
  topic: string;
  stage: DebateStage;
  stageStartedAt: Date | null;
  messages: Message[];
  participants: Participant[];
  logicScorePro: number;
  logicScoreCon: number;
  myParticipantId: string | null;
  isConnected: boolean;
}

// ============================================================
// 전체 앱 상태
// ============================================================

interface AppState {
  // 사용자 정보
  user: User | null;
  setUser: (user: User) => void;

  // 실시간 토론방 상태
  debate: RealtimeDebateState;
  setRoomId: (roomId: string | null) => void;
  setTopic: (topic: string) => void;
  setStage: (stage: DebateStage) => void;
  setStageStartedAt: (date: Date | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setParticipants: (participants: Participant[]) => void;
  updateParticipant: (participantId: string, updates: Partial<Participant>) => void;
  setScores: (pro: number, con: number) => void;
  setMyParticipantId: (id: string | null) => void;
  setIsConnected: (connected: boolean) => void;
  resetDebate: () => void;

  // 타이핑 상태
  typingUsers: string[];
  setTypingUsers: (users: string[]) => void;
}

const initialDebateState: RealtimeDebateState = {
  roomId: null,
  topic: '',
  stage: 'waiting',
  stageStartedAt: null,
  messages: [],
  participants: [],
  logicScorePro: 50,
  logicScoreCon: 50,
  myParticipantId: null,
  isConnected: false,
};

export const useAppStore = create<AppState>((set, get) => ({
  // 사용자 정보
  user: null,
  setUser: (user) => set({ user }),

  // 실시간 토론방 상태
  debate: initialDebateState,
  
  setRoomId: (roomId) => 
    set((state) => ({ debate: { ...state.debate, roomId } })),
  
  setTopic: (topic) => 
    set((state) => ({ debate: { ...state.debate, topic } })),
  
  setStage: (stage) => 
    set((state) => ({ debate: { ...state.debate, stage } })),
  
  setStageStartedAt: (date) => 
    set((state) => ({ debate: { ...state.debate, stageStartedAt: date } })),
  
  setMessages: (messages) => 
    set((state) => ({ debate: { ...state.debate, messages } })),
  
  addMessage: (message) => 
    set((state) => ({ 
      debate: { 
        ...state.debate, 
        messages: [...state.debate.messages, message] 
      } 
    })),
  
  setParticipants: (participants) => 
    set((state) => ({ debate: { ...state.debate, participants } })),
  
  updateParticipant: (participantId, updates) =>
    set((state) => ({
      debate: {
        ...state.debate,
        participants: state.debate.participants.map((p) =>
          p.id === participantId ? { ...p, ...updates } : p
        ),
      },
    })),
  
  setScores: (pro, con) =>
    set((state) => ({
      debate: {
        ...state.debate,
        logicScorePro: pro,
        logicScoreCon: con,
      },
    })),
  
  setMyParticipantId: (id) =>
    set((state) => ({ debate: { ...state.debate, myParticipantId: id } })),
  
  setIsConnected: (connected) =>
    set((state) => ({ debate: { ...state.debate, isConnected: connected } })),
  
  resetDebate: () => set({ debate: initialDebateState }),

  // 타이핑 상태
  typingUsers: [],
  setTypingUsers: (users) => set({ typingUsers: users }),
}));
