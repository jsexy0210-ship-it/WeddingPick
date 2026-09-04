import {
  EXPENSE_BUCKETS,
  EXPENSE_REFUND_STATUSES,
  EXPENSE_REFUND_STATUS_LABEL,
  SCHEDULED_NOTE,
  bucketFor,
  budgetView,
  summarizeExpenses,
} from './expense';

describe('네 갈래로 묶는다', () => {
  it('업종을 갈래로 옮긴다', () => {
    expect(bucketFor('hall')).toBe('hall');
    expect(bucketFor('wedding_info_company')).toBe('agency');
    expect(bucketFor('sdm')).toBe('sdm');
    // 나머지는 전부 기타다. 일곱 색을 나란히 놓으면 어느 것이 큰지 읽히지 않는다.
    expect(bucketFor('snap')).toBe('etc');
    expect(bucketFor(null)).toBe('etc');
  });
});

describe('지출 합계', () => {
  it('낸 돈만 더한다', () => {
    /*
     * 잔금을 더하면 "지금까지 결제한 금액"이 거짓말이 된다. 아직 안 냈다.
     */
    const summary = summarizeExpenses([
      { bucket: 'hall', amount: 10_000_000, status: 'paid' },
      { bucket: 'hall', amount: 20_000_000, status: 'scheduled' },
    ]);

    expect(summary.paidTotal).toBe(10_000_000);
    expect(summary.scheduledTotal).toBe(20_000_000);
  });

  it('갈래를 늘 넷 다 내보낸다', () => {
    // 0원인 갈래를 빼면 막대의 색 순서가 자료에 따라 달라진다.
    const summary = summarizeExpenses([{ bucket: 'hall', amount: 100, status: 'paid' }]);

    expect(summary.buckets.map((bucket) => bucket.bucket)).toEqual([...EXPENSE_BUCKETS]);
    expect(summary.buckets.find((bucket) => bucket.bucket === 'sdm')!.amount).toBe(0);
  });

  it('막대 길이를 낸 돈 기준으로 잰다', () => {
    const summary = summarizeExpenses([
      { bucket: 'hall', amount: 75, status: 'paid' },
      { bucket: 'sdm', amount: 25, status: 'paid' },
    ]);

    expect(summary.buckets.find((bucket) => bucket.bucket === 'hall')!.ratio).toBe(0.75);
  });

  it('아무것도 없으면 0으로 나누지 않는다', () => {
    const summary = summarizeExpenses([]);

    expect(summary.paidTotal).toBe(0);
    expect(summary.buckets.every((bucket) => bucket.ratio === 0)).toBe(true);
  });

  it('잔금을 왜 안 더하는지 말한다', () => {
    expect(SCHEDULED_NOTE).toContain('아직 더하지 않았어요');
  });
});

describe('환불 상태', () => {
  it('세 값 모두 사용자 화면 문구가 있다', () => {
    // WP-OUR-010: 빈 칸이나 未정의 값을 화면에 내보내지 않는다.
    for (const status of EXPENSE_REFUND_STATUSES) {
      expect(EXPENSE_REFUND_STATUS_LABEL[status].length).toBeGreaterThan(0);
    }
  });
});

describe('예산', () => {
  it('안 정했으면 지어내지 않는다', () => {
    /*
     * 결혼 예산은 사람마다 열 배씩 차이가 나서, 평균값을 깔아두면 그건 안내가
     * 아니라 유도다.
     */
    const view = budgetView({ budget: null, spent: 5_000_000 });

    expect(view.set).toBe(false);
    expect(view.set === false && view.note).toContain('총 예산을 정하시면');
  });

  it('남은 금액을 준다', () => {
    expect(budgetView({ budget: 30_000_000, spent: 10_000_000 })).toEqual({
      set: true,
      budget: 30_000_000,
      spent: 10_000_000,
      remaining: 20_000_000,
      over: false,
    });
  });

  it('넘겼으면 넘겼다고 말한다', () => {
    const view = budgetView({ budget: 10_000_000, spent: 12_000_000 });

    expect(view.set === true && view.over).toBe(true);
    // 음수를 감추지 않는다. 얼마나 넘겼는지가 필요한 정보다.
    expect(view.set === true && view.remaining).toBe(-2_000_000);
  });
});
