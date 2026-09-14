/**
 * 인증 심사 결정을 서버가 받는 모양으로 바꾼다.
 *
 * **화면과 서버가 어긋나 있던 자리다.** `POST /v1/admin/verifications/:id/approve`는
 * `note`를 보낼 거면 빈 문자열이 아니어야 하고(`z.string().trim().min(1)`),
 * `.../reject`는 `reason`을 **반드시** 받는다. 그런데 화면은 메모 칸을 비운 채로도
 * `{ note: '' }` · `{ reason: '' }`를 그대로 보냈다. 서버는 400을 주고, 화면에는
 * 「API /v1/admin/… → 400」만 떴다 — 무엇이 모자란지 말해 주지 않는 오류다.
 *
 * 그래서 보내기 전에 여기서 막고 사람 말로 알려준다. 반려 사유를 요구하는 것은
 * 화면의 편의가 아니라 규칙이다: 되돌릴 수 없는 조작은 사유를 받고 기록을
 * 남긴다(`structured.decisions`에 그대로 적힌다).
 *
 * 승인 메모는 선택이다. 서버가 `null`을 허용하므로 비었으면 `null`로 보낸다 —
 * 빈 문자열로 보내면 「적었는데 내용이 없다」가 되어 거절당한다.
 */
export type VerificationAction = 'approve' | 'reject';

export type DecisionRequest =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; message: string };

export function verificationDecisionRequest(
  action: VerificationAction,
  note: string
): DecisionRequest {
  const trimmed = note.trim();

  if (action === 'reject') {
    if (trimmed.length === 0) return { ok: false, message: '반려 사유를 입력해주세요.' };

    return { ok: true, body: { reason: trimmed } };
  }

  return { ok: true, body: { note: trimmed.length > 0 ? trimmed : null } };
}
