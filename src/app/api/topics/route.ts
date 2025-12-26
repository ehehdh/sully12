// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import Groq from "groq-sdk";

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

// 카테고리 배열
const CATEGORIES = ['경제', '정치', '사회', '법률', '노동', '환경', '기술'];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const seed = searchParams.get("seed") || Date.now().toString();
    const category = searchParams.get("category"); // 특정 카테고리 요청 가능
    const count = parseInt(searchParams.get("count") || "6"); // 개수 지정 가능
    const keyword = searchParams.get("keyword"); // 키워드 검색

    // 랜덤 카테고리 2-3개 선택 (다양성 확보)
    const shuffledCategories = [...CATEGORIES].sort(() => Math.random() - 0.5);
    const selectedCategories = category ? [category] : shuffledCategories.slice(0, 3);

    // 키워드 기반 프롬프트 vs 일반 프롬프트
    const prompt = keyword ? `
당신은 한국의 시사 전문가입니다. 사용자가 입력한 키워드와 관련된 토론 주제를 추천해주세요.

**사용자 키워드**: "${keyword}"

요구사항:
1. 키워드 "${keyword}"과 직접적으로 관련된 토론 주제를 ${count}개 생성하세요.
2. 현재 한국 사회에서 논쟁이 되고 있거나, 될 수 있는 주제여야 합니다.
3. 각 주제는 찬성/반대 양측의 논리가 명확히 존재해야 합니다.
4. 키워드의 다양한 측면을 다루세요 (법적, 경제적, 사회적, 윤리적 등).
5. 카테고리는 다음 중에서 가장 적합한 것을 선택하세요: ${CATEGORIES.join(', ')}

Random Seed: ${seed}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "topics": [
    {
      "label": "주제 제목 (15자 이내)",
      "description": "핵심 쟁점 요약 (30자 이내)",
      "detailed_description": "배경 설명. 찬성측 주장과 반대측 주장을 각각 포함. (100자 내외)",
      "category": "카테고리"
    }
  ]
}
` : `
당신은 한국의 시사 전문가입니다. 현재 한국에서 가장 논쟁이 되고 있는 토론 주제를 추천해주세요.

요구사항:
1. 총 ${count}개의 토론 주제를 생성하세요.
2. 카테고리는 다음 중에서 선택하세요: ${selectedCategories.join(', ')}
3. 각 주제는 찬성/반대 양측의 논리가 명확히 존재해야 합니다.
4. 최신 시사 이슈를 반영하세요 (2024년 기준).
5. 이미 많이 다뤄진 주제보다는 신선한 관점의 주제를 선호합니다.

Random Seed: ${seed}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "topics": [
    {
      "label": "주제 제목 (15자 이내)",
      "description": "핵심 쟁점 요약 (30자 이내)",
      "detailed_description": "배경 설명. 찬성측 주장과 반대측 주장을 각각 포함. (100자 내외)",
      "category": "카테고리",
      "keywords": ["키워드1", "키워드2"]
    }
  ]
}

예시:
{
  "topics": [
    {
      "label": "주 4.5일제 도입",
      "description": "주 4.5일 근무제 법제화 찬반",
      "detailed_description": "생산성 향상과 워라밸을 위해 주 4.5일제 도입이 논의되고 있습니다. 찬성측은 근로자 삶의 질 향상과 생산성 증대를 주장하고, 반대측은 기업 경쟁력 약화와 인건비 상승을 우려합니다.",
      "category": "노동",
      "keywords": ["근로시간", "워라밸", "생산성"]
    }
  ]
}
`;

    const completion = await getGroqClient().chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a Korean current affairs expert. Always respond in valid JSON format only. Do not include any text outside the JSON object."
        },
        { role: "user", content: prompt }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 1.0, // 더 다양한 결과
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    console.log("AI Topic Content:", content);

    let list: any[] = [];
    try {
      const parsed = JSON.parse(content || "{}");
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed.topics && Array.isArray(parsed.topics)) {
        list = parsed.topics;
      } else if (parsed.data && Array.isArray(parsed.data)) {
        list = parsed.data;
      }
    } catch (e) {
      console.error("JSON Parse Error:", e);
    }

    // 결과 정리 및 필수 필드 보장
    list = list.map(topic => ({
      id: topic.id || topic.label?.toLowerCase().replace(/\s+/g, '-') || `topic-${Date.now()}`,
      label: topic.label || topic.title || '제목 없음',
      description: topic.description || '',
      detailed_description: topic.detailed_description || topic.description || '',
      category: CATEGORIES.includes(topic.category) ? topic.category : '일반',
      keywords: topic.keywords || []
    }));

    if (list.length === 0) {
      throw new Error("No topics found in AI response");
    }

    return NextResponse.json(list);
  } catch (error) {
    console.error("Failed to fetch topics:", error);
    
    // Fallback topics - 풍부한 기본 목록
    return NextResponse.json([
      { 
        id: "work-45days", 
        label: "주 4.5일제 도입", 
        description: "주 4.5일 근무제 법제화 찬반",
        detailed_description: "워라밸과 생산성 향상을 위한 주 4.5일제 도입 논의. 찬성측은 삶의 질 향상과 효율 증대를, 반대측은 기업 경쟁력 약화를 우려합니다.",
        category: "노동"
      },
      { 
        id: "med-school", 
        label: "의대 정원 확대", 
        description: "의료 공백 우려 vs 필수 의료 확충",
        detailed_description: "정부의 2000명 증원 계획에 대해 의료계가 반발하며 집단 휴진. 찬성측은 지역 의료 확충을, 반대측은 의료 질 하락을 주장합니다.",
        category: "사회"
      },
      { 
        id: "inheritance-tax", 
        label: "상속세 완화", 
        description: "경제 활력 vs 부의 대물림",
        detailed_description: "상속세율 인하 논의. 찬성측은 기업 경영권 보호와 투자 활성화를, 반대측은 불평등 심화와 부자 감세를 우려합니다.",
        category: "경제"
      },
      { 
        id: "ai-copyright", 
        label: "AI 생성물 저작권", 
        description: "AI 창작물의 법적 보호 범위",
        detailed_description: "AI가 생성한 콘텐츠의 저작권 인정 여부. 찬성측은 창작 도구로서의 가치를, 반대측은 인간 창작자 보호를 주장합니다.",
        category: "기술"
      },
      { 
        id: "nuclear-energy", 
        label: "원전 확대 정책", 
        description: "에너지 안보 vs 환경 안전",
        detailed_description: "탈원전 정책 폐기 후 원전 확대 논의. 찬성측은 에너지 독립과 탄소 중립을, 반대측은 안전사고 위험을 우려합니다.",
        category: "환경"
      },
      { 
        id: "crypto-regulation", 
        label: "가상자산 과세", 
        description: "투자자 보호 vs 시장 활성화",
        detailed_description: "가상자산 수익에 대한 과세 시행 논란. 찬성측은 형평성을, 반대측은 시장 위축과 해외 이탈을 주장합니다.",
        category: "경제"
      },
      {
        id: "remote-work-law",
        label: "재택근무 법제화",
        description: "근로자 권리 vs 기업 자율성",
        detailed_description: "재택근무 선택권을 법으로 보장해야 한다는 논의. 찬성측은 일과 삶의 균형을, 반대측은 업무 효율 저하를 우려합니다.",
        category: "노동"
      },
      {
        id: "juvenile-crime",
        label: "소년법 개정",
        description: "처벌 강화 vs 교화 우선",
        detailed_description: "잔혹 범죄 가해 청소년에 대한 처벌 강화 논의. 찬성측은 피해자 보호를, 반대측은 갱생 가능성을 주장합니다.",
        category: "법률"
      }
    ]);
  }
}
