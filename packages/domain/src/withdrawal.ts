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
 * 확정된 안내문. **방침이 확정되기 전에는 null이다.**
 *
 * 여기에 그럴듯한 초안을 넣어두면 안 된다. 초안과 확정본을 화면이 구분하지 못하고,
 * 구분하지 못하면 초안이 그대로 나간다.
 */
export const WITHDRAWAL_NOTICE: string | null = null;

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
 * 방침이 확정됐는데 문장을 안 옮겨 적었으면 그것도 "아직"이다 — 확정만 하고
 * 옮기지 않은 상태가 가장 위험하다. 화면은 방침이 있다고 믿고 무언가 말하려 든다.
 */
export function withdrawalNotice(): string {
  if (privacyPolicyConfirmed() && WITHDRAWAL_NOTICE !== null) return WITHDRAWAL_NOTICE;

  return WITHDRAWAL_PENDING;
}

/**
 * 이 상태로 서비스를 열어도 되는가.
 *
 * 탈퇴 안내 없이 문을 열면 사용자는 자기가 낸 자료가 어떻게 되는지 모르는 채로
 * 가입한다. `release-gate`가 이 값을 함께 본다.
 */
export function withdrawalReady(): boolean {
  return privacyPolicyConfirmed() && WITHDRAWAL_NOTICE !== null;
}
