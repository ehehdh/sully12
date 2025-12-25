// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRoomDetailsDB, updateRoomStageDB } from "@/lib/db";
import { getSupabase } from "@/lib/supabase";
import { DEBATE_STAGES, getStageTransitionMessage } from "@/lib/debateStages";
import { DebateStage } from "@/lib/database.types";

// GET: 특정 룸 정보 조회
export async function GET(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const roomData = await getRoomDetailsDB(params.roomId);

    if (!roomData) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json(roomData);
  } catch (error) {
    console.error("Failed to fetch room details:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH: 토론 단계 변경
export async function PATCH(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const { action, newStage } = await req.json();

    if (action === 'advance_stage') {
      if (!newStage || !DEBATE_STAGES[newStage as DebateStage]) {
         return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
      }

      // 현재 방 상태 확인
      const roomData = await getRoomDetailsDB(params.roomId);
      if (!roomData) {
        return NextResponse.json({ error: "Room not found" }, { status: 404 });
      }

      // waiting 상태에서는 수동 진행 불가 (자동 시작만 허용 - 또는 예외)
      // 하지만 테스트를 위해 수동 진행을 허용할 수도 있음.
      // 일단 기존 로직 유지하되 유효성 검사만 수정

      const stageMessage = DEBATE_STAGES[newStage as DebateStage].aiIntroMessage;
      const result = await updateRoomStageDB(params.roomId, newStage as DebateStage, stageMessage);

      return NextResponse.json({
        success: true,
        room: result.room,
        message: result.message,
      });
    }

    if (action === 'switch_turn') {
      const roomData = await getRoomDetailsDB(params.roomId);
      if (!roomData) return NextResponse.json({ error: "Room not found" }, { status: 404 });

      const currentStage = roomData.stage;
      const nextStage = DEBATE_STAGES[currentStage].nextStage;

      if (nextStage) {
         const aiMsg = DEBATE_STAGES[nextStage].aiIntroMessage;
         const result = await updateRoomStageDB(params.roomId, nextStage, aiMsg);
         return NextResponse.json({ success: true, room: result.room, message: result.message });
      }
      
      return NextResponse.json({ success: true, message: "No next stage" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Stage update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
