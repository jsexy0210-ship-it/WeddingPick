import type { ExpenseSummaryResponse } from '@weddingpick/api-contract';
import { VENDOR_CATEGORIES, VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';

type Summary = Pick<ExpenseSummaryResponse, 'buckets' | 'expenses'>;
type Expense = ExpenseSummaryResponse['expenses'][number];

/**
 * 예산현황 카드의 업종 한 줄 — 머리(이름 · 금액) · 막대 · 발(냈어요 · %) 아래에 그 업종의 지출 건이 선다.
 *
 * `key`는 업종 코드(`hall` · `dress` …)이고, 지출이 하나도 없을 때만 서버 묶음(`hall` · `sdm` · `etc`)이다.
 */
export type BudgetCategoryRow = {
  key: string;
  label: string;
  amount: number;
  /** 낸 돈 전체에서 이 줄이 차지하는 몫(0~1) — 막대 길이와 %. */
  ratio: number;
  expenses: Expense[];
};

function categoryOf(expense: Pick<Expense, 'category'>): VendorCategory {
  const category = expense.category;
  /* 업종이 없는 줄 · 더는 고르지 않는 업종(결정사)은 «기타»다 — 서버 `bucketFor`와 같은 자리. */
  return category !== null && (VENDOR_CATEGORIES as readonly string[]).includes(category) ? category : 'etc';
}

/**
 * 예산현황 업종 목록(2026-09-26 대표 지시 — 「지출내역을 예산현황 목록과 통/폐합한다」 ·
 * 「예산 추가 시 입력한 카테고리별로 목록 화면에 예산 목록이 나오지 않는다」).
 *
 * **왜 서버 `buckets`가 아닌가.** 서버는 열한 업종을 세 묶음(웨딩홀 · 스드메 · 기타)으로 접는다
 * (`bucketFor` — 홈 누적 막대용). 그래서 «드레스»로 넣은 지출은 «스드메»에, «본식스냅» · «부케» ·
 * «청첩장»은 전부 «기타»에 녹아 사용자가 고른 이름이 목록 어디에도 안 보였다. 예산 추가 시트가
 * 고르게 하는 것이 업종(`VENDOR_CATEGORIES`)이므로 카드도 **고른 업종 그대로** 묶는다.
 *
 *   - 낸 돈(`status: 'paid'`)만 센다 — 합계 · 도넛과 같은 기준(잔금 예정은 더하지 않는다)
 *   - 순서는 업종 순서(`VENDOR_CATEGORIES` — 웨딩홀 → 스튜디오 → … → 기타)
 *   - 지출이 있는 업종만 줄이 된다. 한 건도 없으면 예전처럼 서버 묶음 셋을 0원으로 세운다
 *     (빈 카드가 되지 않게 — 줄 안에 지출 건이 없으니 수정 · 삭제 아이콘도 없다)
 *   - 한 업종 안의 건은 서버 순서(낸 날짜 최근 순) 그대로
 */
export function budgetCategoryRows(summary: Summary): BudgetCategoryRow[] {
  const paid = summary.expenses.filter((expense) => expense.status === 'paid');

  if (paid.length === 0) {
    return summary.buckets.map((bucket) => ({
      key: bucket.bucket,
      label: bucket.label,
      amount: bucket.amount,
      ratio: bucket.ratio,
      expenses: [],
    }));
  }

  const total = paid.reduce((sum, expense) => sum + expense.amount, 0);
  const grouped = new Map<VendorCategory, Expense[]>();

  for (const expense of paid) {
    const key = categoryOf(expense);
    grouped.set(key, [...(grouped.get(key) ?? []), expense]);
  }

  return VENDOR_CATEGORIES.filter((category) => grouped.has(category)).map((category) => {
    const expenses = grouped.get(category)!;
    const amount = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    return {
      key: category,
      label: VENDOR_CATEGORY_LABEL[category],
      amount,
      ratio: total === 0 ? 0 : amount / total,
      expenses,
    };
  });
}
