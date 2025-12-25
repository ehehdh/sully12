-- ============================================================
-- Politi-Log Supabase Database Schema
-- 실시간 토론 플랫폼을 위한 데이터베이스 스키마
-- ============================================================

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ROOMS 테이블 - 토론방
-- ============================================================
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic TEXT NOT NULL,
    description TEXT,
    stance VARCHAR(20) NOT NULL CHECK (stance IN ('agree', 'disagree', 'neutral')),
    stage VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (stage IN ('waiting', 'introduction', 'rebuttal', 'cross', 'closing', 'verdict')),
    stage_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    logic_score_pro INTEGER NOT NULL DEFAULT 50 CHECK (logic_score_pro >= 0 AND logic_score_pro <= 100),
    logic_score_con INTEGER NOT NULL DEFAULT 50 CHECK (logic_score_con >= 0 AND logic_score_con <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_rooms_topic ON rooms(topic);
CREATE INDEX IF NOT EXISTS idx_rooms_stage ON rooms(stage);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at DESC);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
CREATE TRIGGER update_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. PARTICIPANTS 테이블 - 참가자
-- ============================================================
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    stance VARCHAR(20) NOT NULL CHECK (stance IN ('agree', 'disagree', 'neutral')),
    is_typing BOOLEAN NOT NULL DEFAULT FALSE,
    logic_score INTEGER NOT NULL DEFAULT 50 CHECK (logic_score >= 0 AND logic_score <= 100),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_participants_room_id ON participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_last_seen ON participants(last_seen_at);

-- ============================================================
-- 3. MESSAGES 테이블 - 메시지
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'opponent', 'moderator', 'system')),
    content TEXT NOT NULL,
    message_type VARCHAR(30) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'fact-check', 'fallacy-alert', 'stage-change', 'verdict')),
    sender_name TEXT,
    fallacy_detected TEXT,
    fact_check_status VARCHAR(20) CHECK (fact_check_status IN ('verified', 'disputed', 'unverified', 'none') OR fact_check_status IS NULL),
    logic_score_change INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);

-- ============================================================
-- 4. Row Level Security (RLS) 정책
-- ============================================================

-- RLS 활성화
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 익명 사용자 읽기 허용
CREATE POLICY "Allow anonymous read for rooms" ON rooms
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous read for participants" ON participants
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous read for messages" ON messages
    FOR SELECT USING (true);

-- 인증된 사용자/익명 모두 쓰기 허용 (개발용)
CREATE POLICY "Allow all insert for rooms" ON rooms
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all insert for participants" ON participants
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all insert for messages" ON messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all update for rooms" ON rooms
    FOR UPDATE USING (true);

CREATE POLICY "Allow all update for participants" ON participants
    FOR UPDATE USING (true);

-- ============================================================
-- 5. Realtime 활성화
-- ============================================================

-- 실시간 구독을 위한 Publication 생성
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE rooms, participants, messages;

-- ============================================================
-- 6. 헬퍼 함수
-- ============================================================

-- 토론방 생성 함수
CREATE OR REPLACE FUNCTION create_debate_room(
    p_topic TEXT,
    p_stance VARCHAR(20),
    p_creator_name TEXT
)
RETURNS UUID AS $$
DECLARE
    v_room_id UUID;
    v_participant_id UUID;
BEGIN
    -- 룸 생성
    INSERT INTO rooms (topic, stance, stage, stage_started_at)
    VALUES (p_topic, p_stance, 'waiting', NOW())
    RETURNING id INTO v_room_id;
    
    -- 생성자를 참가자로 추가
    INSERT INTO participants (room_id, user_name, stance)
    VALUES (v_room_id, p_creator_name, p_stance)
    RETURNING id INTO v_participant_id;
    
    -- 시스템 메시지 추가
    INSERT INTO messages (room_id, role, content, message_type)
    VALUES (
        v_room_id,
        'moderator',
        '🏟️ **토론방 개설**\n\n주제: **' || p_topic || '**\n\n상대방을 기다리는 중입니다.',
        'text'
    );
    
    RETURN v_room_id;
END;
$$ LANGUAGE plpgsql;

-- 참가자 입장 함수
CREATE OR REPLACE FUNCTION join_debate_room(
    p_room_id UUID,
    p_user_name TEXT,
    p_stance VARCHAR(20)
)
RETURNS UUID AS $$
DECLARE
    v_participant_id UUID;
    v_participant_count INTEGER;
    v_current_stage VARCHAR(20);
BEGIN
    -- 1. 이미 존재하는 참가자인지 확인
    SELECT id INTO v_participant_id
    FROM participants
    WHERE room_id = p_room_id AND user_name = p_user_name;

    -- 2. 존재하면 업데이트, 없으면 추가
    IF v_participant_id IS NOT NULL THEN
        UPDATE participants
        SET last_seen_at = NOW(),
            stance = p_stance -- 혹시 입장 바꿨을 수도 있으니 변경
        WHERE id = v_participant_id;
    ELSE
        INSERT INTO participants (room_id, user_name, stance)
        VALUES (p_room_id, p_user_name, p_stance)
        RETURNING id INTO v_participant_id;
        
        -- 입장 메시지 추가 (새로운 참가자일 때만)
        INSERT INTO messages (room_id, participant_id, role, content, message_type, sender_name)
        VALUES (
            p_room_id,
            v_participant_id,
            'system',
            '👋 ' || p_user_name || ' 님이 입장하셨습니다.',
            'text',
            p_user_name
        );
    END IF;
    
    -- 3. 참가자 수 확인
    SELECT COUNT(*), stage INTO v_participant_count, v_current_stage
    FROM participants p
    JOIN rooms r ON r.id = p.room_id
    WHERE p.room_id = p_room_id
    GROUP BY r.stage;
    
    -- 4. 두 명 이상이고 대기 중이면 토론 시작
    IF v_participant_count >= 2 AND v_current_stage = 'waiting' THEN
        UPDATE rooms
        SET stage = 'introduction', stage_started_at = NOW()
        WHERE id = p_room_id;
        
        INSERT INTO messages (room_id, role, content, message_type)
        VALUES (
            p_room_id,
            'moderator',
            '📢 **[입론 단계 시작]**\n\n양측 모두 입장하셨습니다!\n\n이제부터 양측은 주제에 대한 기본 입장을 1분 내에 발표해주세요.',
            'stage-change'
        );
    END IF;
    
    RETURN v_participant_id;
END;
$$ LANGUAGE plpgsql;

-- 참가자 퇴장 함수 (빈 방 자동 삭제)
CREATE OR REPLACE FUNCTION leave_debate_room(
    p_room_id UUID,
    p_user_name TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_participant_count INTEGER;
    v_room_deleted BOOLEAN := FALSE;
BEGIN
    -- 참가자 삭제
    DELETE FROM participants
    WHERE room_id = p_room_id AND user_name = p_user_name;
    
    -- 퇴장 메시지 추가
    INSERT INTO messages (room_id, role, content, message_type)
    VALUES (
        p_room_id,
        'system',
        '👋 ' || p_user_name || ' 님이 퇴장하셨습니다.',
        'text'
    );
    
    -- 남은 참가자 수 확인
    SELECT COUNT(*) INTO v_participant_count
    FROM participants
    WHERE room_id = p_room_id;
    
    -- 참가자가 없으면 방 삭제
    IF v_participant_count = 0 THEN
        DELETE FROM rooms WHERE id = p_room_id;
        v_room_deleted := TRUE;
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'room_deleted', v_room_deleted,
        'remaining_participants', v_participant_count
    );
END;
$$ LANGUAGE plpgsql;

-- 빈 방 자동 정리 함수 (30분 이상 빈 방 삭제)
CREATE OR REPLACE FUNCTION cleanup_empty_rooms()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    WITH empty_rooms AS (
        SELECT r.id
        FROM rooms r
        LEFT JOIN participants p ON r.id = p.room_id
        GROUP BY r.id
        HAVING COUNT(p.id) = 0 AND r.updated_at < NOW() - INTERVAL '30 minutes'
    )
    DELETE FROM rooms WHERE id IN (SELECT id FROM empty_rooms);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 완료
-- ============================================================
COMMENT ON TABLE rooms IS 'Politi-Log 토론방 테이블';
COMMENT ON TABLE participants IS 'Politi-Log 토론 참가자 테이블';
COMMENT ON TABLE messages IS 'Politi-Log 토론 메시지 테이블';

-- ============================================================
-- 7. ISSUES 테이블 - 토론 주제 (ADMIN 관리)
-- ============================================================
CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    detailed_description TEXT,
    category TEXT DEFAULT '일반',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_issues_is_active ON issues(is_active);

-- RLS Policies for issues
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read for issues" ON issues
    FOR SELECT USING (true);

CREATE POLICY "Allow all insert for issues" ON issues
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all update for issues" ON issues
    FOR UPDATE USING (true);

CREATE POLICY "Allow all delete for issues" ON issues
    FOR DELETE USING (true);

-- Realtime for issues
ALTER PUBLICATION supabase_realtime ADD TABLE issues;

-- 초기 데이터 (예시)
INSERT INTO issues (title, description, detailed_description, category)
SELECT '기본소득제 도입', '조건 없는 기본소득 지급, 필요한가?', '기본소득제는 재산의 많고 적음이나 근로 의사와 상관없이 모든 사회 구성원에게 균등하게 지급하는 소득입니다. 4차 산업혁명으로 인한 일자리 감소의 대안이 될 수 있다는 주장과, 막대한 재원 소요로 인한 세금 폭탄 및 근로 의욕 저하를 우려하는 주장이 맞서고 있습니다.', '경제'
WHERE NOT EXISTS (SELECT 1 FROM issues WHERE title = '기본소득제 도입');

INSERT INTO issues (title, description, detailed_description, category)
SELECT '사형제도 폐지', '사형제도, 집행해야 하는가 폐지해야 하는가?', '대한민국은 1997년 이후 사형을 집행하지 않아 실질적 사형 폐지국으로 분류됩니다. 흉악범에 대한 응당한 처벌과 범죄 예방을 위해 집행해야 한다는 의견과, 오심의 가능성과 인권 침해 문제를 들어 폐지해야 한다는 의견이 대립합니다.', '법률'
WHERE NOT EXISTS (SELECT 1 FROM issues WHERE title = '사형제도 폐지');

INSERT INTO issues (title, description, detailed_description, category)
SELECT '촉법소년 연령 하향', '형사 처벌 면제 연령, 낮춰야 하는가?', '현재 만 10세 이상 14세 미만의 형사 미성년자(촉법소년)는 범죄를 저질러도 형사 처벌을 받지 않고 보호 처분을 받습니다. 청소년 범죄가 날로 흉포화됨에 따라 연령 기준을 낮춰 처벌을 강화해야 한다는 주장과, 처벌보다는 교화에 초점을 맞춰야 한다는 주장이 있습니다.', '사회'
WHERE NOT EXISTS (SELECT 1 FROM issues WHERE title = '촉법소년 연령 하향');

