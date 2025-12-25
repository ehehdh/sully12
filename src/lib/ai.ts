import Groq from "groq-sdk";
import { DebateStage } from "./database.types";
import { DEBATE_STAGES } from "./debateStages";

// Lazy initialization to prevent build-time errors
let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY environment variable is not set");
    }
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return groqClient;
}

// ============================================================
// 타입 정의
// ============================================================

export interface FallacyCheckResult {
  hasFallacy: boolean;
  fallacyType: string | null;
  explanation: string | null;
  severity: 'low' | 'medium' | 'high' | null;
  scorePenalty: number;
}

export interface FactCheckResult {
  needsVerification: boolean;
  claims: string[];
  status: 'verified' | 'disputed' | 'unverified' | 'none';
  explanation: string | null;
}

export interface ToxicityCheckResult {
  isToxic: boolean;
  reason: string | null;
  scorePenalty: number;
}

export interface ModeratorAnalysis {
  fallacy: FallacyCheckResult;
  factCheck: FactCheckResult;
  toxicity: ToxicityCheckResult;
  shouldIntervene: boolean;
  interventionMessage: string | null;
  totalScoreChange: number;
}

export interface OpponentResponse {
  content: string;
  logicScoreChange: number;
}

export interface AIResponse {
  role: "moderator" | "opponent";
  content: string;
  type: "text" | "fact-check" | "fallacy-alert" | "stage-change" | "verdict";
  logicScoreChange: number;
  analysis?: ModeratorAnalysis;
}

// ============================================================
// 논리적 오류 검사 함수
// ============================================================

export async function fallacyCheck(message: string, context: string): Promise<FallacyCheckResult> {
  const prompt = `
당신은 논리학 전문가입니다. 다음 메시지에서 논리적 오류(fallacy)를 검사하세요.

맥락: ${context}
검사할 메시지: "${message}"

검사할 논리적 오류 유형:
1. Ad Hominem (인신공격): 논점이 아닌 상대방 개인을 공격
2. Strawman (허수아비 논법): 상대 주장을 왜곡하여 반박
3. False Dichotomy (잘못된 이분법): 두 가지 선택지만 있는 것처럼 제시
4. Appeal to Emotion (감정 호소): 논리 대신 감정에 호소
5. Slippery Slope (미끄러운 경사면): 불합리한 연쇄적 결과 주장
6. Ad Populum (대중에 호소): 다수가 믿으니 사실이라는 논법
7. Red Herring (논점 일탈): 관련 없는 주제로 전환
8. Circular Reasoning (순환 논증): 결론을 전제로 사용

반드시 아래 JSON 형식으로만 응답하세요:
{
  "hasFallacy": boolean,
  "fallacyType": "논리적 오류 유형 (영문)" or null,
  "explanation": "한국어로 간단한 설명" or null,
  "severity": "low" | "medium" | "high" or null,
  "scorePenalty": 0 to -10
}
`;

  try {
    const completion = await getGroqClient().chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return {
      hasFallacy: result.hasFallacy || false,
      fallacyType: result.fallacyType || null,
      explanation: result.explanation || null,
      severity: result.severity || null,
      scorePenalty: result.scorePenalty || 0,
    };
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
// 팩트 체크 함수
// ============================================================

export async function factCheck(message: string): Promise<FactCheckResult> {
  const prompt = `
당신은 팩트 체커입니다. 다음 메시지에서 사실 확인이 필요한 주장을 식별하세요.

검사할 메시지: "${message}"

식별 기준:
1. 구체적인 수치, 통계, 비율 언급
2. 역사적 사건이나 날짜 언급
3. 법률, 정책, 규정 관련 주장
4. 특정 인물의 발언 인용
5. 과학적 연구 결과 인용

반드시 아래 JSON 형식으로만 응답하세요:
{
  "needsVerification": boolean,
  "claims": ["확인 필요한 주장 1", "확인 필요한 주장 2"],
  "status": "verified" | "disputed" | "unverified" | "none",
  "explanation": "한국어 설명" or null
}
`;

  try {
    const completion = await getGroqClient().chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return {
      needsVerification: result.needsVerification || false,
      claims: result.claims || [],
      status: result.status || 'none',
      explanation: result.explanation || null,
    };
  } catch (error) {
    console.error("Fact check error:", error);
    return {
      needsVerification: false,
      claims: [],
      status: 'none',
      explanation: null,
    };
  }
}

// ============================================================
// 독성 언어 검사 함수
// ============================================================

export async function toxicityCheck(message: string): Promise<ToxicityCheckResult> {
  const prompt = `
당신은 온라인 토론 중재자입니다. 다음 메시지의 독성을 검사하세요.

검사할 메시지: "${message}"

검사 기준:
1. 욕설, 비속어
2. 인종, 성별, 종교 차별 표현
3. 위협적 언어
4. 조롱, 모욕
5. 지나친 감정적 공격

반드시 아래 JSON 형식으로만 응답하세요:
{
  "isToxic": boolean,
  "reason": "한국어 설명" or null,
  "scorePenalty": 0 to -15
}
`;

  try {
    const completion = await getGroqClient().chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return {
      isToxic: result.isToxic || false,
      reason: result.reason || null,
      scorePenalty: result.scorePenalty || 0,
    };
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
// 교착 상태 감지 및 질문 생성
// ============================================================

export async function generatePromptQuestion(
  topic: string,
  history: { role: string; content: string }[]
): Promise<string | null> {
  const recentMessages = history.slice(-6);
  
  const prompt = `
당신은 정치 토론 AI 사회자입니다. 토론이 교착 상태에 빠졌거나 논의가 피상적일 때 날카로운 질문을 던져 토론을 촉진해야 합니다.

토론 주제: ${topic}

최근 대화:
${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

토론이 교착 상태인지 판단하고, 그렇다면 양측 모두에게 생각을 자극하는 질문을 생성하세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "isStalemate": boolean,
  "question": "질문 내용 (한국어)" or null
}
`;

  try {
    const completion = await getGroqClient().chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    if (result.isStalemate && result.question) {
      return `🤔 **[AI 사회자 질문]**\n\n${result.question}`;
    }
    return null;
  } catch (error) {
    console.error("Prompt question error:", error);
    return null;
  }
}

// ============================================================
// 종합 중재자 분석
// ============================================================

export async function analyzeMessage(
  message: string,
  topic: string,
  stage: DebateStage,
  history: { role: string; content: string }[]
): Promise<ModeratorAnalysis> {
  // 병렬로 세 가지 검사 수행
  const [fallacy, fact, toxicity] = await Promise.all([
    fallacyCheck(message, `토론 주제: ${topic}, 현재 단계: ${DEBATE_STAGES[stage].nameKr}`),
    factCheck(message),
    toxicityCheck(message),
  ]);

  // 욕설/비방/비난이 있을 때만 AI 중재자가 개입
  // 논리적 오류는 점수만 차감하고 메시지를 보내지 않음
  const shouldIntervene = toxicity.isToxic;
  let interventionMessage: string | null = null;

  if (shouldIntervene) {
    interventionMessage = `🛡️ **[AI 중재자 경고]**\n\n⚠️ **부적절한 언어 감지**: ${toxicity.reason}\n\n건전한 토론 문화를 위해 상대방을 존중하는 언어를 사용해주세요. 논리 점수가 차감됩니다.`;
  }

  // 논리적 오류와 독성 언어 모두 점수 차감
  const totalScoreChange = fallacy.scorePenalty + toxicity.scorePenalty;

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
// AI 상대방 응답 생성
// ============================================================

export async function generateOpponentResponse(
  topic: string,
  userStance: string,
  stage: DebateStage,
  history: { role: string; content: string }[]
): Promise<OpponentResponse> {
  const stageConfig = DEBATE_STAGES[stage];
  
  let stageInstruction = "현재 단계에 맞는 발언을 하세요.";
  
  if (stage.includes('opening')) {
    stageInstruction = "입론 단계입니다. 당신의 핵심 주장을 논리적 근거(통계, 사례)와 함께 3가지로 요약하여 강력하게 제시하세요.";
  } else if (stage.includes('ask')) {
    stageInstruction = "질문 단계입니다. 상대방 논리의 허점을 파고드는 날카로운 '질문'을 던지세요. 길게 설명하지 말고 질문 위주로 발언하세요.";
  } else if (stage.includes('answer')) {
    stageInstruction = "답변 단계입니다. 상대방의 질문에 대해 회피하지 말고 정면으로 반박하며 답변하세요. 당신의 논리를 방어하세요.";
  } else if (stage.includes('rebuttal')) {
    stageInstruction = "반박 단계입니다. 앞서 상대방이 제시한 주장들의 오류를 하나하나 지적하고 무너뜨리세요.";
  } else if (stage.includes('closing')) {
    stageInstruction = "최종 변론 단계입니다. 새로운 논거를 제시하지 말고, 지금까지의 논의를 요약하며 청중의 감성에 호소하는 마무리 발언을 하세요.";
  }

  const prompt = `
당신은 정치 토론의 숙련된 토론자입니다. "${userStance}" 입장의 **반대편**에서 토론합니다.

토론 주제: ${topic}
현재 단계: ${stageConfig.nameKr} - ${stageConfig.description}

토론 기록:
${history.slice(-8).map(m => `${m.role}: ${m.content}`).join('\n')}

응답 규칙:
1. ${stageInstruction}
2. 논리적이고 구체적인 근거를 제시하세요.
3. 3문장 이내로 간결하게 응답하세요.
4. 상대방의 논점을 정확하게 이해하고 반박하세요.
5. 한국어로 응답하세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "content": "응답 내용",
  "logicScoreChange": 2
}
`;

  try {
    const completion = await getGroqClient().chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return {
      content: result.content || "응답을 생성할 수 없습니다.",
      logicScoreChange: result.logicScoreChange || 0,
    };
  } catch (error) {
    console.error("Opponent response error:", error);
    return {
      content: "AI 응답 생성 중 오류가 발생했습니다.",
      logicScoreChange: 0,
    };
  }
}

// ============================================================
// 최종 판정 생성
// ============================================================

export async function generateVerdict(
  topic: string,
  history: { role: string; content: string }[],
  scoresPro: number,
  scoresCon: number
): Promise<string> {
  const prompt = `
당신은 공정한 토론 심판입니다. 토론 내용을 분석하여 최종 판정을 내려주세요.

토론 주제: ${topic}
찬성 측 논리 점수: ${scoresPro}점
반대 측 논리 점수: ${scoresCon}점

토론 기록:
${history.map(m => `${m.role}: ${m.content}`).join('\n')}

다음 기준으로 분석하세요:
1. 논리적 일관성
2. 근거의 구체성
3. 상대 반박에 대한 대응력
4. 논점 유지 능력

아래 형식으로 한국어 판정문을 작성하세요:

## 🏆 토론 결과 분석

### 찬성 측 평가
- 강점: ...
- 약점: ...

### 반대 측 평가
- 강점: ...
- 약점: ...

### 최종 판정
(승자와 이유를 명시)

### 개선 제안
(양측 모두에게 피드백)
`;

  try {
    const completion = await getGroqClient().chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
    });

    return completion.choices[0]?.message?.content || "판정을 생성할 수 없습니다.";
  } catch (error) {
    console.error("Verdict generation error:", error);
    return "판정 생성 중 오류가 발생했습니다.";
  }
}

// ============================================================
// 통합 AI 응답 함수 (기존 호환성 유지)
// ============================================================

export async function getAIResponse(
  history: { role: string; content: string }[],
  topic: string,
  userStance: string,
  stage: DebateStage = 'cross_exam_con_ask'
): Promise<AIResponse> {
  const lastMessage = history[history.length - 1];

  // 1. 메시지 분석 (중재자 역할)
  const analysis = await analyzeMessage(lastMessage.content, topic, stage, history);

  // 중재가 필요한 경우 중재자 응답 반환
  if (analysis.shouldIntervene) {
    return {
      role: "moderator",
      content: analysis.interventionMessage!,
      type: analysis.fallacy.hasFallacy ? "fallacy-alert" : "fact-check",
      logicScoreChange: analysis.totalScoreChange,
      analysis,
    };
  }

  // 2. 교착 상태 감지 (자유 토론 단계에서만)
  if ((stage === 'cross_exam_con_ask' || stage === 'cross_exam_pro_answer' || stage === 'cross_exam_pro_ask' || stage === 'cross_exam_con_answer') && history.length > 6) {
    const promptQuestion = await generatePromptQuestion(topic, history);
    if (promptQuestion) {
      return {
        role: "moderator",
        content: promptQuestion,
        type: "text",
        logicScoreChange: 0,
      };
    }
  }

  // 3. 상대방 응답 생성
  const opponent = await generateOpponentResponse(topic, userStance, stage, history);

  return {
    role: "opponent",
    content: opponent.content,
    type: "text",
    logicScoreChange: opponent.logicScoreChange,
  };
}
