/**
 * 나눠 낸 금액 묶기 · WP-RPT-006.
 *
 * 계약서 한 장에 계약금과 잔금이 따로 적혀 있으면 「계약금액」 한 줄만으로는 얼마짜리
 * 계약인지 알 수 없다. 두 조각이 다 읽혔을 때 합계를 알려주는 것이 이 화면의 일이다.
 *
 * **중도금은 아직 읽지 않는다.** 시안(00-ia)은 계약금·중도금·잔금 셋을 말하지만 문서
 * 분석 스키마(apps/api/src/analysis/schema.ts)에는 `depositAmount`와 `balanceAmount`
 * 둘뿐이다. 없는 값을 있는 척 합치지 않는다 — 스키마에 중도금이 생기면 여기 더한다.
 */

export type SplitPaymentParts = {
  /** 계약금 또는 가계약금. 읽지 못했으면 null. */
  readonly deposit: number | null;
  /** 잔금. 읽지 못했으면 null. */
  readonly balance: number | null;
};

export type SplitPayment = {
  /** 묶은 금액. 원 단위 그대로다 — 반올림하지 않는다. */
  readonly total: number;
  /** 무엇을 묶었는지. 화면이 합계 밑에 그대로 적어 계산을 보이게 한다. */
  readonly parts: readonly { readonly label: string; readonly amount: number }[];
};

/**
 * 나뉘어 적힌 금액이 **둘 이상**일 때만 묶는다.
 *
 * 하나뿐이면 묶을 것이 없다(시안 상태 「단건」) — 계약금만 읽힌 자료에 「같이 묶으면
 * 총 …」을 붙이면 그 하나가 총액인 것처럼 읽힌다.
 */
export function splitPayment(parts: SplitPaymentParts): SplitPayment | null {
  const found = [
    parts.deposit === null ? null : { label: '계약금', amount: parts.deposit },
    parts.balance === null ? null : { label: '잔금', amount: parts.balance },
  ].filter((part): part is { label: string; amount: number } => part !== null);

  if (found.length < 2) return null;

  return { total: found.reduce((sum, part) => sum + part.amount, 0), parts: found };
}
