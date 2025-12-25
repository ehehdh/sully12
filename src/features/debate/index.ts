/**
 * 토론 핵심 모듈 (Debate Feature)
 * 
 * 🚧 상태: 진행 중 (IN_PROGRESS)
 * 
 * 이 모듈은 토론의 핵심 로직을 담당합니다.
 * 
 * 구현된 기능:
 * - [x] 방 생성/참가/퇴장
 * - [x] 토론 단계 관리
 * - [x] 메시지 전송
 * - [x] 점수 계산
 * 
 * 구현 예정 기능:
 * - [ ] Redis 영속성 레이어
 * - [ ] 실시간 동기화 개선
 * - [ ] 관전자 모드
 */

export * from './types';
export * from './constants';

// 방 서비스 export
export { 
  createRoom, 
  joinRoom, 
  leaveRoom, 
  getRooms,
  getRoomById,
  updateHeartbeat,
  updateScores,
} from './services/roomService';

// 단계 서비스 export
export {
  advanceStage,
  canAdvanceStage,
  getCurrentStage,
  getStageConfig,
  getNextStage,
  getStageIndex,
  isActiveDebateStage,
  canSpeak,
  getStageTransitionMessage,
  getRemainingTime,
  getProgressPercentage,
} from './services/stageService';
