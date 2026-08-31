import {
  ADVERTISING_MUST_NOT_AFFECT,
  PROTECTED_SURFACE_LABEL,
  RANKING_REASONS,
  RANKING_REASON_LABEL,
  SPONSORED_LABEL,
  isSeparated,
  type Placement,
  AD_METRICS,
  AD_PROMOTIONS,
  AD_TIER_RULES,
  firstMonthKrw,
  surfacesFor,
} from './advertising';

const organic = (): Placement => ({ kind: 'organic', reasons: ['search_match'] });
const sponsored = (): Placement => ({ kind: 'sponsored', label: SPONSORED_LABEL });

describe('광고 방화벽', () => {
  it('광고가 건드리지 못하는 것이 여섯이다', () => {
    /*
     * 광고가 아직 없다. 없는 동안 경계를 정해두는 것이 싸다 — 생긴 뒤에 나누려
     * 하면 이미 섞여 있고, 무엇이 광고 때문인지 아무도 답할 수 없게 된다.
     */
    expect(ADVERTISING_MUST_NOT_AFFECT).toHaveLength(6);

    for (const surface of ADVERTISING_MUST_NOT_AFFECT) {
      expect(PROTECTED_SURFACE_LABEL[surface].length).toBeGreaterThan(0);
    }
  });

  it('광고를 자연 결과 사이에 끼워 넣지 않는다', () => {
    // 섞어 놓고 배지만 붙이면, 배지를 못 본 사람에게 그건 그냥 검색 결과다.
    expect(isSeparated([sponsored(), organic(), organic()])).toBe(true);
    expect(isSeparated([organic(), sponsored(), organic()])).toBe(false);
  });

  it('한쪽만 있으면 섞일 일이 없다', () => {
    expect(isSeparated([organic(), organic()])).toBe(true);
    expect(isSeparated([sponsored()])).toBe(true);
    expect(isSeparated([])).toBe(true);
  });

  it('자연 결과에는 왜 이 순서인지가 붙는다', () => {
    // E-2: 추천/랭킹 결과에는 내부적으로 근거를 기록한다.
    const row = organic();

    expect(row.kind === 'organic' && row.reasons.length).toBeGreaterThan(0);
  });

  it('광고 여부는 순위 근거와 다른 자리에 있다', () => {
    /*
     * 하나로 섞으면 "이 업체가 위에 있는 것이 광고 때문인지"에 답할 수 없다.
     * 판별 유니온이라 sponsored에는 reasons를 담을 자리가 아예 없다.
     */
    expect(RANKING_REASONS).not.toContain('sponsored');

    for (const reason of RANKING_REASONS) {
      expect(RANKING_REASON_LABEL[reason].length).toBeGreaterThan(0);
    }
  });

  it('유료 노출에 붙는 말이 분명하다', () => {
    expect(SPONSORED_LABEL).toBe('광고');
  });
});

describe('초기 광고 상품 (v3.10)', () => {
  it('위 등급이 아래 등급 지면을 포함한다', () => {
    // 포함 관계를 등급마다 따로 적어두면 언젠가 한쪽만 고쳐진다. 순서에서 계산한다.
    expect(surfacesFor('light')).toEqual(['vendor_detail']);
    expect(surfacesFor('standard')).toEqual(['vendor_detail', 'search']);
    expect(surfacesFor('premium')).toEqual(['vendor_detail', 'search', 'region_category']);
  });

  it('정책이 적은 금액 그대로다', () => {
    expect(AD_TIER_RULES.light.monthlyKrw).toBe(30_000);
    expect(AD_TIER_RULES.standard.monthlyKrw).toBe(70_000);
    expect(AD_TIER_RULES.premium.monthlyKrw).toBe(150_000);
  });

  it('프로모션은 첫 달에만 걸린다', () => {
    expect(firstMonthKrw('standard', 'first_month_free')).toBe(0);
    expect(firstMonthKrw('standard', 'first_month_half')).toBe(35_000);
    expect(firstMonthKrw('standard', null)).toBe(70_000);
  });

  it('영구 무료는 프로모션 목록에 없다', () => {
    /*
     * v3.10 §3. 값을 매기지 않은 지면은 지면이 아니라 부탁이고, 부탁으로 시작한
     * 관계는 나중에 값을 받기 어렵다.
     */
    expect(AD_PROMOTIONS.every((promotion) => promotion.startsWith('first_month'))).toBe(true);
  });

  it('광고가 못 건드리는 목록이 v3.10 그대로다', () => {
    /*
     * v2.0 때는 없던 추천(TOP3·오늘의 Pick·개인화)이 생겼다. 새로 만든 것부터
     * 광고가 붙기 쉬우므로 목록이 따라가야 한다.
     */
    expect([...ADVERTISING_MUST_NOT_AFFECT]).toEqual([
      'top3',
      'todays_pick',
      'personalized',
      'search_ranking',
      'verified_data',
      'reviews',
    ]);
  });

  it('재는 것은 셋뿐이다', () => {
    // 재보지 않은 것으로 값을 매길 수는 없다. 이 셋이 쌓이기 전에는 성과형이 없다.
    expect([...AD_METRICS]).toEqual(['impression', 'click', 'pick']);
  });
});
