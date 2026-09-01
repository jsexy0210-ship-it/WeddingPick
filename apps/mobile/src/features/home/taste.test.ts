import { hasTaste, reconcileTaste, TASTES, toggleTaste } from './taste';

describe('취향', () => {
  it('저장된 것이 없으면 아무것도 고르지 않은 것이다', () => {
    expect(reconcileTaste(null)).toEqual([]);
    expect(hasTaste(reconcileTaste(null))).toBe(false);
  });

  it('모르는 값은 버린다', () => {
    // 항목이 바뀌어도 화면이 빈 칸을 그리지 않게 한다.
    expect(reconcileTaste(['white', '없는것'])).toEqual(['white']);
  });

  it('하나라도 고르면 홈이 다음 얼굴로 넘어간다', () => {
    expect(hasTaste(['white'])).toBe(true);
  });

  it('눌렀던 것을 다시 누르면 빠진다', () => {
    // 한 번 고르면 못 무르는 화면을 만들지 않는다.
    const once = toggleTaste([], 'flower');

    expect(once).toEqual(['flower']);
    expect(toggleTaste(once, 'flower')).toEqual([]);
  });

  it('여러 개를 고를 수 있다', () => {
    expect(toggleTaste(['white'], 'classic')).toEqual(['white', 'classic']);
  });

  it('항목마다 화면에 쓸 말이 있다', () => {
    // 라벨이 없는 항목이 섞이면 사진 위가 비어 보인다.
    for (const taste of TASTES) {
      expect(reconcileTaste([taste])).toEqual([taste]);
    }
  });
});
