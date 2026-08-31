import {
  CONDITION_NOT_ENOUGH,
  DISCLOSURE_THRESHOLDS,
  canDiscloseCondition,
  disclosureCaption,
  disclosureStage,
  discloseAmounts,
  hasDeepData,
  manwon,
  rangeLabel,
} from './disclosure';

const PERIOD = '최근 12개월';

/** 30만원 단위로 흩어진 금액 n건. */
function amounts(count: number): number[] {
  return Array.from({ length: count }, (_, index) => 2_500_000 + index * 100_000);
}

describe('공개 단계', () => {
  it('경계에서 갈린다', () => {
    expect(disclosureStage(0)).toBe('collecting');
    expect(disclosureStage(2)).toBe('collecting');
    expect(disclosureStage(3)).toBe('early');
    expect(disclosureStage(4)).toBe('early');
    expect(disclosureStage(5)).toBe('general');
    expect(disclosureStage(9)).toBe('general');
    expect(disclosureStage(10)).toBe('detailed');
  });

  it('경계값이 정책 숫자와 같다', () => {
    // 화면마다 숫자를 다시 적지 않게, 기준을 한곳에 두고 여기서 지킨다.
    expect(disclosureStage(DISCLOSURE_THRESHOLDS.early)).toBe('early');
    expect(disclosureStage(DISCLOSURE_THRESHOLDS.general)).toBe('general');
    expect(disclosureStage(DISCLOSURE_THRESHOLDS.detailed)).toBe('detailed');
  });
});

describe('금액 공개', () => {
  it('2건까지는 구간을 만들지 않는다', () => {
    const disclosed = discloseAmounts({ amounts: amounts(2), period: PERIOD });

    expect(disclosed.stage).toBe('collecting');
    // 타입에 구간이 없다. 화면이 그릴 수 있는 것이 애초에 없다.
    expect('low' in disclosed).toBe(false);
    expect(disclosed.count).toBe(2);
  });

  it('3건부터 구간이 나오되 데이터가 적다고 말한다', () => {
    const disclosed = discloseAmounts({ amounts: amounts(3), period: PERIOD });

    expect(disclosed.stage).toBe('early');
    expect(disclosed.caption).toContain('아직 데이터가 적어요');
    expect('low' in disclosed && disclosed.low).toBeGreaterThan(0);
  });

  it('5건부터는 데이터 부족 안내를 떼고 기준 기간을 적는다', () => {
    const disclosed = discloseAmounts({ amounts: amounts(5), period: PERIOD });

    expect(disclosed.stage).toBe('general');
    expect(disclosed.caption).toBe(`확인된 정보 5건 · ${PERIOD}`);
  });

  it('10건부터 중앙값이 생긴다', () => {
    const disclosed = discloseAmounts({ amounts: amounts(10), period: PERIOD });

    expect(disclosed.stage).toBe('detailed');
    expect('median' in disclosed).toBe(true);
  });

  it('9건까지는 중앙값을 만들지 않는다', () => {
    // 중앙값은 상세 정보다. 구간을 보여준다고 해서 따라 나오지 않는다.
    expect('median' in discloseAmounts({ amounts: amounts(9), period: PERIOD })).toBe(false);
  });

  it('한 건의 특이값이 구간을 늘리지 않는다', () => {
    /*
     * 최저·최고를 쓰면 3억짜리 한 건이 구간을 통째로 망가뜨린다. 분포의 허리를
     * 쓰는 이유다.
     */
    const withOutlier = discloseAmounts({
      amounts: [...amounts(9), 300_000_000],
      period: PERIOD,
    });

    expect(withOutlier.stage).toBe('detailed');
    expect('high' in withOutlier && withOutlier.high).toBeLessThan(10_000_000);
  });

  it('구간은 낮은 쪽이 높은 쪽보다 크지 않다', () => {
    for (const count of [3, 4, 5, 7, 10, 25]) {
      const disclosed = discloseAmounts({ amounts: amounts(count), period: PERIOD });

      if ('low' in disclosed) expect(disclosed.low).toBeLessThanOrEqual(disclosed.high);
    }
  });

  it('데이터 수는 언제나 함께 나온다', () => {
    // 원문 16번 — 금액을 공개하는 모든 화면에 데이터 수와 기준 기간을 적는다.
    for (const count of [0, 3, 5, 10]) {
      expect(discloseAmounts({ amounts: amounts(count), period: PERIOD }).caption).toContain(
        `${count}건`
      );
    }
  });
});

describe('조건별 공개', () => {
  it('전체가 상세 단계여도 그 조건이 모자라면 내지 않는다', () => {
    /*
     * 전체 12건 중 그 조건이 1건이면, 그 1건은 조건별 가격이 아니라 한 사람의
     * 결제다.
     */
    expect(canDiscloseCondition({ totalCount: 12, conditionCount: 1 })).toBe(false);
    expect(canDiscloseCondition({ totalCount: 12, conditionCount: 3 })).toBe(true);
  });

  it('전체가 상세 단계가 아니면 조건별은 아예 없다', () => {
    expect(canDiscloseCondition({ totalCount: 9, conditionCount: 9 })).toBe(false);
  });

  it('모자랄 때 할 말이 있다', () => {
    expect(CONDITION_NOT_ENOUGH.length).toBeGreaterThan(0);
  });
});

describe('기준금액 표기', () => {
  it('상세 단계에서만 캡션에 기준금액이 붙는다', () => {
    /*
     * v3.1 §11의 표준 꼴. 중앙값이 없는 단계에 이름만 붙이면, 읽는 사람은
     * 우리가 계산하지 않은 값을 계산했다고 믿는다.
     */
    const general = discloseAmounts({ amounts: [100, 200, 300, 400, 500], period: PERIOD });
    const detailed = discloseAmounts({
      amounts: Array.from({ length: 10 }, (_, i) => (i + 1) * 1_000_000),
      period: PERIOD,
    });

    expect(general.caption).not.toContain('기준금액');
    expect(detailed.caption).toContain('기준금액');
  });

  it('캡션의 기준금액이 실제 중앙값과 같다', () => {
    const detailed = discloseAmounts({
      amounts: Array.from({ length: 10 }, (_, i) => (i + 1) * 1_000_000),
      period: PERIOD,
    });

    expect(detailed.stage).toBe('detailed');
    if (detailed.stage !== 'detailed') return;

    expect(detailed.caption).toContain(manwon(detailed.median));
  });

  it('평균이라고 적지 않는다', () => {
    // 우리가 계산한 것은 중앙값이다. 이름을 잘못 붙이면 그 계산을 했다고 믿는다.
    const detailed = discloseAmounts({
      amounts: Array.from({ length: 12 }, (_, i) => (i + 1) * 1_000_000),
      period: PERIOD,
    });

    expect(detailed.caption).not.toContain('평균');
  });
});

describe('결제인증이 여는 것', () => {
  it('구간이 아니라 깊이다', () => {
    /*
     * 이전 정책은 제보하지 않은 사람에게 구간을 잠갔다. v2.0 K-6이 그걸 폐기했다 —
     * 실제 결제 구간은 비회원도 본다.
     */
    expect(hasDeepData({ usablePaymentProofCount: 0 })).toBe(false);
    expect(hasDeepData({ usablePaymentProofCount: 1 })).toBe(true);
  });
});

describe('캡션', () => {
  it('단계마다 다른 말을 붙인다', () => {
    expect(disclosureCaption({ stage: 'collecting', count: 2, period: PERIOD })).toBe(
      '확인된 정보 2건 · 수집 중'
    );
    expect(disclosureCaption({ stage: 'early', count: 3, period: PERIOD })).toBe(
      '확인된 정보 3건 · 아직 데이터가 적어요'
    );
    expect(disclosureCaption({ stage: 'general', count: 8, period: PERIOD })).toBe(
      '확인된 정보 8건 · 최근 12개월'
    );
  });
});

describe('만원 표기', () => {
  it('정책 문서의 예시 그대로 적는다', () => {
    expect(rangeLabel(2_650_000, 3_050_000)).toBe('265~305만원');
    expect(rangeLabel(2_700_000, 3_100_000)).toBe('270~310만원');
  });

  it('단위는 뒤에 한 번만 붙인다', () => {
    expect(rangeLabel(2_650_000, 3_050_000)).not.toContain('만원~');
  });

  it('만원이 안 되는 금액은 원으로 적는다', () => {
    // 반올림하면 0만원이 되고, 0은 "없다"로 읽힌다.
    expect(manwon(5_000)).toBe('5,000원');
    expect(rangeLabel(5_000, 9_000)).toBe('5,000원~9,000원');
  });

  it('천 단위 쉼표를 넣는다', () => {
    expect(manwon(120_000_000)).toBe('12,000만원');
  });
});
