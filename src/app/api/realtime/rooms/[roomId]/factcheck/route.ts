// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import Groq from "groq-sdk";

// Lazy initialization
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

// POST: 팩트체크 요청
export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const { claim, senderName } = await req.json();
    const supabase = getSupabase();

    // 1. 방 정보 가져오기
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', params.roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // 발언권 체크 - 자기 차례일 때만 팩트체크 요청 가능
    if ((room as any).current_speaker && (room as any).current_speaker !== senderName) {
      return NextResponse.json({
        success: false,
        error: "NOT_YOUR_TURN",
        message: "팩트체크는 자신의 발언 차례에만 요청할 수 있습니다.",
      }, { status: 403 });
    }

    // 2. 팩트체크 요청 메시지 추가
    const { data: requestMessage } = await supabase
      .from('messages')
      .insert({
        room_id: params.roomId,
        role: "user",
        content: `📋 **[팩트체크 요청]**\n\n"${claim}"`,
        sender_name: senderName,
        message_type: "text"
      } as any)
      .select()
      .single();

    // 3. AI 팩트체크 수행
    const prompt = `
당신은 팩트체크 전문가입니다. 다음 주장에 대해 객관적으로 검증해주세요.

토론 주제: ${(room as any).topic}
검증할 주장: "${claim}"

다음 형식으로 응답하세요 (JSON):
{
  "verdict": "사실" | "대체로 사실" | "절반의 진실" | "대체로 거짓" | "거짓" | "판단 불가",
  "explanation": "검증 결과에 대한 상세 설명 (2-3문장)",
  "sources": ["관련 정보 출처나 근거 (있다면)"]
}

주의:
- 객관적인 사실만 기반으로 판단
- 확인할 수 없는 경우 "판단 불가"로 표시
- 정치적 편향 없이 중립적으로 분석
`;

    let factCheckResult = {
      verdict: "판단 불가",
      explanation: "해당 주장에 대해 즉시 검증할 수 있는 정보가 부족합니다. 각 토론자가 출처를 밝혀주시면 더 정확한 검증이 가능합니다.",
      sources: [] as string[],
    };

    try {
      const completion = await getGroqClient().chat.completions.create({
        messages: [{ role: "system", content: prompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        factCheckResult = JSON.parse(content);
      }
    } catch (aiError) {
      console.error("AI fact check error:", aiError);
    }

    // 4. 팩트체크 결과 메시지 추가
    const verdictEmoji: Record<string, string> = {
      "사실": "✅",
      "대체로 사실": "🟢",
      "절반의 진실": "🟡",
      "대체로 거짓": "🟠",
      "거짓": "❌",
      "판단 불가": "❔",
    };

    const emoji = verdictEmoji[factCheckResult.verdict] || "❔";

    const { data: factCheckMessage } = await supabase
      .from('messages')
      .insert({
        room_id: params.roomId,
        role: "moderator",
        content: `📋 **[AI 팩트체크 결과]**\n\n${emoji} **판정: ${factCheckResult.verdict}**\n\n${factCheckResult.explanation}${factCheckResult.sources?.length > 0 ? `\n\n📚 참고: ${factCheckResult.sources.join(", ")}` : ""}`,
        message_type: "fact-check"
      } as any)
      .select()
      .single();

    return NextResponse.json({
      success: true,
      messages: [requestMessage, factCheckMessage],
      factCheck: factCheckResult,
    });
  } catch (error) {
    console.error("Fact check error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
