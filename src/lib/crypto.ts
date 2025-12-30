/**
 * 암호화 및 보안 유틸리티
 * - 비밀번호 해싱 (bcrypt)
 * - 인증 코드 해싱 (SHA-256)
 * - 토큰 생성
 */
import crypto from 'crypto';

// ==================== 인증 코드 ====================

/**
 * 6자리 숫자 인증 코드 생성
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 인증 코드 해시 (SHA-256)
 */
export function hashVerificationCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * 인증 코드 검증
 */
export function verifyCode(inputCode: string, storedHash: string): boolean {
  const inputHash = hashVerificationCode(inputCode);
  return crypto.timingSafeEqual(
    Buffer.from(inputHash, 'hex'),
    Buffer.from(storedHash, 'hex')
  );
}

// ==================== 비밀번호 재설정 토큰 ====================

/**
 * 비밀번호 재설정 토큰 생성
 */
export function generateResetToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * 토큰 해시 검증
 */
export function verifyToken(inputToken: string, storedHash: string): boolean {
  const inputHash = crypto.createHash('sha256').update(inputToken).digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    return false;
  }
}

// ==================== 비밀번호 해싱 (bcrypt 대신 crypto 사용) ====================
// Edge 런타임 호환을 위해 bcrypt 대신 PBKDF2 사용

const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

/**
 * 비밀번호 해싱
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * 비밀번호 검증
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, key] = storedHash.split(':');
  
  if (!salt || !key) return false;
  
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, derivedKey) => {
      if (err) reject(err);
      try {
        resolve(crypto.timingSafeEqual(
          Buffer.from(key, 'hex'),
          derivedKey
        ));
      } catch {
        resolve(false);
      }
    });
  });
}

// ==================== 비밀번호 정책 검증 (NIST 준수) ====================

// 흔한 비밀번호 목록 (상위 1000개 샘플)
const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', 'qwerty', 'password123',
  'abc123', 'password1', '12345678', '111111', '123123',
  'admin', 'letmein', 'welcome', 'monkey', 'dragon',
  'master', 'login', 'sunshine', 'princess', 'qwertyuiop',
  'passw0rd', 'iloveyou', 'trustno1', 'whatever', 'freedom',
  '000000', '696969', 'batman', 'football', 'baseball',
  '1234567', '12345', '1234567890', '0987654321', 'asdfghjkl',
  // ... 실제로는 10,000개 이상의 목록 사용
]);

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'strong' | 'very_strong';
}

/**
 * 비밀번호 정책 검증 (NIST 준수)
 */
export function validatePassword(
  password: string, 
  userInfo?: { email?: string; nickname?: string }
): PasswordValidationResult {
  const errors: string[] = [];
  
  // 1. 길이 검증 (최소 10자)
  if (password.length < 10) {
    errors.push('비밀번호는 10자 이상이어야 합니다.');
  }
  
  // 2. 최대 길이 (128자)
  if (password.length > 128) {
    errors.push('비밀번호는 128자 이하여야 합니다.');
  }
  
  // 3. 흔한 비밀번호 차단
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('너무 흔한 비밀번호입니다. 다른 비밀번호를 사용해주세요.');
  }
  
  // 4. 연속된 문자/숫자 차단
  if (/(.)\1{4,}/.test(password)) {
    errors.push('같은 문자가 5번 이상 연속될 수 없습니다.');
  }
  
  // 5. 순차적 패턴 차단
  const sequentialPatterns = [
    '0123456789', '9876543210',
    'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba',
    'qwertyuiop', 'asdfghjkl', 'zxcvbnm'
  ];
  const lowerPassword = password.toLowerCase();
  for (const pattern of sequentialPatterns) {
    for (let i = 0; i <= pattern.length - 5; i++) {
      if (lowerPassword.includes(pattern.slice(i, i + 5))) {
        errors.push('연속된 문자나 숫자 패턴은 사용할 수 없습니다.');
        break;
      }
    }
  }
  
  // 6. 사용자 정보 포함 차단
  if (userInfo) {
    const emailLocal = userInfo.email?.split('@')[0]?.toLowerCase();
    if (emailLocal && emailLocal.length >= 3 && lowerPassword.includes(emailLocal)) {
      errors.push('이메일 주소를 비밀번호에 포함할 수 없습니다.');
    }
    
    const nickname = userInfo.nickname?.toLowerCase();
    if (nickname && nickname.length >= 3 && lowerPassword.includes(nickname)) {
      errors.push('닉네임을 비밀번호에 포함할 수 없습니다.');
    }
  }
  
  // 비밀번호 강도 계산
  let strength: PasswordValidationResult['strength'] = 'weak';
  let score = 0;
  
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (password.length >= 18) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  
  if (score >= 5) strength = 'very_strong';
  else if (score >= 4) strength = 'strong';
  else if (score >= 2) strength = 'fair';
  else strength = 'weak';
  
  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)], // 중복 제거
    strength
  };
}
