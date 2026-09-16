import {
  CATEGORY_ACTION_LABEL,
  categoryPickState,
  compareRecommendCategories,
  nextStepsCountLine,
  nextStepsSummary,
  showsInRecommend,
  type CategoryPickState,
} from './home-recommend';
import type { VendorCategory } from './vendor';

describe('categoryPickState', () => {
  it('정한 업종은 DECIDED다', () => {
    expect(categoryPickState({ state: 'decided', pickCount: 0 })).toBe('DECIDED');
    expect(categoryPickState({ state: 'decided', pickCount: 5 })).toBe('DECIDED');
  });

  it('온보딩에서 이미 정했다고 고른 업종도 DECIDED다 — 업체가 없어도 끝난 준비다', () => {
    expect(categoryPickState({ state: 'before', pickCount: 0, prepared: true })).toBe('DECIDED');
  });

  it('Pick 둘 이상이면 COMPARING — 견줄 수 있는 상태다', () => {
    expect(categoryPickState({ state: 'picking', pickCount: 2 })).toBe('COMPARING');
    expect(categoryPickState({ state: 'picking', pickCount: 9 })).toBe('COMPARING');
  });

  it('Pick 하나면 SHORTLISTED', () => {
    expect(categoryPickState({ state: 'picking', pickCount: 1 })).toBe('SHORTLISTED');
  });

  it('Pick이 없으면 NOT_STARTED', () => {
    expect(categoryPickState({ state: 'before', pickCount: 0 })).toBe('NOT_STARTED');
  });

  /*
   * 조회 기록을 저장하는 자리가 없다. 「보긴 했다」와 「손도 안 댔다」가 같은 값으로
   * 나오는 것이 지금 의도다 — 본 기록이 생기면 이 시험이 먼저 깨져야 한다.
   */
  it('EXPLORING과 SKIPPED는 지금 만들어지지 않는다', () => {
    const produced = new Set<CategoryPickState>();

    for (const state of ['before', 'picking', 'decided'] as const) {
      for (const pickCount of [0, 1, 2, 7]) {
        for (const prepared of [false, true]) {
          produced.add(categoryPickState({ state, pickCount, prepared }));
        }
      }
    }

    expect(produced.has('EXPLORING')).toBe(false);
    expect(produced.has('SKIPPED')).toBe(false);
  });
});

describe('showsInRecommend', () => {
  it('DECIDED와 SKIPPED는 Pick 추천에서 빠진다', () => {
    expect(showsInRecommend('DECIDED')).toBe(false);
    expect(showsInRecommend('SKIPPED')).toBe(false);
  });

  it('나머지 넷은 선다', () => {
    for (const state of ['NOT_STARTED', 'EXPLORING', 'SHORTLISTED', 'COMPARING'] as const) {
      expect(showsInRecommend(state)).toBe(true);
    }
  });
});

describe('CATEGORY_ACTION_LABEL', () => {
  it('개수를 붙이지 않는다 — 「추천 3곳」 금지', () => {
    for (const label of Object.values(CATEGORY_ACTION_LABEL)) {
      if (label !== null) expect(label).not.toMatch(/\d/);
    }
  });

  it('추천 · 보기 · 비교 셋뿐이다', () => {
    expect(CATEGORY_ACTION_LABEL.NOT_STARTED).toBe('추천');
    expect(CATEGORY_ACTION_LABEL.EXPLORING).toBe('추천');
    expect(CATEGORY_ACTION_LABEL.SHORTLISTED).toBe('보기');
    expect(CATEGORY_ACTION_LABEL.COMPARING).toBe('비교');
  });
});

describe('compareRecommendCategories', () => {
  const row = (category: VendorCategory, state: CategoryPickState) => ({ category, state });

  it('비교 → 담아둠 → 시작 전 순이다', () => {
    const rows = [
      row('hall', 'NOT_STARTED'),
      row('studio', 'COMPARING'),
      row('dress', 'SHORTLISTED'),
    ].sort(compareRecommendCategories);

    expect(rows.map((r) => r.category)).toEqual(['studio', 'dress', 'hall']);
  });

  it('같은 상태 안에서는 준비 순서를 따른다 — 예식일로 따로 가중치를 주지 않는다', () => {
    const rows = [
      row('honeymoon', 'NOT_STARTED'),
      row('hall', 'NOT_STARTED'),
      row('studio', 'NOT_STARTED'),
    ].sort(compareRecommendCategories);

    expect(rows.map((r) => r.category)).toEqual(['hall', 'studio', 'honeymoon']);
  });

  it('정한 업종은 맨 뒤로 밀린다 — 걸러내기 전에도 순서가 어긋나지 않는다', () => {
    const rows = [row('hall', 'DECIDED'), row('honeymoon', 'NOT_STARTED')].sort(
      compareRecommendCategories
    );

    expect(rows.map((r) => r.category)).toEqual(['honeymoon', 'hall']);
  });
});

describe('nextStepsSummary', () => {
  it('넷까지는 이름을 적는다', () => {
    expect(nextStepsSummary(['studio', 'makeup', 'goods', 'honeymoon'])).toBe(
      '스튜디오 · 메이크업 · 예물 · 허니문'
    );
  });

  it('넷을 넘으면 「외 N개」로 접는다', () => {
    expect(nextStepsSummary(['studio', 'makeup', 'goods', 'honeymoon', 'dress', 'hair', 'snap'])).toBe(
      '스튜디오 · 메이크업 · 예물 · 허니문 외 3개'
    );
  });

  it('남은 준비가 없으면 그 줄을 그리지 않는다', () => {
    expect(nextStepsSummary([])).toBeNull();
  });
});

describe('nextStepsCountLine', () => {
  it('숫자는 천단위 쉼표를 거친다', () => {
    expect(nextStepsCountLine(7)).toBe('아직 결정하지 않은 준비가 7개 있어요');
    expect(nextStepsCountLine(1234)).toBe('아직 결정하지 않은 준비가 1,234개 있어요');
  });
});
