import {
  EXPENSE_BUCKETS,
  EXPENSE_REFUND_STATUSES,
  EXPENSE_REFUND_STATUS_LABEL,
  EXPENSE_SOURCES,
  EXPENSE_SOURCE_LABEL,
  SCHEDULED_NOTE,
  bucketFor,
  budgetView,
  budgetRaiseForProof,
  manualExpenseOverBudget,
  summarizeExpenses,
} from './expense';

describe('세 갈래로 묶는다', () => {
  it('업종을 갈래로 옮긴다', () => {
    expect(EXPENSE_BUCKETS).toEqual(['hall', 'sdm', 'etc']);
    expect(bucketFor('hall')).toBe('hall');
    // 2026-09-24 결정사 갈래를 뺐다 — 과거 결정사 지출은 기타로 센다.
    expect(bucketFor('wedding_info_company')).toBe('etc');
    expect(bucketFor('studio')).toBe('sdm');
    expect(bucketFor('dress')).toBe('sdm');
    expect(bucketFor('makeup')).toBe('sdm');
    expect(bucketFor('hair')).toBe('sdm');
    expect(bucketFor('bouquet')).toBe('etc');
    expect(bucketFor('dowry')).toBe('etc');
    expect(bucketFor('invitation')).toBe('etc');
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

describe('지출 출처', () => {
  it('상담 정리가 셋째 출처다 — 실 제보와 분리하지 않고 줄마다 출처를 적는다', () => {
    // v3.28 웨딩노트 대조표 「금액 출처」 · 2026-09-23 대표 결정.
    expect(EXPENSE_SOURCES).toEqual(['payment_proof', 'manual', 'consultation']);
    for (const source of EXPENSE_SOURCES) {
      expect(EXPENSE_SOURCE_LABEL[source].length).toBeGreaterThan(0);
    }
    expect(EXPENSE_SOURCE_LABEL.consultation).toBe('상담 정리');
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

describe('직접 입력 지출은 총예산을 넘을 수 없다(2026-09-25)', () => {
  const budget = 10_000_000;

  it('총예산이 없거나 0이면 한도가 없다', () => {
    expect(manualExpenseOverBudget({ budget: null, spent: 9_000_000, before: 0, after: 50_000_000 }).over).toBe(false);
    expect(manualExpenseOverBudget({ budget: 0, spent: 9_000_000, before: 0, after: 50_000_000 }).over).toBe(false);
  });

  it('딱 맞으면 통과, 1원이라도 넘으면 막고 남은 예산을 준다', () => {
    expect(manualExpenseOverBudget({ budget, spent: 6_000_000, before: 0, after: 4_000_000 }).over).toBe(false);
    expect(manualExpenseOverBudget({ budget, spent: 6_000_000, before: 0, after: 4_000_001 })).toEqual({
      over: true,
      remaining: 4_000_000,
    });
  });

  it('수정은 자기 줄을 빼고 센다', () => {
    // 6백만 중 이 줄이 2백만 — 나머지 4백만 + 새 6백만 = 1천만(딱 맞음).
    expect(manualExpenseOverBudget({ budget, spent: 6_000_000, before: 2_000_000, after: 6_000_000 }).over).toBe(false);
    expect(manualExpenseOverBudget({ budget, spent: 6_000_000, before: 2_000_000, after: 6_000_001 })).toEqual({
      over: true,
      remaining: 6_000_000,
    });
  });

  it('이미 넘은 웨딩에서도 금액을 늘리지 않는 수정은 막지 않는다', () => {
    expect(manualExpenseOverBudget({ budget, spent: 12_000_000, before: 3_000_000, after: 2_000_000 }).over).toBe(false);
    expect(manualExpenseOverBudget({ budget, spent: 12_000_000, before: 0, after: 1 })).toEqual({
      over: true,
      remaining: 0,
    });
  });
});

describe('Pick 인증이 총예산을 넘기면 넘은 만큼 늘린다(2026-09-26 대표 결정)', () => {
  it('넘으면 새 총예산은 낸 돈 합이고 늘어난 금액은 넘은 만큼이다', () => {
    expect(budgetRaiseForProof({ budget: 10_000_000, spent: 13_000_000 })).toEqual({
      before: 10_000_000,
      budget: 13_000_000,
      raisedBy: 3_000_000,
    });
  });

  it('안 넘거나 딱 맞으면 그대로다', () => {
    expect(budgetRaiseForProof({ budget: 10_000_000, spent: 9_000_000 })).toBeNull();
    expect(budgetRaiseForProof({ budget: 10_000_000, spent: 10_000_000 })).toBeNull();
  });

  it('총예산이 없으면 한도도 없어 늘리지 않는다', () => {
    expect(budgetRaiseForProof({ budget: null, spent: 50_000_000 })).toBeNull();
    expect(budgetRaiseForProof({ budget: 0, spent: 50_000_000 })).toBeNull();
  });
});
