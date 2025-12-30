/**
 * 이메일 발송 모듈 (Resend 사용)
 * 무료 한도: 100건/일, 3,000건/월
 */

// Resend API Key는 환경변수에서 로드
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@politi-log.com';
const APP_NAME = 'Politi-Log';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * 이메일 발송 (Resend API)
 */
export async function sendEmail(options: EmailOptions): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not configured');
    // 개발 환경에서는 콘솔에 출력
    if (process.env.NODE_ENV !== 'production') {
      console.log('📧 [DEV] Email would be sent:');
      console.log('To:', options.to);
      console.log('Subject:', options.subject);
      console.log('HTML:', options.html.substring(0, 200) + '...');
      return { success: true, messageId: 'dev-mode' };
    }
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${APP_NAME} <${FROM_EMAIL}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return { success: false, error: data.message || 'Failed to send email' };
    }

    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

// ==================== 이메일 템플릿 ====================

/**
 * 이메일 인증 코드 템플릿
 */
export function getVerificationCodeEmail(code: string, expiresMinutes: number = 10): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>이메일 인증</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">${APP_NAME}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">이메일 인증</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="background: white; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                안녕하세요!<br><br>
                ${APP_NAME} 회원가입을 위한 인증 코드입니다.<br>
                아래 코드를 입력해 주세요.
              </p>
              
              <!-- Code Box -->
              <div style="background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                <p style="color: #64748b; font-size: 14px; margin: 0 0 10px;">인증 코드</p>
                <p style="color: #1e293b; font-size: 36px; font-weight: 700; letter-spacing: 8px; margin: 0;">${code}</p>
              </div>
              
              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 20px 0 0;">
                ⏰ 이 코드는 <strong>${expiresMinutes}분</strong> 동안 유효합니다.<br>
                🔒 본인이 요청하지 않은 경우, 이 이메일을 무시해 주세요.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2024 ${APP_NAME}. All rights reserved.<br>
                이 이메일은 발신 전용입니다.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * 비밀번호 재설정 이메일 템플릿
 */
export function getPasswordResetEmail(resetLink: string, expiresMinutes: number = 30): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>비밀번호 재설정</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">${APP_NAME}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">비밀번호 재설정</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="background: white; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                안녕하세요!<br><br>
                비밀번호 재설정을 요청하셨습니다.<br>
                아래 버튼을 클릭하여 새 비밀번호를 설정해 주세요.
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  비밀번호 재설정하기
                </a>
              </div>
              
              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                버튼이 작동하지 않으면 아래 링크를 브라우저에 복사해 주세요:<br>
                <a href="${resetLink}" style="color: #6366f1; word-break: break-all;">${resetLink}</a>
              </p>
              
              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 20px 0 0;">
                ⏰ 이 링크는 <strong>${expiresMinutes}분</strong> 동안 유효합니다.<br>
                🔒 본인이 요청하지 않은 경우, 이 이메일을 무시해 주세요.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2024 ${APP_NAME}. All rights reserved.<br>
                이 이메일은 발신 전용입니다.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * 회원가입 완료 환영 이메일 템플릿
 */
export function getWelcomeEmail(nickname: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>회원가입 완료</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">🎉 환영합니다!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">${APP_NAME} 회원가입 완료</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="background: white; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                안녕하세요, <strong>${nickname}</strong>님!<br><br>
                ${APP_NAME}에 가입해 주셔서 감사합니다. 🙌<br>
                이제 다양한 주제로 토론을 시작할 수 있습니다.
              </p>
              
              <!-- Features -->
              <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 30px 0;">
                <p style="color: #374151; font-size: 14px; margin: 0 0 15px; font-weight: 600;">이런 것들을 할 수 있어요:</p>
                <ul style="color: #64748b; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>실시간 토론 참여</li>
                  <li>AI 심판의 공정한 판정</li>
                  <li>토론 기록 확인 및 분석</li>
                  <li>다양한 사회 이슈 탐색</li>
                </ul>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://politi-log.vercel.app'}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  토론 시작하기
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2024 ${APP_NAME}. All rights reserved.<br>
                이 이메일은 발신 전용입니다.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ==================== 이메일 발송 함수들 ====================

/**
 * 인증 코드 이메일 발송
 */
export async function sendVerificationCode(email: string, code: string): Promise<SendResult> {
  return sendEmail({
    to: email,
    subject: `[${APP_NAME}] 이메일 인증 코드: ${code}`,
    html: getVerificationCodeEmail(code),
    text: `${APP_NAME} 이메일 인증 코드: ${code}\n\n이 코드는 10분간 유효합니다.`,
  });
}

/**
 * 비밀번호 재설정 이메일 발송
 */
export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<SendResult> {
  return sendEmail({
    to: email,
    subject: `[${APP_NAME}] 비밀번호 재설정 안내`,
    html: getPasswordResetEmail(resetLink),
    text: `비밀번호를 재설정하려면 다음 링크를 방문하세요: ${resetLink}\n\n이 링크는 30분간 유효합니다.`,
  });
}

/**
 * 환영 이메일 발송
 */
export async function sendWelcomeEmail(email: string, nickname: string): Promise<SendResult> {
  return sendEmail({
    to: email,
    subject: `[${APP_NAME}] ${nickname}님, 환영합니다! 🎉`,
    html: getWelcomeEmail(nickname),
    text: `${nickname}님, ${APP_NAME}에 가입해 주셔서 감사합니다!`,
  });
}
