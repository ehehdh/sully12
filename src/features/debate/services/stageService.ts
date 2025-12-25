/**
 * 토론 단계 서비스
 * 
 * 토론 단계 진행 및 관리 로직을 담당합니다.
 */

import { getSupabase } from '../../../lib/supabase';
import { DebateStage, StageConfig, DebateRoom } from '../types';
import { STAGE_CONFIGS, STAGE_ORDER } from '../constants';

// ============================================================
// 단계 설정 조회
// ============================================================

/**
 * 특정 단계의 설정을 가져옵니다.
 */
export function getStageConfig(stage: DebateStage): StageConfig {
  return STAGE_CONFIGS[stage];
}

/**
 * 현재 단계 정보를 가져옵니다.
 */
export function getCurrentStage(room: DebateRoom): {
  config: StageConfig;
  elapsedSeconds: number;
  remainingSeconds: number;
} {
  const config = getStageConfig(room.stage);
  
  const stageStartedAt = room.startedAt || room.createdAt;
  const elapsedSeconds = Math.floor(
    (Date.now() - new Date(stageStartedAt).getTime()) / 1000
  );
  
  const remainingSeconds = config.durationSeconds > 0
    ? Math.max(0, config.durationSeconds - elapsedSeconds)
    : -1; // -1은 타이머 없음

  return {
    config,
    elapsedSeconds,
    remainingSeconds,
  };
}

// ============================================================
// 단계 진행 체크
// ============================================================

/**
 * 다음 단계로 진행 가능한지 확인합니다.
 */
export function canAdvanceStage(
  currentStage: DebateStage, 
  elapsedSeconds: number
): boolean {
  const config = STAGE_CONFIGS[currentStage];
  
  // 다음 단계가 없으면 진행 불가
  if (!config.nextStage) return false;
  
  // 타이머가 없는 단계는 수동으로만 진행
  if (config.durationSeconds === 0) return true;
  
  // 시간이 다 지났는지 확인
  return elapsedSeconds >= config.durationSeconds;
}

/**
 * 다음 단계를 가져옵니다.
 */
export function getNextStage(currentStage: DebateStage): DebateStage | null {
  return STAGE_CONFIGS[currentStage].nextStage;
}

/**
 * 단계 순서에서 인덱스를 가져옵니다.
 */
export function getStageIndex(stage: DebateStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/**
 * 토론이 진행 중인 단계인지 확인합니다.
 */
export function isActiveDebateStage(stage: DebateStage): boolean {
  return stage !== 'waiting' && stage !== 'ended' && stage !== 'verdict_pending';
}

// ============================================================
// 단계 진행
// ============================================================

/**
 * 다음 단계로 진행합니다.
 */
export async function advanceStage(
  roomId: string, 
  currentStage: DebateStage
): Promise<{ 
  success: boolean; 
  room: DebateRoom | null; 
  message: string | null;
}> {
  const nextStage = getNextStage(currentStage);
  
  if (!nextStage) {
    return { 
      success: false, 
      room: null, 
      message: '더 이상 진행할 단계가 없습니다.' 
    };
  }

  const supabase = getSupabase();
  const nextConfig = getStageConfig(nextStage);
  const now = new Date().toISOString();

  // 방 업데이트
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: room, error: roomError } = await (supabase as any)
    .from('rooms')
    .update({
      stage: nextStage,
      stage_started_at: now,
      current_turn_owner: nextConfig.turnOwner,
      turn_count: 0,
      phase_start_time: now,
      turn_started_at: now,
    })
    .eq('id', roomId)
    .select()
    .single();

  if (roomError || !room) {
    console.error('Failed to advance stage:', roomError);
    return { 
      success: false, 
      room: null, 
      message: '단계 진행에 실패했습니다.' 
    };
  }

  // 단계 전환 메시지 추가
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('messages').insert({
    room_id: roomId,
    role: 'moderator',
    content: nextConfig.aiIntroMessage,
    message_type: 'stage-change',
  });

  return {
    success: true,
    room: room as DebateRoom,
    message: nextConfig.aiIntroMessage,
  };
}

// ============================================================
// 단계별 발언권 확인
// ============================================================

/**
 * 현재 단계에서 발언 가능한 역할을 확인합니다.
 */
export function canSpeak(
  stage: DebateStage, 
  participantRole: 'host' | 'opponent'
): boolean {
  const config = STAGE_CONFIGS[stage];
  
  // 발언권이 정해지지 않은 단계면 아무도 발언 불가
  if (config.turnOwner === null) return false;
  
  // 현재 발언권과 참가자 역할 비교
  return config.turnOwner === participantRole;
}

/**
 * 단계 전환 메시지를 생성합니다.
 */
export function getStageTransitionMessage(stage: DebateStage): string {
  return STAGE_CONFIGS[stage].aiIntroMessage;
}

/**
 * 남은 시간을 계산합니다.
 */
export function getRemainingTime(
  stage: DebateStage, 
  stageStartedAt: Date
): number {
  const config = STAGE_CONFIGS[stage];
  
  // 타이머가 없는 단계
  if (config.durationSeconds === 0) return -1;
  
  const elapsed = (Date.now() - stageStartedAt.getTime()) / 1000;
  return Math.max(0, config.durationSeconds - elapsed);
}

/**
 * 진행률을 계산합니다 (0-100).
 */
export function getProgressPercentage(currentStage: DebateStage): number {
  const currentIndex = getStageIndex(currentStage);
  const totalStages = STAGE_ORDER.length;
  
  return Math.round((currentIndex / (totalStages - 1)) * 100);
}
