import {
  PREPARATION_CATEGORIES,
  PREPARATION_GROUPS,
  PREPARATION_NOT_STARTED_LABEL,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  summarizePreparedCategories,
} from './vendor';

describe('업종', () => {
  it('핸드오프 v3.22의 12개 업종을 그룹 순서로 둔다 — 기타는 맨 뒤', () => {
    expect(VENDOR_CATEGORIES).toEqual([
      'wedding_info_company',
      'hall',
      'studio',
      'dress',
      'makeup',
      'hair',
      'snap',
      'bouquet',
      'invitation',
      'goods',
      'dowry',
      'honeymoon',
      'etc',
    ]);
    expect(PREPARATION_CATEGORIES).toHaveLength(12);
    expect(PREPARATION_CATEGORIES).not.toContain('etc');
  });

  it('준비 현황 그룹을 펼치면 준비 순서와 같다', () => {
    expect(PREPARATION_GROUPS.flatMap((group) => group.categories)).toEqual(PREPARATION_CATEGORIES);
    expect(PREPARATION_GROUPS.map((group) => group.title)).toEqual([
      '시작 준비',
      '스드메',
      '본식 준비',
      '예물 · 신혼',
    ]);
  });

  it('새 업종의 이름은 핸드오프 그대로다', () => {
    expect(VENDOR_CATEGORY_LABEL.hair).toBe('헤어변형');
    expect(VENDOR_CATEGORY_LABEL.bouquet).toBe('부케');
    expect(PREPARATION_NOT_STARTED_LABEL).toBe('아직 시작 전이에요');
  });

  it('준비 현황 요약은 «첫 항목 외 N곳»이다', () => {
    expect(summarizePreparedCategories([])).toBe('아직 시작 전이에요');
    expect(summarizePreparedCategories(['hall'])).toBe('웨딩홀');
    expect(summarizePreparedCategories(['hall', 'studio', 'dress'])).toBe('웨딩홀 외 2곳');
  });
});
