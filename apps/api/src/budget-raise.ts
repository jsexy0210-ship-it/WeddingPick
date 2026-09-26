import { budgetRaiseForProof, manwon } from '@weddingpick/domain';
import type { PoolClient } from 'pg';

import strings from '../../../spec/strings.ko.json';
import { notify } from './notify';

export type BudgetRaise = {
  weddingId: string;
  /** 늘리기 전 총예산(원). */
  before: number;
  /** 늘린 뒤 총예산 = 낸 돈 합(원). */
  budget: number;
  /** 늘어난 금액(원). */
  raisedBy: number;
};

/**
 * Pick 인증이 지출로 세어지는 순간 — 총예산을 넘었으면 넘은 만큼 총예산을 늘린다
 * (2026-09-26 대표 결정 「초과되는 금액만큼 총 예산도 늘려」).
 *
 * **결제인증이 `accepted`가 되는 그 트랜잭션 안에서 부른다.** `wedding_expenses` 뷰는
 * `review_state = 'accepted'`인 결제인증을 올린 사람의 웨딩(본인 · 배우자)에 넣으므로, 같은
 * 트랜잭션에서 읽으면 방금 들어간 줄까지 센 낸 돈 합이 나온다. 자리는 둘이다:
 *
 *   - `routes/payment-proofs.ts`  사진을 올리자마자 읽어 `accepted`로 넣을 때
 *   - `payment-proof-admin.ts`    검수 대기(`pending_review`)를 운영자가 풀 때
 *
 * 검수 대기 줄은 지출에 안 들어가므로 이 규칙도 그때는 돌지 않는다.
 *
 *   - 총예산이 없거나 0이면 한도가 없다 — 아무것도 바꾸지 않는다
 *   - 웨딩 줄을 `FOR UPDATE`로 잡는다 — 직접 입력의 한도 판정(`assertManualExpenseWithinBudget`)과
 *     같은 줄을 잡으므로 둘이 엇갈려 읽지 않는다
 *   - 직접 입력은 이 규칙을 타지 않는다 — 여전히 총예산을 넘으면 막는다
 *
 * **늘렸다는 사실을 알림으로 남긴다**(웨딩의 두 사람 모두 · 같은 트랜잭션). 웨딩노트
 * «변경내역»(`wedding/[id]/changelog.tsx`)이 알림을 그대로 읽는다 — 새 표를 만들지 않았다.
 * 같은 트랜잭션에 두는 이유는 검수 기록(`recordDecision`)과 같다: 총예산은 바뀌었는데 왜
 * 바뀌었는지가 빠진 상태가 남지 않게.
 */
export async function raiseBudgetForAcceptedProof(
  client: PoolClient,
  input: { reporterUserId: string; paymentProofId: string }
): Promise<BudgetRaise | null> {
  const weddings = await client.query<{
    id: string;
    budget_amount: string | null;
    owner_user_id: string;
    partner_user_id: string | null;
  }>(
    `SELECT id, budget_amount, owner_user_id, partner_user_id
     FROM structured.weddings
     WHERE owner_user_id = $1 OR partner_user_id = $1
     ORDER BY created_at
     FOR UPDATE`,
    [input.reporterUserId]
  );

  let first: BudgetRaise | null = null;

  for (const wedding of weddings.rows) {
    const budget = wedding.budget_amount === null ? null : Number(wedding.budget_amount);
    if (budget === null || !(budget > 0)) continue;

    const spent = await client.query<{ spent: string }>(
      `SELECT coalesce(sum(amount), 0) AS spent
       FROM structured.wedding_expenses
       WHERE wedding_id = $1 AND status = 'paid'`,
      [wedding.id]
    );
    const raise = budgetRaiseForProof({ budget, spent: Number(spent.rows[0]!.spent) });
    if (!raise) continue;

    await client.query('UPDATE structured.weddings SET budget_amount = $2 WHERE id = $1', [
      wedding.id,
      raise.budget,
    ]);

    const title = strings.ourWedding['expense.budgetRaised'].replace('{amount}', manwon(raise.raisedBy));
    const body = strings.ourWedding['expense.budgetRaisedBody'].replace('{budget}', manwon(raise.budget));
    for (const userId of [wedding.owner_user_id, wedding.partner_user_id]) {
      if (!userId) continue;
      await notify(client, { userId, kind: 'verification', title, body, targetId: input.paymentProofId });
    }

    first ??= { weddingId: wedding.id, ...raise };
  }

  return first;
}
