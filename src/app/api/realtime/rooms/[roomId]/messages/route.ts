// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getAIResponse, generateVerdict } from "@/lib/ai";
import { DEBATE_STAGES, getNextStage, canAdvanceStage } from "@/lib/debateStages";
import { DebateStage, Message, Room, Participant } from "@/lib/database.types";
import { updateRoomStageDB } from "@/lib/db";

// GET: 메시지 목록 조회
export async function GET(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const supabase = getSupabase();
  
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', params.roomId)
    .order('created_at', { ascending: true });
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(messages);
}

// POST: 메시지 전송 + AI 분석
export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const { content, role, senderName, stance, sessionId } = await req.json();
    const supabase = getSupabase();

    // 1. 방 정보 및 참가자 정보 가져오기
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', params.roomId)
      .single();

    if (roomError || !roomData) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    const room = roomData as any; // Cast to any for easier access to new columns

    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', params.roomId);

    if (participantsError) throw participantsError;

    // 2. 발언권 검증 (엄격한 턴제 적용)
    let sender: Participant | undefined;
    if (role === "user") {
      // sessionId로 참가자 찾기
      sender = (participants as any[] || []).find(p => p.session_id === sessionId);
      if (!sender) {
        sender = (participants as any[] || []).find(p => p.user_name === senderName);
      }
      
      if (!sender) return NextResponse.json({ error: "Participant not found" }, { status: 403 });
      
      // 관전자 체크
      if (sender.role === 'observer') {
        return NextResponse.json({ error: "Observer cannot speak" }, { status: 403 });
      }

      // 턴 소유권 체크 (waiting, verdict 단계 제외)
      // 턴 소유권 체크 (waiting, verdict_pending 단계 제외 - 별도 처리)
      const currentStage = room.stage;
      
      // 판정 중이거나 종료된 경우 발언 불가
      if (currentStage === 'verdict_pending' || currentStage === 'ended') {
        return NextResponse.json({ error: "Debate ended or verdict pending" }, { status: 403 });
      }

      if (currentStage !== 'waiting') {
        const currentOwner = room.current_turn_owner;
        // currentOwner가 있으면 그 사람만, 없으면(null) 아무도 못함 (waiting 제외)
        if (!currentOwner || sender.role !== currentOwner) {
             return NextResponse.json({ 
                 success: false,
                 error: "NOT_YOUR_TURN",
                 message: "현재 발언 차례가 아닙니다.",
                 currentOwner
             }, { status: 403 });
        }
      }
    }

    // 2. 사용자 메시지 저장 (sender_session_id 포함)
    const { data: userMessage, error: userMsgError } = await supabase
      .from('messages')
      .insert({
        room_id: params.roomId,
        role: role || "user",
        content,
        sender_name: senderName,
        sender_session_id: sessionId || null,
        message_type: 'text'
      } as any)
      .select()
      .single();

    if (userMsgError) throw userMsgError;

    const currentStage: DebateStage = room.stage || 'waiting';
    const responseMessages: any[] = [userMessage];

    // [Refactored] 턴 관리 및 업데이트 (Cross 단계)
    // Cross-Exam 단계에서 메시지 전송 시 즉시 다음 단계로 이동
    const stageName = room.stage as string;
    if (stageName.startsWith('cross_exam_')) {
       const nextStage = DEBATE_STAGES[currentStage].nextStage;
       if (nextStage) {
           const aiMsg = DEBATE_STAGES[nextStage].aiIntroMessage;
           // 1. Send User Message first (Task 2 done above)
           // 2. Advance Stage
           const { room: updatedRoom, message: stageMsg } = await updateRoomStageDB(params.roomId, nextStage, aiMsg);
           Object.assign(room, updatedRoom);
           responseMessages.push(stageMsg);
       }
    }

    // 3. AI 분석 및 응답 (사용자 메시지인 경우만)
    if (role === "user") {
      // 대화 기록 가져오기 (이전 코드 유지)
      const { data: historyData } = await supabase
        .from('messages')
        .select('role, content')
        .eq('room_id', params.roomId)
        .order('created_at', { ascending: true });

      const history = (historyData as any[] || []).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // AI 응답 생성 (이전 코드 유지)
      try {
        const aiResponse = await getAIResponse(
          history,
          room.topic,
          stance || room.stance,
          currentStage
        );

        if (aiResponse && aiResponse.role === "moderator") {
           // AI 메시지 저장
           const { data: aiMessage, error: aiMsgError } = await supabase
            .from('messages')
            .insert({
              room_id: params.roomId,
              role: aiResponse.role,
              content: aiResponse.content,
              message_type: aiResponse.type,
              fallacy_detected: aiResponse.analysis?.fallacy?.fallacyType || null,
              fact_check_status: aiResponse.analysis?.factCheck?.status || null,
            } as any)
            .select()
            .single();

           if (!aiMsgError && aiMessage) {
              responseMessages.push(aiMessage);
              // 논리 점수 업데이트 Logic (유지)
               let updateData: any = {};
               if (aiResponse.logicScoreChange) {
                 if (stance === 'agree') {
                   updateData.logic_score_pro = Math.min(100, Math.max(0, (room.logic_score_pro || 50) + aiResponse.logicScoreChange));
                 } else {
                   updateData.logic_score_con = Math.min(100, Math.max(0, (room.logic_score_con || 50) + aiResponse.logicScoreChange));
                 }
               }
               if (Object.keys(updateData).length > 0) {
                 await (supabase.from('rooms') as any).update(updateData).eq('id', params.roomId);
                 Object.assign(room, updateData);
               }
           }
        }
      } catch (aiError) {
        console.error("AI response error:", aiError);
      }

      // 4. 자동 단계 전환 체크 (시간 초과 시)
      // 현재 방 상태가(위에서 업데이트 됐을 수 있음) check 대상
      if (room.stage_started_at) {
        // DB 최신화된 room.stage를 사용
        const latestStage = room.stage as DebateStage;
        const elapsed = (Date.now() - new Date(room.stage_started_at).getTime()) / 1000;
        
        if (canAdvanceStage(latestStage, elapsed)) {
           const nextStage = getNextStage(latestStage);
           if (nextStage) {
              const aiMsg = DEBATE_STAGES[nextStage].aiIntroMessage;
              const { room: updatedRoom, message: stageMsg } = await updateRoomStageDB(params.roomId, nextStage, aiMsg);
              Object.assign(room, updatedRoom);
              responseMessages.push(stageMsg);

              // 🤖 Verdict Pending -> Ended logic handled separately?
              // Or if we entered verdict_pending, we should generate verdict.
              if (nextStage === 'verdict_pending') {
                  const verdict = await generateVerdict(
                      room.topic,
                      history, // Use history fetched earlier
                      room.logic_score_pro || 50,
                      room.logic_score_con || 50
                  );
                  
                  // verdict 메시지 전송
                  const { data: verdictMessage } = await supabase.from('messages').insert({
                     room_id: params.roomId,
                     role: 'moderator',
                     content: verdict,
                     message_type: 'verdict'
                  } as any).select().single();
                  
                  if (verdictMessage) responseMessages.push(verdictMessage);

                  // 즉시 Ended로 전환
                  const { room: endedRoom } = await updateRoomStageDB(params.roomId, 'ended', DEBATE_STAGES['ended'].aiIntroMessage);
                  Object.assign(room, endedRoom);
                  
                  // 🗄️ 토론 기록 아카이브
                  try {
                    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/debates/archive`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ roomId: params.roomId })
                    });
                  } catch (archiveError) {
                    console.error('Archive error:', archiveError);
                  }
              }
           }
        }
      }
    }

    return NextResponse.json({
      success: true,
      messages: responseMessages,
      room: {
        stage: room.stage,
        stage_started_at: room.stage_started_at,
        logic_score_pro: room.logic_score_pro,
        logic_score_con: room.logic_score_con,
        current_speaker: room.current_speaker,
      },
    });
  } catch (error) {
    console.error("Message post error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
