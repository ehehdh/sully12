/**
 * AI 중재자 서비스
 * 
 * 기존 ai.ts의 로직을 리팩토링하여 모듈화했습니다.
 * 프롬프트는 외부 config에서 가져옵니다.
 */

import Groq from "groq-sdk";
import { 
  FallacyCheckResult, 
  FactCheckResult, 
  ToxicityCheckResult, 
  ModeratorAnalysis 
} from '../types';
import { 
  AI_MODEL_CONFIG, 
  HISTORY_LIMITS,
  ANALYSIS_THRESHOLDS
} from '../constants';
import { 
  FALLACY_CHECK_PROMPT, 
  FACT_CHECK_PROMPT, 
  TOXICITY_CHECK_PROMPT,
} from '../../../config/prompts';

// ============================================================
// Groq 클라이언트 (Lazy Initialization)
// ============================================================

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is not set");
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

// ============================================================
// 분석 캐시 (메모리 최적화)
// ============================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const analysisCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = analysisCache.get(key);
  if (!entry) return null;
  
  // 캐시 만료 체크
  if (Date.now() - entry.timestamp > HISTORY_LIMITS.CACHE_TTL_MS) {
    analysisCache.delete(key);
    return null;
  }
  
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  // 캐시 크기 제한
  if (analysisCache.size >= HISTORY_LIMITS.MAX_CACHED_ANALYSES) {
    const oldestKey = analysisCache.keys().next().value;
    if (oldestKey) analysisCache.delete(oldestKey);
  }
  
  analysisCache.set(key, { data, timestamp: Date.now() });
}

function createCacheKey(message: string, type: string): string {
  // 간단한 해시 생성
  const hash = message.substring(0, 50) + message.length;
  return `${type}:${hash}`;
}

// ============================================================
// 논리적 오류 검사
// ============================================================

export async function fallacyCheck(
  message: string, 
  context: string
): Promise<FallacyCheckResult> {
  const cacheKey = createCacheKey(message, 'fallacy');
  const cached = getCached<FallacyCheckResult>(cacheKey);
  if (cached) return cached;

  try {
    const groq = getGroqClient();
    
    const completion = await groq.chat.completions.create({
      model: AI_MODEL_CONFIG.DEFAULT_MODEL,
      messages: [
        { role: "system", content: FALLACY_CHECK_PROMPT.system },
        { 
          role: "user", 
          content: `토론 맥락:\n<context>${context}</context>\n\n검사할 메시지:\n<message>${message}</message>` 
        }
      ],
      temperature: AI_MODEL_CONFIG.TEMPERATURE.fallacy,
      max_tokens: AI_MODEL_CONFIG.MAX_TOKENS.fallacy,
    });

    const content = completion.choices[0]?.message?.content || "";
    const result = parseJsonResponse<FallacyCheckResult>(content, {
      hasFallacy: false,
      fallacyType: null,
      explanation: null,
      severity: null,
      scorePenalty: 0,
    });

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Fallacy check error:", error);
    return {
      hasFallacy: false,
      fallacyType: null,
      explanation: null,
      severity: null,
      scorePenalty: 0,
    };
  }
}

// ============================================================
// 팩트 체크
// ============================================================

export async function factCheck(message: string): Promise<FactCheckResult> {
  const cacheKey = createCacheKey(message, 'fact');
  const cached = getCached<FactCheckResult>(cacheKey);
  if (cached) return cached;

  try {
    const groq = getGroqClient();
    
    const completion = await groq.chat.completions.create({
      model: AI_MODEL_CONFIG.DEFAULT_MODEL,
      messages: [
        { role: "system", content: FACT_CHECK_PROMPT.system },
        { role: "user", content: `분석할 메시지:\n<message>${message}</message>` }
      ],
      temperature: AI_MODEL_CONFIG.TEMPERATURE.fact,
      max_tokens: AI_MODEL_CONFIG.MAX_TOKENS.fact,
    });

    const content = completion.choices[0]?.message?.content || "";
    const result = parseJsonResponse<FactCheckResult>(content, {
      needsVerification: false,
      claims: [],
      status: "none",
      explanation: null,
    });

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Fact check error:", error);
    return {
      needsVerification: false,
      claims: [],
      status: "none",
      explanation: null,
    };
  }
}

// ============================================================
// 독성 언어 검사
// ============================================================

export async function toxicityCheck(
  message: string
): Promise<ToxicityCheckResult> {
  const cacheKey = createCacheKey(message, 'toxicity');
  const cached = getCached<ToxicityCheckResult>(cacheKey);
  if (cached) return cached;

  try {
    const groq = getGroqClient();
    
    const completion = await groq.chat.completions.create({
      model: AI_MODEL_CONFIG.DEFAULT_MODEL,
      messages: [
        { role: "system", content: TOXICITY_CHECK_PROMPT.system },
        { role: "user", content: `검사할 메시지:\n<message>${message}</message>` }
      ],
      temperature: AI_MODEL_CONFIG.TEMPERATURE.toxicity,
      max_tokens: AI_MODEL_CONFIG.MAX_TOKENS.toxicity,
    });

    const content = completion.choices[0]?.message?.content || "";
    const result = parseJsonResponse<ToxicityCheckResult>(content, {
      isToxic: false,
      reason: null,
      scorePenalty: 0,
    });

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Toxicity check error:", error);
    return {
      isToxic: false,
      reason: null,
      scorePenalty: 0,
    };
  }
}

// ============================================================
// 종합 중재자 분석
// ============================================================

export async function analyzeMessage(
  message: string,
  topic: string,
  stage: string,
  history: { role: string; content: string }[]
): Promise<ModeratorAnalysis> {
  // 히스토리 제한 (DoS 방지)
  const limitedHistory = history.slice(-HISTORY_LIMITS.MAX_MESSAGES_FOR_ANALYSIS);
  const context = limitedHistory.map(h => `${h.role}: ${h.content}`).join('\n');

  // 병렬 분석 실행
  const [fallacy, fact, toxicity] = await Promise.all([
    fallacyCheck(message, context),
    factCheck(message),
    toxicityCheck(message),
  ]);

  // 총 점수 변동 계산
  const totalScoreChange = -(fallacy.scorePenalty + toxicity.scorePenalty);

  // 개입 필요 여부 판단
  const shouldIntervene = 
    totalScoreChange <= ANALYSIS_THRESHOLDS.INTERVENTION_THRESHOLD ||
    fallacy.hasFallacy ||
    toxicity.isToxic;

  // 개입 메시지 생성
  let interventionMessage: string | null = null;
  if (shouldIntervene) {
    const parts: string[] = [];
    
    if (fallacy.hasFallacy && fallacy.explanation) {
      parts.push(`⚠️ 논리적 오류 감지: ${fallacy.explanation}`);
    }
    if (toxicity.isToxic && toxicity.reason) {
      parts.push(`🚫 부적절한 표현: ${toxicity.reason}`);
    }
    if (fact.needsVerification && fact.claims.length > 0) {
      parts.push(`📊 팩트 체크 필요: ${fact.claims.join(', ')}`);
    }
    
    interventionMessage = parts.join('\n\n');
  }

  return {
    fallacy,
    factCheck: fact,
    toxicity,
    shouldIntervene,
    interventionMessage,
    totalScoreChange,
  };
}

// ============================================================
// 유틸리티 함수
// ============================================================

function parseJsonResponse<T>(content: string, defaultValue: T): T {
  try {
    // JSON 블록 추출
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    return defaultValue;
  } catch {
    console.error("JSON parsing error:", content);
    return defaultValue;
  }
}

// 캐시 클리어 (관리자용)
export function clearAnalysisCache(): void {
  analysisCache.clear();
}

// 캐시 상태 조회 (디버깅용)
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: analysisCache.size,
    keys: Array.from(analysisCache.keys()),
  };
}
