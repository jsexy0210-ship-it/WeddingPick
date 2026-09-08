import { TASTE_CATEGORIES, TASTE_SET_SIZE } from '@weddingpick/domain';

import {
  chosenKeysFor,
  hasTaste,
  NO_TASTE,
  reconcileTaste,
  TASTE_SETS,
  tasteCategoryFor,
  toggleTaste,
} from './taste';

jest.mock('@/api/client', () => ({
  getTaste: jest.fn(),
  updateTaste: jest.fn(),
}));

describe('취향', () => {
  it('저장된 것이 없으면 아무것도 고르지 않은 것이다', () => {
    expect(reconcileTaste(null, null)).toEqual(NO_TASTE);
    expect(hasTaste(reconcileTaste(null, null))).toBe(false);
  });

  it('모르는 업종·키는 버린다', () => {
    // 항목이 바뀌어도 화면이 빈 칸을 그리지 않게 한다.
    expect(reconcileTaste('studio', ['studio_white', '없는것'])).toEqual({
      category: 'studio',
      keys: ['studio_white'],
    });
    // 다른 업종의 키는 사진이 없다 — 같이 버린다.
    expect(reconcileTaste('dress', ['studio_white'])).toEqual({ category: 'dress', keys: [] });
    expect(reconcileTaste('없는업종', ['studio_white'])).toEqual(NO_TASTE);
  });

  it('하나라도 고르면 홈이 다음 얼굴로 넘어간다', () => {
    expect(hasTaste({ category: 'hall', keys: ['hall_hotel'] })).toBe(true);
  });

  it('눌렀던 것을 다시 누르면 빠진다', () => {
    // 한 번 고르면 못 무르는 화면을 만들지 않는다.
    const once = toggleTaste([], 'hall_chapel');

    expect(once).toEqual(['hall_chapel']);
    expect(toggleTaste(once, 'hall_chapel')).toEqual([]);
  });

  it('여러 개를 고를 수 있다', () => {
    expect(toggleTaste(['hall_hotel'], 'hall_outdoor')).toEqual(['hall_hotel', 'hall_outdoor']);
  });

  it('업종마다 여섯 장이고 항목마다 화면에 쓸 말이 있다', () => {
    // 라벨이 없는 항목이 섞이면 사진 위가 비어 보인다. 2×3 격자라 정확히 여섯이어야 한다.
    for (const category of TASTE_CATEGORIES) {
      expect(TASTE_SETS[category]).toHaveLength(TASTE_SET_SIZE);
      for (const option of TASTE_SETS[category]) {
        expect(option.label.length).toBeGreaterThan(0);
        expect(reconcileTaste(category, [option.key]).keys).toEqual([option.key]);
      }
    }
  });

  it('물을 업종은 준비 현황에서 안 끝낸 첫 업종이다', () => {
    // SPEC §13.6 — 이미 완료로 체크한 업종의 사진을 다시 보여주지 않는다.
    expect(tasteCategoryFor([])).toBe('hall');
    expect(tasteCategoryFor(['hall'])).toBe('studio');
    expect(tasteCategoryFor(['hall', 'studio', 'dress'])).toBe('makeup');
    // 헤어변형·부케·결정사는 사진으로 고르는 업종이 아니라 건너뛴다.
    expect(tasteCategoryFor(['wedding_info_company', 'hair', 'bouquet'])).toBe('hall');
  });

  it('전부 준비했으면 웨딩홀로 돌아간다', () => {
    // 온보딩은 5/5를 건너뛰지만 홈·MY는 빈 화면을 둘 수 없다.
    expect(tasteCategoryFor([...TASTE_CATEGORIES])).toBe('hall');
  });

  it('저장된 업종이 다르면 그 격자에는 아무것도 체크하지 않는다', () => {
    const stored = { category: 'studio' as const, keys: ['studio_film'] };

    expect(chosenKeysFor(stored, 'studio')).toEqual(['studio_film']);
    expect(chosenKeysFor(stored, 'dress')).toEqual([]);
  });
});
