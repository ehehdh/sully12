// 세션 ID 관리 유틸리티
// 브라우저 탭마다 고유한 세션 ID를 생성하고 유지합니다.

const SESSION_STORAGE_KEY = 'antoron_session_id';

/**
 * 현재 탭의 세션 ID를 가져오거나 새로 생성합니다.
 * sessionStorage를 사용하므로 탭마다 고유하고, 새로고침해도 유지됩니다.
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') {
    // 서버 사이드에서는 빈 문자열 반환 (클라이언트에서만 사용)
    return '';
  }
  
  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
  
  if (!sessionId) {
    // crypto.randomUUID()가 지원되면 사용, 아니면 fallback
    sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : generateUUID();
    
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * 세션 ID를 초기화합니다 (새 세션 시작).
 */
export function resetSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  const newSessionId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : generateUUID();
    
  sessionStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
  return newSessionId;
}

/**
 * UUID v4 생성 (crypto.randomUUID 미지원 환경용 fallback)
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
