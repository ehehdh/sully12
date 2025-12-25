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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const seed = searchParams.get("seed") || Date.now().toString();

    const prompt = `
      Generate a list of 5 current, diverse, and controversial political or social debate topics in South Korea.
      Make them distinct from previous generations if possible.
      Random Seed: ${seed}
      
      Return ONLY a JSON array of objects with:
      - 'id' (english slug)
      - 'label' (Korean title)
      - 'description' (Korean short summary, 1 sentence)
      - 'detailed_description' (Korean detailed background and context, 2-3 sentences)
      - 'category' (One of: '경제', '정치', '사회', '법률', '노동', '환경', '기술', '일반')
      
      Example: [{"id": "med-school", "label": "의대 증원", "description": "의대 정원 확대 논란", "detailed_description": "정부의 2000명 증원 계획에 대해 의료계가 반발하며...", "category": "사회"}]
    `;

    const completion = await getGroqClient().chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.9, // Increased temperature for more variety
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    console.log("AI Topic Content:", content); // Debug log

    let list = [];
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

    if (list.length === 0) {
      throw new Error("No topics found in AI response");
    }

    return NextResponse.json(list);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to fetch topics:", error);
    
    // Fallback topics - Robust default list
    return NextResponse.json([
      { id: "med-school", label: "의대 정원 확대", description: "의료 공백 우려 vs 필수 의료 확충. 정부의 2000명 증원안에 대한 찬반." },
      { id: "basic-income", label: "기본 소득 도입", description: "모든 국민에게 조건 없이 일정 금액 지급. 재정 부담 vs 복지 사각지대 해소." },
      { id: "crypto-tax", label: "금투세 폐지", description: "금융투자소득세 폐지 논란. 투자자 보호 및 시장 활성화 vs 부자 감세." },
      { id: "pension-reform", label: "국민연금 개혁", description: "더 내고 덜 받기 vs 재정 안정화. 미래 세대를 위한 연금 개혁 방향." },
      { id: "ai-regulation", label: "AI 규제 법안", description: "AI 기술 발전에 따른 규제 필요성. 혁신 저해 vs 안전 장치 마련." },
      { id: "nuclear-power", label: "원전 생태계 복원", description: "탈원전 정책 폐기 및 원전 확대. 에너지 안보 vs 안전성 우려." },
      { id: "school-zone", label: "민식이법 개정", description: "스쿨존 내 사고 처벌 강화. 과잉 처벌 논란 vs 어린이 안전 우선." },
      { id: "gender-ministry", label: "여가부 폐지", description: "여성가족부 폐지 공약 이행 논란. 기능 조정 vs 부처 폐지." }
    ]);
  }
}
