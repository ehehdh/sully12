/**
 * 관리자 관련 타입 정의
 */

// 관리자 대시보드 통계
export interface AdminDashboardStats {
  totalDebates: number;
  activeDebates: number;
  totalUsers: number;
  activeUsers: number;
  avgDebateDuration: number;
  topTopics: TopicStats[];
}

// 주제별 통계
export interface TopicStats {
  topicId: string;
  title: string;
  debateCount: number;
  avgScore: number;
}

// 토론 주제 관리
export interface TopicManagement {
  id: string;
  title: string;
  description: string;
  category: string;
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
  debateCount: number;
}

// 사용자 관리
export interface UserManagement {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'moderator' | 'admin';
  status: 'active' | 'suspended' | 'banned';
  debatesParticipated: number;
  debatesWon: number;
  createdAt: Date;
  lastActiveAt?: Date;
}

// AI 프롬프트 설정
export interface PromptSetting {
  id: string;
  name: string;
  category: 'fallacy' | 'fact' | 'toxicity' | 'verdict' | 'opponent';
  currentVersion: string;
  content: string;
  isActive: boolean;
  lastUpdatedAt: Date;
  lastUpdatedBy: string;
}

// 시스템 설정
export interface SystemSettings {
  maxRoomsPerUser: number;
  maxParticipantsPerRoom: number;
  defaultDebateDuration: number;
  enableAIModeration: boolean;
  enableSpectatorMode: boolean;
  maintenanceMode: boolean;
}

// 관리자 액션 로그
export interface AdminActionLog {
  id: string;
  adminId: string;
  action: AdminAction;
  targetType: 'user' | 'topic' | 'debate' | 'setting';
  targetId: string;
  details: string;
  timestamp: Date;
}

export type AdminAction = 
  | 'create'
  | 'update'
  | 'delete'
  | 'suspend'
  | 'restore'
  | 'ban'
  | 'unban';
