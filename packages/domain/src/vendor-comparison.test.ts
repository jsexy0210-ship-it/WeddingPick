import { MAX_COMPARED_VENDORS, comparisonCaveats } from './vendor-comparison';

const hall = { category: 'hall' as const, region: '서울 마포구', hasPriceData: true };

describe('업체 비교 단서', () => {
  it('금액만으로 비교할 수 없다는 말은 늘 붙는다', () => {
    // 표를 만들어놓고 이 말을 빼면 우리가 만든 표가 오해를 부추긴다. 사업계획서 2번.
    const caveats = comparisonCaveats([hall, { ...hall, region: '서울 강남구' }]);

    expect(caveats.at(-1)).toContain('금액만으로는 비교하기 어렵습니다');
  });

  it('같은 분류·같은 지역이면 그 얘기는 하지 않는다', () => {
    // 늘 같은 경고를 늘어놓으면 아무도 읽지 않는다.
    const caveats = comparisonCaveats([hall, { ...hall, region: '서울 강남구' }]);

    expect(caveats).toHaveLength(1);
  });

  it('분류가 섞이면 알려준다', () => {
    const caveats = comparisonCaveats([hall, { ...hall, category: 'snap' }]);

    expect(caveats[0]).toContain('웨딩홀');
    expect(caveats[0]).toContain('스냅·영상');
  });

  it('시도가 다르면 알려준다', () => {
    const caveats = comparisonCaveats([hall, { ...hall, region: '경기 성남시' }]);

    expect(caveats.some((note) => note.includes('서울') && note.includes('경기'))).toBe(true);
  });

  it('자료가 없는 것이 싸다는 뜻이 아님을 밝힌다', () => {
    const caveats = comparisonCaveats([hall, { ...hall, hasPriceData: false }]);

    expect(caveats.some((note) => note.includes('싸거나 비싸다는 뜻이 아닙니다'))).toBe(true);
  });

  it('모두 자료가 없으면 그렇게 말한다', () => {
    const caveats = comparisonCaveats([
      { ...hall, hasPriceData: false },
      { ...hall, hasPriceData: false },
    ]);

    expect(caveats.some((note) => note.includes('어느 곳도'))).toBe(true);
  });

  it('한 번에 견주는 수에 한계를 둔다', () => {
    expect(MAX_COMPARED_VENDORS).toBe(3);
  });
});
