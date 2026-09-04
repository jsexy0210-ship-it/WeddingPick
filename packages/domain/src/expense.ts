import type { VendorCategory } from './vendor';

/**
 * 지출내역. 디자인 핸드오프 14번.
 *
 * **내가 쓴 돈이지 시장 자료가 아니다.** 그래서 결제인증과 직접 입력을 한 목록에
 * 모아도 된다 — 섞으면 안 되는 것은 근거가 다른 **남들의** 숫자였다. 다만 어디서
 * 온 값인지는 줄마다 적는다.
 */

export const EXPENSE_SOURCES = ['payment_proof', 'manual'] as const;

export type ExpenseSource = (typeof EXPENSE_SOURCES)[number];

/**
 * 이 줄이 어디서 왔는지. 사용자 화면에 그대로 나간다.
 *
 * `결제인증`은 내부 이름이다. 사용자에게는 자기가 한 일로 적는다 — 제보한
 * 결제내역이 여기 들어왔다는 뜻이지, 무엇이 인증됐다는 뜻이 아니다.
 */
export const EXPENSE_SOURCE_LABEL: Record<ExpenseSource, string> = {
  payment_proof: 'Pick 인증 자료',
  manual: '직접 입력',
};

export const EXPENSE_STATUSES = ['paid', 'scheduled'] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  /* v3.13 §O-1이 사용자 앱에서 `결제`를 막았다. 지출 화면이라 지출로 적는다. */
  paid: '지출완료',
  scheduled: '지출예정',
};

/**
 * 네 갈래로 묶는다. 핸드오프 홈 5번의 4색 누적 막대와 4열 범례.
 *
 * 업종은 일곱인데 막대는 넷이다. 일곱 색을 나란히 놓으면 어느 것이 큰지 읽히지
 * 않는다 — 묶는 이유가 그것이다.
 */
export const EXPENSE_BUCKETS = ['hall', 'agency', 'sdm', 'etc'] as const;

export type ExpenseBucket = (typeof EXPENSE_BUCKETS)[number];

export const EXPENSE_BUCKET_LABEL: Record<ExpenseBucket, string> = {
  hall: '웨딩홀',
  agency: '결정사',
  sdm: '스드메',
  etc: '기타',
};

/**
 * 막대와 텍스트 색을 나눈다. 핸드오프 규칙 — 옅은 막대색을 글씨에 쓰면 대비가 모자란다.
 *
 * 값은 UI의 색 역할 이름이다. `as const`로 두는 이유는 화면이 `theme[...]`로 집을 때
 * 타입이 살아 있어야 하기 때문이다 — string으로 두면 오타가 런타임까지 간다.
 */
export const EXPENSE_BUCKET_COLOR = {
  hall: { bar: 'tint', text: 'tint' },
  agency: { bar: 'chartTeal', text: 'chartTealText' },
  sdm: { bar: 'chartViolet', text: 'chartVioletText' },
  etc: { bar: 'chartMuted', text: 'chartMutedText' },
} as const satisfies Record<ExpenseBucket, { bar: string; text: string }>;

export function bucketFor(category: VendorCategory | null): ExpenseBucket {
  if (category === 'hall') return 'hall';
  if (category === 'wedding_info_company') return 'agency';
  if (category === 'sdm') return 'sdm';

  return 'etc';
}

export type ExpenseLine = {
  bucket: ExpenseBucket;
  amount: number;
  status: ExpenseStatus;
};

export type ExpenseSummary = {
  /** 실제로 낸 돈. 화면 맨 위 큰 숫자다. */
  paidTotal: number;
  /** 아직 안 낸 돈. **합계에 더하지 않는다.** */
  scheduledTotal: number;
  buckets: { bucket: ExpenseBucket; label: string; amount: number; ratio: number }[];
};

/**
 * 낸 돈과 낼 돈을 갈라 센다.
 *
 * 핸드오프 14번: 잔금 예정 행은 회색이고 `잔금은 예식 후 결제라 아직 더하지
 * 않았어요`라고 적는다. **더하면 안 되는 이유는 아직 안 냈기 때문이다** — 합치면
 * "지금까지 결제한 금액"이 거짓말이 된다.
 */
export function summarizeExpenses(lines: readonly ExpenseLine[]): ExpenseSummary {
  const paid = lines.filter((line) => line.status === 'paid');
  const paidTotal = paid.reduce((sum, line) => sum + line.amount, 0);

  const byBucket = new Map<ExpenseBucket, number>();

  for (const line of paid) {
    byBucket.set(line.bucket, (byBucket.get(line.bucket) ?? 0) + line.amount);
  }

  return {
    paidTotal,
    scheduledTotal: lines
      .filter((line) => line.status === 'scheduled')
      .reduce((sum, line) => sum + line.amount, 0),
    /*
     * 네 갈래를 늘 다 내보낸다. 0원인 갈래를 빼면 막대의 색 순서가 자료에 따라
     * 달라지고, 같은 화면을 두 번 보는 사람이 다른 것으로 읽는다.
     */
    buckets: EXPENSE_BUCKETS.map((bucket) => {
      const amount = byBucket.get(bucket) ?? 0;

      return {
        bucket,
        label: EXPENSE_BUCKET_LABEL[bucket],
        amount,
        ratio: paidTotal === 0 ? 0 : amount / paidTotal,
      };
    }),
  };
}

export const SCHEDULED_NOTE = '잔금은 예식 뒤에 내는 돈이라 아직 더하지 않았어요';

/**
 * 환불 상태. 지출 상세(WP-OUR-010)에서만 쓴다.
 *
 * 결제인증(payment_proofs)에서 온 줄에는 이 개념이 없다 — 아직 환불·취소를 그
 * 표에서 추적하지 않는다. 그래서 늘 `normal`로 고정해 보여준다. 직접 입력한
 * 지출(structured.expenses)에만 실제 값이 있다.
 */
export const EXPENSE_REFUND_STATUSES = ['normal', 'partial_refund', 'cancelled'] as const;

export type ExpenseRefundStatus = (typeof EXPENSE_REFUND_STATUSES)[number];

export const EXPENSE_REFUND_STATUS_LABEL: Record<ExpenseRefundStatus, string> = {
  normal: '정상',
  partial_refund: '부분환불',
  cancelled: '전액취소',
};

export type BudgetView =
  | { set: false; note: string }
  | { set: true; budget: number; spent: number; remaining: number; over: boolean };

/**
 * 예산과 견준다.
 *
 * **예산이 없으면 지어내지 않는다.** 결혼 예산은 사람마다 열 배씩 차이가 나서,
 * 평균값을 깔아두면 그건 안내가 아니라 유도다.
 */
export function budgetView(input: { budget: number | null; spent: number }): BudgetView {
  if (input.budget === null) {
    return { set: false, note: '총 예산을 정하시면 남은 금액을 함께 보여드려요' };
  }

  return {
    set: true,
    budget: input.budget,
    spent: input.spent,
    remaining: input.budget - input.spent,
    over: input.spent > input.budget,
  };
}
