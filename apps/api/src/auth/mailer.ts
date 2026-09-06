export type Mail = {
  to: string;
  subject: string;
  text: string;
};

/** 인증 메일을 내보내는 곳. 테스트에서는 잡아두는 가짜를 끼운다. */
export type Mailer = {
  send(mail: Mail): Promise<void>;
};

/**
 * 보내지 않고 로그에만 찍는다. 개발·스테이징용 — 재설정 링크가 로그에 그대로
 * 남으므로 운영에는 두지 않는다(config.ts가 경고한다).
 */
export function createConsoleMailer(): Mailer {
  return {
    async send(mail) {
      console.log(`[mail → ${mail.to}] ${mail.subject}\n${mail.text}`);
    },
  };
}

/**
 * Resend. SDK 없이 HTTP 한 번이라 의존성을 더하지 않는다.
 * 발신 주소의 도메인은 Resend 콘솔에서 인증돼 있어야 한다.
 */
export function createResendMailer(options: { apiKey: string; from: string; fetchImpl?: typeof fetch }): Mailer {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async send(mail) {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${options.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: options.from, to: [mail.to], subject: mail.subject, text: mail.text }),
      });

      if (!response.ok) {
        throw new Error(`메일을 보내지 못했다 (Resend ${response.status}).`);
      }
    },
  };
}
