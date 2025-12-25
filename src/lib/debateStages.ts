import { DebateStage } from './database.types';

// 토론 단계 설정
// 토론 단계 설정
export interface StageConfig {
  name: string;
  nameKr: string;
  description: string;
  durationSeconds: number;
  turnOwner?: 'host' | 'opponent' | null; // null means no user speaker
  nextStage: DebateStage | null;
  aiIntroMessage: string;
}

// 2. 토론 단계별 설정 (순서 재정의)
export const DEBATE_STAGES: Record<DebateStage, StageConfig> = {
  waiting: {
    name: 'Waiting',
    nameKr: '대기 중',
    description: '참가자를 기다리는 중입니다.',
    durationSeconds: 0, 
    nextStage: 'opening_pro',
    aiIntroMessage: '상대방이 입장하면 토론이 시작됩니다.'
  },
  opening_pro: {
    name: 'Opening Pro',
    nameKr: '찬성 측 입론',
    description: '찬성 측이 입론을 진행합니다. (3분)',
    durationSeconds: 180,
    turnOwner: 'host',
    nextStage: 'opening_con',
    aiIntroMessage: '🔵 [찬성 측 입론] 시작합니다. (3분)'
  },
  opening_con: {
    name: 'Opening Con',
    nameKr: '반대 측 입론',
    description: '반대 측이 입론을 진행합니다. (3분)',
    durationSeconds: 180,
    turnOwner: 'opponent',
    nextStage: 'cross_exam_con_ask',
    aiIntroMessage: '🔴 [반대 측 입론] 시작합니다. (3분)'
  },
  cross_exam_con_ask: {
    name: 'Cross Exam Con Ask',
    nameKr: '반대 측 질문',
    description: '반대 측이 찬성 측에게 질문합니다. (1분)',
    durationSeconds: 60,
    turnOwner: 'opponent',
    nextStage: 'cross_exam_pro_answer',
    aiIntroMessage: '⚔️ [교차 조사] 반대 측이 질문합니다. (1분)'
  },
  cross_exam_pro_answer: {
    name: 'Cross Exam Pro Answer',
    nameKr: '찬성 측 답변',
    description: '찬성 측이 질문에 답변합니다. (1분 30초)',
    durationSeconds: 90,
    turnOwner: 'host',
    nextStage: 'cross_exam_pro_ask',
    aiIntroMessage: '🔵 [찬성 측 답변] 답변해주세요. (1분 30초)'
  },
  cross_exam_pro_ask: {
    name: 'Cross Exam Pro Ask',
    nameKr: '찬성 측 질문',
    description: '찬성 측이 반대 측에게 질문합니다. (1분)',
    durationSeconds: 60,
    turnOwner: 'host',
    nextStage: 'cross_exam_con_answer',
    aiIntroMessage: '답변이 충분했나요? 추가 질문이 진행됩니다. ⚔️ [교차 조사] 찬성 측이 질문합니다. (1분)'
  },
  cross_exam_con_answer: {
    name: 'Cross Exam Con Answer',
    nameKr: '반대 측 답변',
    description: '반대 측이 질문에 답변합니다. (1분 30초)',
    durationSeconds: 90,
    turnOwner: 'opponent',
    nextStage: 'rebuttal_con',
    aiIntroMessage: '🔴 [반대 측 답변] 답변해주세요. (1분 30초)'
  },
  rebuttal_con: {
    name: 'Rebuttal Con',
    nameKr: '반대 측 반박',
    description: '반대 측이 반박합니다. (2분)',
    durationSeconds: 120,
    turnOwner: 'opponent',
    nextStage: 'rebuttal_pro',
    aiIntroMessage: '🛡️ [반박] 반대 측 반박 시작. (2분)'
  },
  rebuttal_pro: {
    name: 'Rebuttal Pro',
    nameKr: '찬성 측 반박',
    description: '찬성 측이 반박합니다. (2분)',
    durationSeconds: 120,
    turnOwner: 'host',
    nextStage: 'closing_con',
    aiIntroMessage: '🛡️ [반박] 찬성 측 반박 시작. (2분)'
  },
  closing_con: {
    name: 'Closing Con',
    nameKr: '반대 측 최종 변론',
    description: '반대 측이 최종 변론을 합니다. (1분)',
    durationSeconds: 60,
    turnOwner: 'opponent',
    nextStage: 'closing_pro',
    aiIntroMessage: '🏁 [최종 변론] 반대 측 마무리 발언. (1분)'
  },
  closing_pro: {
    name: 'Closing Pro',
    nameKr: '찬성 측 최종 변론',
    description: '찬성 측이 최종 변론을 합니다. (1분)',
    durationSeconds: 60,
    turnOwner: 'host',
    nextStage: 'verdict_pending',
    aiIntroMessage: '🏁 [최종 변론] 찬성 측 마무리 발언. (1분)'
  },
  verdict_pending: {
    name: 'Verdict Pending',
    nameKr: '판정 중',
    description: 'AI가 승패를 분석 중입니다.',
    durationSeconds: 0, 
    turnOwner: null,
    nextStage: 'ended',
    aiIntroMessage: '🤖 토론 종료. 판정 중...'
  },
  ended: {
    name: 'Ended',
    nameKr: '종료',
    description: '종료되었습니다.',
    durationSeconds: 0,
    turnOwner: null,
    nextStage: null,
    aiIntroMessage: '🏆 결과 발표 완료.'
  }
};

// 다음 단계로 이동 가능한지 확인
export function canAdvanceStage(currentStage: DebateStage, elapsedSeconds: number): boolean {
  const config = DEBATE_STAGES[currentStage];
  if (!config.nextStage) return false;
  if (config.durationSeconds === 0) return true; // Manual advancement only
  return elapsedSeconds >= config.durationSeconds;
}

// 다음 단계 가져오기
export function getNextStage(currentStage: DebateStage): DebateStage | null {
  return DEBATE_STAGES[currentStage].nextStage;
}

// 남은 시간 계산
export function getRemainingTime(currentStage: DebateStage, stageStartedAt: Date): number {
  const config = DEBATE_STAGES[currentStage];
  if (config.durationSeconds === 0) return -1; // No timer
  
  const elapsed = (Date.now() - stageStartedAt.getTime()) / 1000;
  return Math.max(0, config.durationSeconds - elapsed);
}

// 단계 전환 메시지 생성
export function getStageTransitionMessage(stage: DebateStage): string {
  return DEBATE_STAGES[stage].aiIntroMessage;
}
