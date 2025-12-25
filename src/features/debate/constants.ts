/**
 * 토론 관련 상수
 */

import { DebateSettings, DebateStage, StageConfig } from './types';

// 기본 토론 설정
export const DEFAULT_DEBATE_SETTINGS: DebateSettings = {
  maxParticipants: 2,
  allowSpectators: false,
  stageDurations: {
    waiting: 0,
    opening_pro: 180,
    opening_con: 180,
    cross_exam_con_ask: 60,
    cross_exam_pro_answer: 90,
    cross_exam_pro_ask: 60,
    cross_exam_con_answer: 90,
    rebuttal_con: 120,
    rebuttal_pro: 120,
    closing_con: 60,
    closing_pro: 60,
    verdict_pending: 0,
    ended: 0,
  },
  enableAIModeration: true,
  enableVoting: false,
};

// 토론 단계 순서
export const STAGE_ORDER: DebateStage[] = [
  'waiting',
  'opening_pro',
  'opening_con',
  'cross_exam_con_ask',
  'cross_exam_pro_answer',
  'cross_exam_pro_ask',
  'cross_exam_con_answer',
  'rebuttal_con',
  'rebuttal_pro',
  'closing_con',
  'closing_pro',
  'verdict_pending',
  'ended',
];

// 단계별 상세 설정
export const STAGE_CONFIGS: Record<DebateStage, StageConfig> = {
  waiting: {
    id: 'waiting',
    name: 'Waiting',
    nameKr: '대기 중',
    description: '참가자를 기다리는 중입니다.',
    durationSeconds: 0,
    turnOwner: null,
    nextStage: 'opening_pro',
    aiIntroMessage: '상대방이 입장하면 토론이 시작됩니다.',
  },
  opening_pro: {
    id: 'opening_pro',
    name: 'Opening Pro',
    nameKr: '찬성 측 입론',
    description: '찬성 측이 입론을 진행합니다. (3분)',
    durationSeconds: 180,
    turnOwner: 'host',
    nextStage: 'opening_con',
    aiIntroMessage: '🔵 [찬성 측 입론] 시작합니다. (3분)',
  },
  opening_con: {
    id: 'opening_con',
    name: 'Opening Con',
    nameKr: '반대 측 입론',
    description: '반대 측이 입론을 진행합니다. (3분)',
    durationSeconds: 180,
    turnOwner: 'opponent',
    nextStage: 'cross_exam_con_ask',
    aiIntroMessage: '🔴 [반대 측 입론] 시작합니다. (3분)',
  },
  cross_exam_con_ask: {
    id: 'cross_exam_con_ask',
    name: 'Cross Exam Con Ask',
    nameKr: '반대 측 질문',
    description: '반대 측이 찬성 측에게 질문합니다. (1분)',
    durationSeconds: 60,
    turnOwner: 'opponent',
    nextStage: 'cross_exam_pro_answer',
    aiIntroMessage: '⚔️ [교차 조사] 반대 측이 질문합니다. (1분)',
  },
  cross_exam_pro_answer: {
    id: 'cross_exam_pro_answer',
    name: 'Cross Exam Pro Answer',
    nameKr: '찬성 측 답변',
    description: '찬성 측이 질문에 답변합니다. (1분 30초)',
    durationSeconds: 90,
    turnOwner: 'host',
    nextStage: 'cross_exam_pro_ask',
    aiIntroMessage: '🔵 [찬성 측 답변] 답변해주세요. (1분 30초)',
  },
  cross_exam_pro_ask: {
    id: 'cross_exam_pro_ask',
    name: 'Cross Exam Pro Ask',
    nameKr: '찬성 측 질문',
    description: '찬성 측이 반대 측에게 질문합니다. (1분)',
    durationSeconds: 60,
    turnOwner: 'host',
    nextStage: 'cross_exam_con_answer',
    aiIntroMessage: '⚔️ [교차 조사] 찬성 측이 질문합니다. (1분)',
  },
  cross_exam_con_answer: {
    id: 'cross_exam_con_answer',
    name: 'Cross Exam Con Answer',
    nameKr: '반대 측 답변',
    description: '반대 측이 질문에 답변합니다. (1분 30초)',
    durationSeconds: 90,
    turnOwner: 'opponent',
    nextStage: 'rebuttal_con',
    aiIntroMessage: '🔴 [반대 측 답변] 답변해주세요. (1분 30초)',
  },
  rebuttal_con: {
    id: 'rebuttal_con',
    name: 'Rebuttal Con',
    nameKr: '반대 측 반박',
    description: '반대 측이 반박합니다. (2분)',
    durationSeconds: 120,
    turnOwner: 'opponent',
    nextStage: 'rebuttal_pro',
    aiIntroMessage: '🛡️ [반박] 반대 측 반박 시작. (2분)',
  },
  rebuttal_pro: {
    id: 'rebuttal_pro',
    name: 'Rebuttal Pro',
    nameKr: '찬성 측 반박',
    description: '찬성 측이 반박합니다. (2분)',
    durationSeconds: 120,
    turnOwner: 'host',
    nextStage: 'closing_con',
    aiIntroMessage: '🛡️ [반박] 찬성 측 반박 시작. (2분)',
  },
  closing_con: {
    id: 'closing_con',
    name: 'Closing Con',
    nameKr: '반대 측 최종 변론',
    description: '반대 측이 최종 변론을 합니다. (1분)',
    durationSeconds: 60,
    turnOwner: 'opponent',
    nextStage: 'closing_pro',
    aiIntroMessage: '🏁 [최종 변론] 반대 측 마무리 발언. (1분)',
  },
  closing_pro: {
    id: 'closing_pro',
    name: 'Closing Pro',
    nameKr: '찬성 측 최종 변론',
    description: '찬성 측이 최종 변론을 합니다. (1분)',
    durationSeconds: 60,
    turnOwner: 'host',
    nextStage: 'verdict_pending',
    aiIntroMessage: '🏁 [최종 변론] 찬성 측 마무리 발언. (1분)',
  },
  verdict_pending: {
    id: 'verdict_pending',
    name: 'Verdict Pending',
    nameKr: '판정 중',
    description: 'AI가 승패를 분석 중입니다.',
    durationSeconds: 0,
    turnOwner: null,
    nextStage: 'ended',
    aiIntroMessage: '🤖 토론 종료. 판정 중...',
  },
  ended: {
    id: 'ended',
    name: 'Ended',
    nameKr: '종료',
    description: '종료되었습니다.',
    durationSeconds: 0,
    turnOwner: null,
    nextStage: null,
    aiIntroMessage: '🏆 결과 발표 완료.',
  },
};

// 기본 점수
export const INITIAL_SCORE = 50;

// 점수 범위
export const SCORE_RANGE = {
  MIN: 0,
  MAX: 100,
} as const;

// 방 상태 레이블
export const ROOM_STATUS_LABELS = {
  waiting: '대기 중',
  in_progress: '진행 중',
  paused: '일시 중지',
  ended: '종료됨',
  abandoned: '중단됨',
} as const;

// 참가자 역할 레이블
export const ROLE_LABELS = {
  host: '방장 (찬성)',
  opponent: '상대방 (반대)',
} as const;

// 하트비트 설정
export const HEARTBEAT_CONFIG = {
  INTERVAL_MS: 5000, // 5초마다 하트비트
  TIMEOUT_MS: 15000, // 15초 무응답 시 오프라인 처리
} as const;
