/**
 * AI 중재자 모듈 (AI Moderator Feature)
 * 
 * 🚧 상태: 진행 중 (IN_PROGRESS)
 * 
 * 이 모듈은 AI 기반 토론 중재 기능을 담당합니다.
 * 
 * 구현된 기능:
 * - [x] 논리적 오류 검사
 * - [x] 팩트 체크
 * - [x] 독성 언어 검사
 * - [x] 최종 판정 생성
 * 
 * 구현 예정 기능:
 * - [ ] 프롬프트 버전 관리
 * - [ ] 비용 최적화 (샘플링)
 * - [ ] 캐싱 레이어
 */

export * from './types';
export * from './constants';
export * from './services/moderatorService';
