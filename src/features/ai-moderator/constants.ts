/**
 * AI 중재자 상수
 */

// AI 모델 설정
export const AI_MODEL_CONFIG = {
  // 기본 모델
  DEFAULT_MODEL: 'llama-3.1-8b-instant',
  
  // 백업 모델 (기본 실패 시)
  FALLBACK_MODEL: 'llama3-8b-8192',
  
  // 온도 설정 (0-1, 낮을수록 일관성 높음)
  TEMPERATURE: {
    fallacy: 0.3,    // 정확한 분석 필요
    fact: 0.2,       // 사실 검증은 보수적으로
    toxicity: 0.3,   // 정확한 판단 필요
    opponent: 0.7,   // 다양한 응답
    verdict: 0.4,    // 균형잡힌 판정
  },
  
  // 최대 토큰 수
  MAX_TOKENS: {
    fallacy: 300,
    fact: 300,
    toxicity: 200,
    opponent: 500,
    verdict: 800,
  },
} as const;

// 점수 변동 설정
export const SCORE_CONFIG = {
  // 논리적 오류 감점
  FALLACY_PENALTY: {
    low: 3,
    medium: 6,
    high: 10,
  },
  
  // 독성 언어 감점
  TOXICITY_PENALTY: {
    mild: 5,
    moderate: 10,
    severe: 15,
  },
  
  // 좋은 논증 가점
  GOOD_ARGUMENT_BONUS: 5,
  
  // 팩트 기반 주장 가점
  FACT_BASED_BONUS: 3,
} as const;

// 분석 임계값
export const ANALYSIS_THRESHOLDS = {
  // 개입이 필요한 점수 변동
  INTERVENTION_THRESHOLD: -5,
  
  // 심각한 위반으로 간주할 감점
  SEVERE_VIOLATION_THRESHOLD: -10,
  
  // 최소 분석 간격 (밀리초)
  MIN_ANALYSIS_INTERVAL: 1000,
} as const;

// 메시지 히스토리 제한 (DoS 방지)
export const HISTORY_LIMITS = {
  // 분석에 사용할 최대 메시지 수
  MAX_MESSAGES_FOR_ANALYSIS: 20,
  
  // 캐시할 최대 분석 결과 수
  MAX_CACHED_ANALYSES: 100,
  
  // 캐시 만료 시간 (밀리초)
  CACHE_TTL_MS: 5 * 60 * 1000, // 5분
} as const;

// 오류 유형 목록
export const FALLACY_TYPES = [
  'straw_man',
  'ad_hominem',
  'appeal_to_authority',
  'hasty_generalization',
  'false_dilemma',
  'slippery_slope',
  'circular_reasoning',
  'red_herring',
  'tu_quoque',
  'appeal_to_emotion',
] as const;

// 오류 유형 한글 번역
export const FALLACY_TYPE_LABELS: Record<string, string> = {
  straw_man: '허수아비 논증',
  ad_hominem: '인신공격',
  appeal_to_authority: '권위에의 호소',
  hasty_generalization: '성급한 일반화',
  false_dilemma: '거짓 딜레마',
  slippery_slope: '미끄러운 경사',
  circular_reasoning: '순환 논증',
  red_herring: '훈제 청어',
  tu_quoque: '피장파장',
  appeal_to_emotion: '감정에의 호소',
};
