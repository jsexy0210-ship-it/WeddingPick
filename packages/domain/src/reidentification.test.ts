import { DISCLOSURE_THRESHOLDS } from './disclosure';
import {
  CONDITION_AXES,
  CONDITION_AXIS_LABEL,
  canDiscloseNarrowed,
  coarseRegion,
  conditionStage,
  requiredCount,
  widestDisclosable,
} from './reidentification';

describe('재식별 방지', () => {
  it('좁힐수록 더 많은 데이터를 요구한다', () => {
    /*
     * 문제는 건수가 아니라 조합이다. "서울 강남구 · 2026년 5월 · 토요일 저녁"으로
     * 좁힌 3건은, 그 조건에 해당하는 사람이 알 만한 사람 셋이라는 뜻이다.
     */
    expect(requiredCount(0)).toBe(DISCLOSURE_THRESHOLDS.early);
    expect(requiredCount(1)).toBeGreaterThan(requiredCount(0));
    expect(requiredCount(3)).toBeGreaterThan(requiredCount(2));
  });

  it('안 좁힌 통계는 원래 문턱을 그대로 쓴다', () => {
    // 전체 통계에까지 재식별 문턱을 얹으면 사다리가 둘이 된다.
    expect(canDiscloseNarrowed({ count: 3, axes: 0 })).toBe(true);
    expect(canDiscloseNarrowed({ count: 2, axes: 0 })).toBe(false);
  });

  it('두 축으로 좁힌 3건은 내지 않는다', () => {
    expect(canDiscloseNarrowed({ count: 3, axes: 2 })).toBe(false);
  });

  it('보여줄 수 있는 데까지만 좁힌다', () => {
    /*
     * 못 보여줄 바에는 넓게라도 보여주는 것이 낫다 — C-4의 "묶거나 숨긴다"에서
     * 묶는 쪽이다.
     *
     * 0축 40건 / 1축 12건 / 2축 4건 → 2축은 7건이 필요해 안 되고, 1축은 5건이면
     * 되므로 1축까지 보여준다.
     */
    expect(widestDisclosable([40, 12, 4])).toBe(1);
  });

  it('아무것도 못 보여줄 수 있다', () => {
    expect(widestDisclosable([2, 1, 0])).toBeNull();
  });

  it('가장 좁은 것이 되면 그걸 쓴다', () => {
    expect(widestDisclosable([100, 60, 40])).toBe(2);
  });

  it('전체가 상세 단계가 아니면 조건별은 없다', () => {
    // C-3: 전체 공개단계와 조건별 공개단계를 분리한다.
    expect(conditionStage(9, 9, 0)).toBeNull();
  });

  it('전체가 상세 단계여도 좁힌 조건이 모자라면 없다', () => {
    expect(conditionStage(40, 4, 2)).toBeNull();
    expect(conditionStage(40, 12, 2)).toBe('detailed');
  });

  it('지역은 시도까지만 쓴다', () => {
    // 구까지 가면 "그 동네 그 홀"이 되고, 그건 대개 한 곳이다.
    expect(coarseRegion('서울 강남구')).toBe('서울');
    expect(coarseRegion('경기 성남시 분당구')).toBe('경기');
    expect(coarseRegion('서울')).toBe('서울');
  });

  it('모든 축에 이름이 있다', () => {
    for (const axis of CONDITION_AXES) {
      expect(CONDITION_AXIS_LABEL[axis].length).toBeGreaterThan(0);
    }
  });
});
