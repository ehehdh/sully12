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

// 네이버 뉴스 검색 타입
interface NaverNewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

// 네이버 뉴스 검색 함수
async function searchNaverNews(keyword: string): Promise<NaverNewsItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log("Naver API keys not configured, skipping news search");
    return [];
  }

  try {
    const response = await fetch(
      `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}&display=10&sort=date`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );

    if (!response.ok) {
      console.error("Naver API error:", response.status);
      return [];
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("Naver news search failed:", error);
    return [];
  }
}

// HTML 태그 제거
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const seed = searchParams.get("seed") || Date.now().toString();
    const count = parseInt(searchParams.get("count") || "6");
    const keyword = searchParams.get("keyword");

    let newsContext = "";
    
    // 키워드가 있으면 네이버 뉴스 검색
    if (keyword?.trim()) {
      const newsItems = await searchNaverNews(keyword.trim());
      
      if (newsItems.length > 0) {
        newsContext = `
아래는 "${keyword}" 관련 최신 뉴스 기사들입니다:

${newsItems.slice(0, 8).map((item, i) => 
  `[기사${i + 1}] ${stripHtml(item.title)}
   내용: ${stripHtml(item.description)}`
).join('\n\n')}
`;
        console.log("News context:", newsContext);
      } else {
        console.log("No news found for keyword:", keyword);
      }
    }

    // 키워드 기반 프롬프트 (뉴스 컨텍스트 포함)
    const prompt = keyword ? `
당신은 한국의 시사 토론 전문가입니다.

[작업 목표]
"${keyword}" 관련 뉴스 기사들을 분석하여 대립하는 의견이 존재하는 토론 주제를 추출하세요.
단순히 뉴스를 요약하는 것이 아니라, 기사들에서 나타난 찬성과 반대 입장을 파악하여 토론 주제로 만드세요.

${newsContext || `"${keyword}" 관련 최신 이슈에서 대립하는 의견을 찾아 토론 주제를 생성하세요.`}

[작업 지침]
1. 위 뉴스 기사들을 분석하여 "${keyword}"와 관련된 논쟁 포인트를 찾으세요.
2. 각 주제에 대해 실제로 존재하는 찬성 측 주장과 반대 측 주장을 명시하세요.
3. 서로 다른 쟁점 ${count}개를 찾아 토론 주제로 만드세요.
4. 각 주제의 detailed_description에는:
   - 찬성 측: "~~~"라고 주장합니다.
   - 반대 측: "~~~"라고 주장합니다.
   형식으로 양측 의견을 구체적으로 작성하세요.

[제약 조건]
- 모든 주제는 "${keyword}"와 직접 관련되어야 합니다.
- 중복되거나 유사한 주제는 생성하지 마세요.
- 카테고리: ${CATEGORIES.join(', ')} 중 선택

JSON 형식으로만 응답:
{
  "topics": [
    {
      "label": "토론 주제 제목 (15자 이내)",
      "description": "핵심 쟁점을 질문 형태로 (예: ~해야 하는가?)",
      "detailed_description": "찬성 측: ~. 반대 측: ~. (100자 내외)",
      "category": "카테고리"
    }
  ]
}
` : `
당신은 한국의 시사 전문가입니다. 현재 한국에서 가장 논쟁이 되고 있는 토론 주제를 추천해주세요.

요구사항:
1. 총 ${count}개의 토론 주제를 생성하세요.
2. 카테고리는 다음 중에서 선택하세요: ${CATEGORIES.join(', ')}
3. 각 주제는 찬성/반대 양측의 논리가 명확히 존재해야 합니다.
4. 2024년 최신 시사 이슈를 반영하세요.

Random Seed: ${seed}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "topics": [
    {
      "label": "주제 제목 (15자 이내)",
      "description": "핵심 쟁점 요약 (30자 이내)",
      "detailed_description": "배경 설명. 찬성측 주장과 반대측 주장 포함 (100자 내외)",
      "category": "카테고리"
    }
  ]
}
`;

    const completion = await getGroqClient().chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a Korean current affairs expert. Always respond in valid JSON format only."
        },
        { role: "user", content: prompt }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.9,
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
      }
    } catch (e) {
      console.error("JSON Parse Error:", e);
    }

    // 결과 정리
    list = list.map(topic => ({
      id: topic.label?.toLowerCase().replace(/\s+/g, '-') || `topic-${Date.now()}`,
      label: topic.label || '제목 없음',
      description: topic.description || '',
      detailed_description: topic.detailed_description || topic.description || '',
      category: CATEGORIES.includes(topic.category) ? topic.category : '일반',
    }));

    // 중복 제거 (제목 기준)
    const seenLabels = new Set<string>();
    list = list.filter(topic => {
      const normalizedLabel = topic.label.replace(/\s+/g, '').toLowerCase();
      if (seenLabels.has(normalizedLabel)) {
        return false;
      }
      seenLabels.add(normalizedLabel);
      return true;
    });

    if (list.length === 0) {
      throw new Error("No topics generated");
    }

    return NextResponse.json(list);
  } catch (error) {
    console.error("Failed to fetch topics:", error);
    
    // Fallback
    return NextResponse.json([
      { 
        id: "work-45days", 
        label: "주 4.5일제 도입", 
        description: "주 4.5일 근무제 법제화 찬반",
        detailed_description: "워라밸과 생산성 향상을 위한 주 4.5일제 도입 논의. 찬성측은 삶의 질 향상을, 반대측은 경쟁력 약화를 우려합니다.",
        category: "노동"
      },
      { 
        id: "med-school", 
        label: "의대 정원 확대", 
        description: "의료 공백 vs 필수 의료 확충",
        detailed_description: "정부의 2000명 증원 계획에 의료계가 반발. 찬성측은 지역 의료 확충, 반대측은 의료 질 하락을 주장.",
        category: "사회"
      },
      { 
        id: "ai-copyright", 
        label: "AI 생성물 저작권", 
        description: "AI 창작물의 법적 보호 범위",
        detailed_description: "AI 생성 콘텐츠의 저작권 인정 여부. 찬성측은 창작 도구로서의 가치를, 반대측은 인간 창작자 보호를 주장.",
        category: "기술"
      },
      { 
        id: "inheritance-tax", 
        label: "상속세 완화", 
        description: "경제 활력 vs 부의 대물림",
        detailed_description: "상속세율 인하 논의. 찬성측은 기업 경영권 보호, 반대측은 불평등 심화를 우려.",
        category: "경제"
      },
      {
        id: "nuclear-energy",
        label: "원전 확대 정책",
        description: "에너지 안보 vs 환경 안전",
        detailed_description: "탈원전 정책 폐기 후 원전 확대. 찬성측은 에너지 독립, 반대측은 안전 우려.",
        category: "환경"
      },
      {
        id: "juvenile-crime",
        label: "소년법 개정",
        description: "처벌 강화 vs 교화 우선",
        detailed_description: "청소년 범죄 처벌 강화 논의. 찬성측은 피해자 보호, 반대측은 갱생 가능성 주장.",
        category: "법률"
      }
    ]);
  }
}
