-- ============================================================
-- 세션 기반 참가자 관리 마이그레이션
-- 이 SQL을 Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. participants 테이블에 session_id와 role 컬럼 추가
ALTER TABLE participants 
ADD COLUMN IF NOT EXISTS session_id UUID,
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'observer' CHECK (role IN ('host', 'opponent', 'observer'));

-- 2. stance 컬럼에 observer 값 허용하도록 제약조건 수정
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_stance_check;
ALTER TABLE participants ADD CONSTRAINT participants_stance_check 
  CHECK (stance IN ('agree', 'disagree', 'neutral', 'observer'));

-- 3. 중복 방지를 위한 유니크 제약조건 (room_id + session_id)
-- 같은 세션이 같은 방에 중복 입장 불가
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_room_session 
ON participants(room_id, session_id) 
WHERE session_id IS NOT NULL;

-- 4. 비활성 참가자 정리 함수 (30초 이상 미갱신)
CREATE OR REPLACE FUNCTION cleanup_stale_participants(p_room_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM participants
    WHERE room_id = p_room_id 
      AND last_seen_at < NOW() - INTERVAL '30 seconds';
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 5. 참가자 heartbeat 업데이트 함수
CREATE OR REPLACE FUNCTION update_participant_heartbeat(
    p_room_id UUID,
    p_session_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE participants
    SET last_seen_at = NOW()
    WHERE room_id = p_room_id AND session_id = p_session_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 6. 안전한 참가자 입장 함수 (중복 방지 + 역할 자동 배정)
CREATE OR REPLACE FUNCTION safe_join_room(
    p_room_id UUID,
    p_session_id UUID,
    p_user_name TEXT,
    p_preferred_stance VARCHAR(20)
)
RETURNS JSONB AS $$
DECLARE
    v_participant_id UUID;
    v_role VARCHAR(20);
    v_final_stance VARCHAR(20);
    v_host_count INTEGER;
    v_opponent_count INTEGER;
    v_room_stage VARCHAR(20);
    v_host_name TEXT;
BEGIN
    -- 1. 비활성 참가자 정리
    PERFORM cleanup_stale_participants(p_room_id);
    
    -- 2. 이미 이 세션으로 참가 중인지 확인
    SELECT id INTO v_participant_id
    FROM participants
    WHERE room_id = p_room_id AND session_id = p_session_id;
    
    IF v_participant_id IS NOT NULL THEN
        -- 기존 참가자면 heartbeat만 갱신
        UPDATE participants SET last_seen_at = NOW() WHERE id = v_participant_id;
        
        SELECT role, stance INTO v_role, v_final_stance
        FROM participants WHERE id = v_participant_id;
        
        RETURN jsonb_build_object(
            'participant_id', v_participant_id,
            'role', v_role,
            'stance', v_final_stance,
            'is_new', FALSE
        );
    END IF;
    
    -- 3. 현재 역할별 참가자 수 확인
    SELECT 
        COUNT(*) FILTER (WHERE role = 'host'),
        COUNT(*) FILTER (WHERE role = 'opponent')
    INTO v_host_count, v_opponent_count
    FROM participants
    WHERE room_id = p_room_id;
    
    -- 4. 역할 및 입장 배정
    IF v_host_count = 0 THEN
        -- 첫 번째 참가자 = host
        v_role := 'host';
        v_final_stance := p_preferred_stance;
    ELSIF v_opponent_count = 0 THEN
        -- 두 번째 참가자 = opponent (반대 입장 자동 배정)
        v_role := 'opponent';
        -- host의 입장과 반대로 설정
        SELECT CASE WHEN stance = 'agree' THEN 'disagree' ELSE 'agree' END
        INTO v_final_stance
        FROM participants
        WHERE room_id = p_room_id AND role = 'host'
        LIMIT 1;
        
        IF v_final_stance IS NULL THEN
            v_final_stance := 'neutral';
        END IF;
    ELSE
        -- 세 번째 이후 = observer
        v_role := 'observer';
        v_final_stance := 'observer';
    END IF;
    
    -- 5. 참가자 삽입
    INSERT INTO participants (room_id, session_id, user_name, stance, role, last_seen_at)
    VALUES (p_room_id, p_session_id, p_user_name, v_final_stance, v_role, NOW())
    RETURNING id INTO v_participant_id;
    
    -- 6. 입장 메시지
    INSERT INTO messages (room_id, participant_id, role, content, message_type, sender_name)
    VALUES (
        p_room_id,
        v_participant_id,
        'system',
        '👋 ' || p_user_name || ' 님이 ' || 
        CASE v_role 
            WHEN 'host' THEN '토론 개설자로'
            WHEN 'opponent' THEN '토론 상대로'
            ELSE '관전자로'
        END || ' 입장하셨습니다.',
        'text',
        p_user_name
    );
    
    -- 7. host + opponent 모두 있으면 토론 시작
    SELECT stage INTO v_room_stage FROM rooms WHERE id = p_room_id;
    
    IF v_role = 'opponent' AND v_room_stage = 'waiting' THEN
        -- host 이름 조회
        SELECT user_name INTO v_host_name
        FROM participants
        WHERE room_id = p_room_id AND role = 'host'
        LIMIT 1;
        
        -- 토론 시작!
        UPDATE rooms
        SET stage = 'introduction',
            stage_started_at = NOW(),
            current_speaker = v_host_name,
            turn_started_at = NOW()
        WHERE id = p_room_id;
        
        -- 시작 메시지
        INSERT INTO messages (room_id, role, content, message_type)
        VALUES (
            p_room_id,
            'moderator',
            '🚀 **토론이 시작됩니다!**

양측 참가자가 모두 입장했습니다.

📢 **[입론 단계]**
먼저 찬성 측 ' || v_host_name || ' 님께서 입론을 시작해 주세요.
(제한 시간: 60초)',
            'stage-change'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'participant_id', v_participant_id,
        'role', v_role,
        'stance', v_final_stance,
        'is_new', TRUE
    );
END;
$$ LANGUAGE plpgsql;

-- 7. 안전한 퇴장 함수
CREATE OR REPLACE FUNCTION safe_leave_room(
    p_room_id UUID,
    p_session_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user_name TEXT;
    v_role VARCHAR(20);
    v_remaining INTEGER;
    v_room_deleted BOOLEAN := FALSE;
BEGIN
    -- 참가자 정보 조회
    SELECT user_name, role INTO v_user_name, v_role
    FROM participants
    WHERE room_id = p_room_id AND session_id = p_session_id;
    
    IF v_user_name IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Participant not found');
    END IF;
    
    -- 참가자 삭제
    DELETE FROM participants
    WHERE room_id = p_room_id AND session_id = p_session_id;
    
    -- 퇴장 메시지
    INSERT INTO messages (room_id, role, content, message_type)
    VALUES (p_room_id, 'system', '👋 ' || v_user_name || ' 님이 퇴장하셨습니다.', 'text');
    
    -- 남은 참가자 수 확인
    SELECT COUNT(*) INTO v_remaining
    FROM participants WHERE room_id = p_room_id;
    
    -- 아무도 없으면 방 삭제
    IF v_remaining = 0 THEN
        DELETE FROM rooms WHERE id = p_room_id;
        v_room_deleted := TRUE;
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'room_deleted', v_room_deleted,
        'remaining', v_remaining
    );
END;
$$ LANGUAGE plpgsql;

-- 실행 완료 메시지
SELECT 'Migration complete! Session-based participant management is now enabled.' as status;
