// Supabase Database Types
export type DebateStage = 
  | 'waiting'              // 대기 중
  | 'opening_pro'          // 찬성 측 입론
  | 'opening_con'          // 반대 측 입론
  | 'cross_exam_con_ask'   // 반대 측 질문 (교차 조사)
  | 'cross_exam_pro_answer'// 찬성 측 답변
  | 'cross_exam_pro_ask'   // 찬성 측 질문
  | 'cross_exam_con_answer'// 반대 측 답변
  | 'rebuttal_con'         // 반대 측 반박
  | 'rebuttal_pro'         // 찬성 측 반박
  | 'closing_con'          // 반대 측 최종 변론
  | 'closing_pro'          // 찬성 측 최종 변론
  | 'verdict_pending'      // 판정 중
  | 'ended';               // 종료

export type MessageRole = 'user' | 'opponent' | 'moderator' | 'system';
export type MessageType = 'text' | 'fact-check' | 'fallacy-alert' | 'stage-change' | 'verdict';
export type Stance = 'agree' | 'disagree' | 'neutral' | 'observer';

export type DebateSettings = {
  introduction: { duration: number; turns: number };
  rebuttal: { duration: number; turns: number };
  cross: { duration: number; turns: number };
  closing: { duration: number; turns: number };
};

export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          topic: string;
          title: string | null;
          description: string | null;
          stance: Stance;
          stage: DebateStage;
          stage_started_at: string;
          logic_score_pro: number;
          logic_score_con: number;
          settings: DebateSettings | null;
          current_speaker: string | null;
          current_turn_owner: 'host' | 'opponent' | null;
          turn_count: number;
          phase_start_time: string | null;
          turn_started_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          topic: string;
          title?: string | null;
          description?: string | null;
          stance: Stance;
          stage?: DebateStage;
          stage_started_at?: string;
          logic_score_pro?: number;
          logic_score_con?: number;
          settings?: DebateSettings | null;
          current_speaker?: string | null;
          current_turn_owner?: 'host' | 'opponent' | null;
          turn_count?: number;
          phase_start_time?: string | null;
          turn_started_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          topic?: string;
          title?: string | null;
          description?: string | null;
          stance?: Stance;
          stage?: DebateStage;
          stage_started_at?: string;
          logic_score_pro?: number;
          logic_score_con?: number;
          settings?: DebateSettings | null;
          current_speaker?: string | null;
          current_turn_owner?: 'host' | 'opponent' | null;
          turn_count?: number;
          phase_start_time?: string | null;
          turn_started_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      participants: {
        Row: {
          id: string;
          room_id: string;
          user_name: string;
          stance: Stance;
          role: 'host' | 'opponent' | 'observer';
          session_id: string | null;
          is_typing: boolean;
          logic_score: number;
          joined_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_name: string;
          stance: Stance;
          role?: 'host' | 'opponent' | 'observer';
          session_id?: string | null;
          is_typing?: boolean;
          logic_score?: number;
          joined_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_name?: string;
          stance?: Stance;
          role?: 'host' | 'opponent' | 'observer';
          session_id?: string | null;
          is_typing?: boolean;
          logic_score?: number;
          joined_at?: string;
          last_seen_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          room_id: string;
          participant_id: string | null;
          role: MessageRole;
          content: string;
          message_type: MessageType;
          sender_name: string | null;
          sender_session_id: string | null; // Added
          fallacy_detected: string | null;
          fact_check_status: string | null;
          logic_score_change: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          participant_id?: string | null;
          role: MessageRole;
          content: string;
          message_type?: MessageType;
          sender_name?: string | null;
          sender_session_id?: string | null; // Added
          fallacy_detected?: string | null;
          fact_check_status?: string | null;
          logic_score_change?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          participant_id?: string | null;
          role?: MessageRole;
          content?: string;
          message_type?: MessageType;
          sender_name?: string | null;
          sender_session_id?: string | null; // Added
          fallacy_detected?: string | null;
          fact_check_status?: string | null;
          logic_score_change?: number;
          created_at?: string;
        };
      };
      issues: {
        Row: {
          id: string;
          title: string;
          description: string;
          detailed_description: string | null;
          category: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          detailed_description?: string | null;
          category?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          detailed_description?: string | null;
          category?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          kakao_id: string;
          email: string | null;
          nickname: string;
          profile_image: string | null;
          role: 'user' | 'moderator' | 'admin';
          created_at: string;
          last_login_at: string;
        };
        Insert: {
          id?: string;
          kakao_id: string;
          email?: string | null;
          nickname: string;
          profile_image?: string | null;
          role?: 'user' | 'moderator' | 'admin';
          created_at?: string;
          last_login_at?: string;
        };
        Update: {
          id?: string;
          kakao_id?: string;
          email?: string | null;
          nickname?: string;
          profile_image?: string | null;
          role?: 'user' | 'moderator' | 'admin';
          created_at?: string;
          last_login_at?: string;
        };
      };
    };
  };
}

// Convenience types
export type Room = Database['public']['Tables']['rooms']['Row'];
export type Participant = Database['public']['Tables']['participants']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type Issue = Database['public']['Tables']['issues']['Row'];
