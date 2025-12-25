// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { leaveRoomDB } from "@/lib/db";

// POST: 참가자 퇴장 (세션 기반)
export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    
    const result = await leaveRoomDB(params.roomId, sessionId);
    
    return NextResponse.json({
      success: result.success,
      deleted: result.room_deleted,
      remainingParticipants: result.remaining
    });
  } catch (error) {
    console.error("Leave room error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
