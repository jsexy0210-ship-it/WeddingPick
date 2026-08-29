import {
  ADVERTISING_MUST_NOT_AFFECT,
  PROTECTED_SURFACE_LABEL,
  RANKING_REASONS,
  RANKING_REASON_LABEL,
  SPONSORED_LABEL,
  isSeparated,
  type Placement,
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
