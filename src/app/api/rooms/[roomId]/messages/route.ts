// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { store, addMessage, getRooms } from "@/lib/store";
import { getAIResponse } from "@/lib/ai"; // We will reuse or adapt this

export async function GET(req: Request, { params }: { params: { roomId: string } }) {
  const room = store.rooms.find(r => r.id === params.roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json(room.messages);
}

export async function POST(req: Request, { params }: { params: { roomId: string } }) {
  try {
    const { content, role, senderName } = await req.json();
    const room = store.rooms.find(r => r.id === params.roomId);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // 1. Add User Message
    const userMsg = {
      id: Date.now().toString(),
      role: role || "user",
      content,
      timestamp: new Date(),
      senderName
    };
    room.messages.push(userMsg);

    // 2. AI Moderation (Triggered by user message)
    // We only trigger AI if it's a user message
    if (role === "user") {
      // Construct history for AI
      const history = room.messages.map(m => ({ role: m.role, content: m.content }));
      
      // We reuse the existing AI logic but we might need to tweak it to be just a moderator
      // or a participant. The user asked for "Moderator".
      
      // Let's call a simplified AI function that just checks for moderation
      // We can reuse getAIResponse but ignore the "opponent" part if we want pure moderation,
      // OR we can have the AI participate. The prompt says "AI acts as moderator".
      
      // For now, let's just use the existing getAIResponse which does both (Mod + Opponent).
      // In a multi-user setting, maybe we only want Mod?
      // Let's stick to Mod + Opponent for now as it makes the room lively.
      
      const aiResponse = await getAIResponse(history, room.topic, room.stance); // room.stance might be "agree", but users might be mixed.
      
      if (aiResponse) {
        const aiMsg = {
          id: (Date.now() + 1).toString(),
          role: aiResponse.role,
          content: aiResponse.content,
          timestamp: new Date(),
          type: aiResponse.type
        };
        room.messages.push(aiMsg);
        
        if (aiResponse.logicScoreChange) {
          room.logicScore = Math.min(100, Math.max(0, room.logicScore + aiResponse.logicScoreChange));
        }
      }
    }

    return NextResponse.json(room.messages);
  } catch (error) {
    console.error("Failed to post message", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
