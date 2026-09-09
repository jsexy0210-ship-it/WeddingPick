/**
 * Npay 리워드 수령 — WP-EVT-006 (핸드오프 v3.22 15-events).
 *
 *   받는 분 · 휴대폰 번호 · 받는 방법 Npay · 개인정보 제공 동의(필수)
 *   note  «리워드를 보내는 데만 써요 / 보내드린 뒤 지워요.»
 *   CTA   «5,000원 받기»
 *
 * 화면은 상태를 계산하지 않는다 — 서버가 상태와 문구를 내려준다. 운영 기간 · 지급 예정일은
 * 적지 않는다(SPEC §11.3) — «확인 후 알려드려요».
 */

export const REWARD_PAYOUT_STATUSES = ['requested', 'sent', 'failed'] as const;

export type RewardPayoutStatus = (typeof REWARD_PAYOUT_STATUSES)[number];

export const REWARD_PAYOUT_STATUS_LABEL: Record<RewardPayoutStatus, string> = {
  requested: '확인 중',
  sent: '지급 완료',
  failed: '지급 실패',
};

export const REWARD_PAYOUT_STATUS_NOTE: Record<RewardPayoutStatus, string> = {
  requested: '받는 정보를 확인하고 Npay로 보내드려요. 보내면 알림으로 알려드려요',
  sent: 'Npay로 보내드렸어요',
  failed: '휴대폰 번호를 확인하고 다시 받아주세요',
};

/** 실패 기본 사유 — 운영자가 --note를 안 적었을 때. 받는 사람이 읽는다. */
export const REWARD_PAYOUT_DEFAULT_FAILURE = '휴대폰 번호를 확인해주세요';

export const REWARD_PAYOUT_METHOD_LABEL = 'Npay';

export const REWARD_PAYOUT_COPY = {
  title: '리워드 받기',
  hero: (amount: string) => `${amount}을\n받을 수 있어요`,
  sub: '받는 분 정보만 확인하면 끝나요',
  recipient: '받는 분',
  phone: '휴대폰 번호',
  method: '받는 방법',
  consent: '개인정보 제공 동의',
  consentRequired: '필수',
  consentTitle: '개인정보 제공에 동의해주세요',
  consentBody: '리워드를 보내는 데만 쓰고 보내드린 뒤 지워요.',
  noteTitle: '리워드를 보내는 데만 써요',
  noteBody: '보내드린 뒤 지워요.',
  cta: (amount: string) => `${amount} 받기`,
  ctaRetry: '다시 받기',
  requested: '요청했어요. 확인 후 알려드려요',
  nothing: '지금 받을 수 있는 리워드가 없어요',
  nothingBody: '조건을 채우면 여기서 받을 수 있어요',
} as const;

export const RECIPIENT_NAME_MAX = 20;

/** 숫자만 남기고 010-XXXX-XXXX로. 아니면 null — 화면이 «휴대폰 번호를 확인해주세요»를 띄운다. */
export function normalizeMobilePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 11 || !digits.startsWith('010')) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/** 입력 중 표시용 — 숫자를 치는 대로 하이픈을 넣는다. */
export function formatMobilePhoneInput(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/** 010-****-5678. 요청 화면 · 내역에는 가운데를 가린다 — 본인에게도 전체를 되돌려주지 않는다. */
export function maskMobilePhone(phone: string): string {
  const normalized = normalizeMobilePhone(phone);
  if (!normalized) return '***';
  return `${normalized.slice(0, 4)}****${normalized.slice(8)}`;
}

export const REWARD_PAYOUT_NOTIFICATION = {
  sent: (amount: string) => ({ title: `${amount}을 Npay로 보내드렸어요`, body: REWARD_PAYOUT_STATUS_NOTE.sent }),
  failed: (reason: string) => ({ title: '리워드를 보내지 못했어요', body: reason }),
} as const;
