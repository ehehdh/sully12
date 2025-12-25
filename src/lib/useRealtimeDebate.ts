"use client";

import { useEffect, useCallback, useRef } from 'react';
import { getSupabase } from './supabase';
import { useAppStore } from './useAppStore';
import { Message, Participant, DebateStage } from './database.types';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeDebate(roomId: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  
  const {
    user,
    debate,
    setMessages,
    addMessage,
    setParticipants,
    updateParticipant,
    setStage,
    setStageStartedAt,
    setScores,
    setIsConnected,
    setTypingUsers,
    setMyParticipantId,
  } = useAppStore();

  // 메시지 구독
  const subscribeToMessages = useCallback(() => {
    if (!roomId) return;

    const supabase = getSupabase();
    
    // Messages 테이블 실시간 구독
    const channel = supabase
      .channel(`room:${roomId}:messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          addMessage(newMessage);
        }
      )
      .subscribe((status) => {
        console.log('Messages subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;
  }, [roomId, addMessage, setIsConnected]);

  // 룸 상태 변경 구독
  const subscribeToRoomUpdates = useCallback(() => {
    if (!roomId) return;

    const supabase = getSupabase();

    supabase
      .channel(`room:${roomId}:updates`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const room = payload.new as any;
          setStage(room.stage);
          setStageStartedAt(new Date(room.stage_started_at));
          setScores(room.logic_score_pro, room.logic_score_con);
        }
      )
      .subscribe();
  }, [roomId, setStage, setStageStartedAt, setScores]);

  // 참가자 Presence 구독
  const subscribeToPresence = useCallback(() => {
    if (!roomId || !user) return;

    const supabase = getSupabase();
    
    const presenceChannel = supabase.channel(`room:${roomId}:presence`, {
      config: {
        presence: {
          key: user.id || user.name,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users = Object.values(state).flat() as any[];
        
        // 타이핑 중인 유저 필터링
        const typing = users
          .filter((u) => u.isTyping)
          .map((u) => u.userName);
        setTypingUsers(typing);

        // 참가자 목록 업데이트
        const participants: Participant[] = users.map((u) => ({
          id: u.id,
          room_id: roomId,
          user_name: u.userName,
          stance: u.stance,
          role: u.role || 'observer',
          session_id: u.sessionId || null,
          is_typing: u.isTyping || false,
          logic_score: u.logicScore || 50,
          joined_at: u.joinedAt || new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        }));
        setParticipants(participants);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            id: user.id || user.name,
            userName: user.name,
            stance: 'neutral', // 기본값, 나중에 업데이트
            isTyping: false,
            logicScore: 50,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    presenceChannelRef.current = presenceChannel;
  }, [roomId, user, setTypingUsers, setParticipants]);

  // 타이핑 상태 업데이트
  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!presenceChannelRef.current || !user) return;

    await presenceChannelRef.current.track({
      id: user.id || user.name,
      userName: user.name,
      isTyping,
    });
  }, [user]);

  // 메시지 전송
  const sendMessage = useCallback(async (content: string, stance: string) => {
    if (!roomId || !user) return null;

    try {
      const response = await fetch(`/api/realtime/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          role: 'user',
          senderName: user.name,
          stance,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Send message error:', error);
      return null;
    }
  }, [roomId, user]);

  // 초기 데이터 로드
  const loadInitialData = useCallback(async () => {
    if (!roomId) return;

    try {
      const response = await fetch(`/api/realtime/rooms/${roomId}`);
      if (!response.ok) throw new Error('Failed to load room');
      
      const data = await response.json();
      
      setMessages(data.messages || []);
      setParticipants(data.participants || []);
      setStage(data.room.stage);
      setStageStartedAt(new Date(data.room.stage_started_at));
      setScores(data.room.logic_score_pro, data.room.logic_score_con);
    } catch (error) {
      console.error('Load initial data error:', error);
    }
  }, [roomId, setMessages, setParticipants, setStage, setStageStartedAt, setScores]);

  // 정리 함수
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      getSupabase().removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (presenceChannelRef.current) {
      getSupabase().removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }
    setIsConnected(false);
  }, [setIsConnected]);

  // Effect: 구독 설정
  useEffect(() => {
    if (!roomId) return;

    loadInitialData();
    subscribeToMessages();
    subscribeToRoomUpdates();
    subscribeToPresence();

    return cleanup;
  }, [roomId, loadInitialData, subscribeToMessages, subscribeToRoomUpdates, subscribeToPresence, cleanup]);

  return {
    messages: debate.messages,
    participants: debate.participants,
    stage: debate.stage,
    stageStartedAt: debate.stageStartedAt,
    logicScorePro: debate.logicScorePro,
    logicScoreCon: debate.logicScoreCon,
    isConnected: debate.isConnected,
    sendMessage,
    setTyping,
  };
}
