import {
  AXIS_KIND_NOTE,
  COMPARISON_AXES,
  canMerge,
  pendingAxes,
  readyAxes,
} from './comparison-axes';
import { findPaymentWords } from './pick-verification';

describe('비교 축', () => {
  it('v3.13 §O-5가 꼽은 축이 모두 있다', () => {
    expect(COMPARISON_AXES.map((axis) => axis.key)).toEqual([
      'pick_price_range',
      'official_price',
      'official_promotion',
      'included_or_separate',
      'possible_extra_cost',
      'guaranteed_guests',
      'refund_change_terms',
      'discount_condition',
    ]);
  });

  it('확인한 값이 업체가 밝힌 값보다 위에 있다', () => {
    const keys = COMPARISON_AXES.map((axis) => axis.key);

    expect(keys.indexOf('pick_price_range')).toBeLessThan(keys.indexOf('official_price'));
  });

  it('확인한 값과 업체가 밝힌 값을 한 칸에 합칠 수 없다', () => {
    expect(canMerge('pick', 'vendor')).toBe(false);
    expect(canMerge('pick', 'terms')).toBe(false);
    expect(canMerge('pick', 'pick')).toBe(true);
  });

  it('축마다 누구 말인지가 붙는다', () => {
    for (const axis of COMPARISON_AXES) {
      expect(AXIS_KIND_NOTE[axis.kind]).toBeTruthy();
    }
  });

  it('자료가 없는 축은 왜 없는지 적혀 있다', () => {
    for (const axis of COMPARISON_AXES) {
      if (!axis.ready) expect(axis.note).toBeTruthy();
    }
  });

  it('준비된 것과 아닌 것이 겹치지 않는다', () => {
    const ready = readyAxes();
    const pending = pendingAxes();

    expect(ready.filter((key) => pending.includes(key))).toEqual([]);
    expect(ready.length + pending.length).toBe(COMPARISON_AXES.length);
  });

  it('순위를 매기지 않는다', () => {
    /*
     * v3.10 §9. 비교표가 어느 곳이 낫다고 말하기 시작하면 그 판단의 근거를
     * 우리가 져야 한다. 축 정의에 점수도 정렬도 두지 않는다.
     */
    for (const axis of COMPARISON_AXES) {
      expect(Object.keys(axis)).not.toContain('score');
      expect(Object.keys(axis)).not.toContain('better');
    }
  });

  it('축 이름과 안내에 금지어가 없다', () => {
    for (const axis of COMPARISON_AXES) {
      const text = `${axis.label} ${'note' in axis ? axis.note : ''}`;

      expect(findPaymentWords(text)).toEqual([]);
      expect(text).not.toMatch(/견적|계약서/);
    }

    for (const note of Object.values(AXIS_KIND_NOTE)) {
      expect(findPaymentWords(note)).toEqual([]);
    }
  });
});
