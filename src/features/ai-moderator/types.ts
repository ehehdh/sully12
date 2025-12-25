/**
 * AI 중재자 관련 타입 정의
 */

// 논리적 오류 검사 결과
export interface FallacyCheckResult {
  hasFallacy: boolean;
  fallacyType: string | null;
  explanation: string | null;
  severity: 'low' | 'medium' | 'high' | null;
  scorePenalty: number;
}

// 팩트 체크 결과
export interface FactCheckResult {
  needsVerification: boolean;
  claims: string[];
  status: 'verified' | 'disputed' | 'unverified' | 'none';
  explanation: string | null;
}

// 독성 언어 검사 결과
export interface ToxicityCheckResult {
  isToxic: boolean;
  reason: string | null;
  scorePenalty: number;
}

// 종합 중재자 분석 결과
export interface ModeratorAnalysis {
  fallacy: FallacyCheckResult;
  factCheck: FactCheckResult;
  toxicity: ToxicityCheckResult;
  shouldIntervene: boolean;
  interventionMessage: string | null;
  totalScoreChange: number;
}

// AI 상대방 응답
export interface OpponentResponse {
  content: string;
  logicScoreChange: number;
}

// AI 응답 (통합)
export interface AIResponse {
  role: "moderator" | "opponent";
  content: string;
  type: "text" | "fact-check" | "fallacy-alert" | "stage-change" | "verdict";
  logicScoreChange: number;
  analysis?: ModeratorAnalysis;
}

// 최종 판정
export interface VerdictResult {
  winner: 'pro' | 'con' | 'draw';
  proScore: number;
  conScore: number;
  analysis: string;
  highlights: {
    proStrengths: string[];
    proWeaknesses: string[];
    conStrengths: string[];
    conWeaknesses: string[];
  };
}

// AI 분석 요청
export interface AnalysisRequest {
  message: string;
  topic: string;
  stage: string;
  history: { role: string; content: string }[];
}

// AI 분석 캐시 키
export interface AnalysisCacheKey {
  messageHash: string;
  analysisType: 'fallacy' | 'fact' | 'toxicity' | 'full';
}
