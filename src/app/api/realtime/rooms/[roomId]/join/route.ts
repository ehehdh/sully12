// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { joinRoomDB, getRoomDetailsDB, updateHeartbeatDB } from "@/lib/db";

// POST: 토론방 입장 (세션 기반)
export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const { sessionId, userName, stance } = await req.json();
    
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    
    if (!userName) {
      return NextResponse.json({ error: "userName is required" }, { status: 400 });
    }
    
    const result = await joinRoomDB(params.roomId, sessionId, userName, stance);
    const roomDetails = await getRoomDetailsDB(params.roomId);

    if (!roomDetails) {
       return NextResponse.json({ error: "Room details not found" }, { status: 404 });
    }
    
    const messages = roomDetails.messages || [];

    return NextResponse.json({
      success: true,
      room: roomDetails,
      myName: result.participant.user_name,
      myRole: result.role,
      isNew: result.isNew,
      messages: messages,
    });
  } catch (error) {
    console.error("Join room error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH: Heartbeat 업데이트
export async function PATCH(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    
    const success = await updateHeartbeatDB(params.roomId, sessionId);
    
    return NextResponse.json({ success });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
