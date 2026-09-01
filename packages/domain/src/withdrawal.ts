import { POLICY_DOCUMENTS } from './policies';

/**
 * 탈퇴하면 내가 낸 것이 어떻게 되는가.
 *
 * 이 질문에는 **개인정보처리방침이 답한다.** 화면 카피가 먼저 답하면 두 가지가
 * 생긴다. 방침이 다르게 정해졌을 때 우리가 거짓말한 것이 되고, 그 전까지는
 * 아무 근거 없이 한 약속이 화면에 걸려 있게 된다.
 *
 * 그래서 여기서는 **문장을 짓지 않는다.** 방침이 확정되면 그 문장을 그대로
 * `WITHDRAWAL_NOTICE`에 옮겨 적고, 그때부터 FAQ와 탈퇴 화면이 같은 말을 한다.
 * 옮겨 적기 전까지는 화면이 "아직 안내드릴 수 없다"고 말한다 — 모르는 것을
 * 아는 척하지 않는 것이 이 서비스의 규칙이다.
 */

/**
 * 확정된 안내문. 개인정보처리방침과 별개로, 문장이 확정되면 여기에 옮겨 적는다.
 * 방침 URL이 게시되지 않아도 문장은 화면에 나간다 — `withdrawalReady()`가
 * 둘 다 요구하고, 화면은 문장이 있으면 보여준다.
 */
export const WITHDRAWAL_NOTICE: string | null =
  '탈퇴하면 계정과 개인화 정보는 삭제되며, 다시 되돌릴 수 없어요.';

/** 탈퇴 후 작성자 정보와 분리되어 유지될 수 있는 항목. */
export const WITHDRAWAL_ANON_SECTION = {
  title: '작성자 정보와 분리되는 정보',
  items: ['작성하신 후기', '제공하신 확인된 정보'] as const,
  footer: '후기와 확인된 정보는 나를 알아볼 수 없도록 분리해 유지될 수 있어요.',
} as const;

/** 아직 답할 수 없을 때 화면이 그대로 적는 말. */
export const WITHDRAWAL_PENDING =
  '탈퇴 뒤 자료가 어떻게 되는지는 개인정보처리방침이 확정되면 안내드려요';

/** 개인정보처리방침이 확정됐는가. 확정본이 게시된 것만 확정으로 본다. */
export function privacyPolicyConfirmed(): boolean {
  const privacy = POLICY_DOCUMENTS.find((policy) => policy.id === 'privacy');

  return privacy?.url !== undefined;
}

/**
 * 지금 화면에 적을 말.
 *
 * 문장이 확정됐으면 방침 URL 게시 여부와 무관하게 보여준다. 방침과 문장은 별개로
 * 확정된다 — 방침이 게시되기 전에 문장이 먼저 확정될 수 있다.
 */
export function withdrawalNotice(): string {
  if (WITHDRAWAL_NOTICE !== null) return WITHDRAWAL_NOTICE;

  return WITHDRAWAL_PENDING;
}

/**
 * 이 상태로 서비스를 열어도 되는가.
 *
 * 탈퇴 안내 없이 문을 열면 사용자는 자기가 낸 자료가 어떻게 되는지 모르는 채로
 * 가입한다. 방침 URL과 문장 둘 다 있어야 열 수 있다.
 */
export function withdrawalReady(): boolean {
  return privacyPolicyConfirmed() && WITHDRAWAL_NOTICE !== null;
}
