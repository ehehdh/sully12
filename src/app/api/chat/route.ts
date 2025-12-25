// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getAIResponse } from "@/lib/ai";

export async function POST(req: Request) {
  try {
    const { history, topic, userStance } = await req.json();
    
    if (!history || !topic || !userStance) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const response = await getAIResponse(history, topic, userStance);
    return NextResponse.json(response);
    
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
