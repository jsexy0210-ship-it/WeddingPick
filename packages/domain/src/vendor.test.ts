import {
  PREPARATION_CATEGORIES,
  PREPARATION_GROUPS,
  preparationSkippedToast,
  skippedPreparationCategories,
  PREPARATION_NOT_STARTED_LABEL,
  RETIRED_VENDOR_CATEGORIES,
  STORED_VENDOR_CATEGORIES,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  summarizePreparedCategories,
} from './vendor';

describe('업종', () => {
  it('고를 수 있는 업종 11개를 그룹 순서로 둔다 — 결정사는 없고 기타는 맨 뒤', () => {
    expect(VENDOR_CATEGORIES).toEqual([
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
    expect(PREPARATION_CATEGORIES).toHaveLength(11);
    expect(PREPARATION_CATEGORIES).not.toContain('etc');
  });

  it('결정사는 저장값으로만 남고 고르는 목록 어디에도 없다 (2026-09-24 대표 지시)', () => {
    // DB enum 값은 남는다 — 과거 기록을 읽을 수 있어야 한다.
    expect(STORED_VENDOR_CATEGORIES).toContain('wedding_info_company');
    expect(RETIRED_VENDOR_CATEGORIES).toEqual(['wedding_info_company']);
    expect(VENDOR_CATEGORIES).not.toContain('wedding_info_company');
    expect(PREPARATION_CATEGORIES).not.toContain('wedding_info_company');
    expect(PREPARATION_GROUPS.flatMap((group) => group.categories)).not.toContain('wedding_info_company');
  });

  it('앞 그룹을 비워두고 뒤 그룹만 고르면 비운 앞 그룹의 업종을 짚는다 (v3.23 토스트)', () => {
    expect(skippedPreparationCategories([])).toEqual([]);
    expect(skippedPreparationCategories(['hall'])).toEqual([]);
    expect(skippedPreparationCategories(['hall', 'studio'])).toEqual([]);
    expect(skippedPreparationCategories(['studio', 'dress'])).toEqual(['hall']);
    expect(skippedPreparationCategories(['hall', 'snap'])).toEqual(['studio', 'dress', 'makeup', 'hair']);
    expect(skippedPreparationCategories(['honeymoon'])).toEqual([
      'hall',
      'studio',
      'dress',
      'makeup',
      'hair',
      'snap',
      'bouquet',
      'invitation',
    ]);
    expect(preparationSkippedToast(['hall'])).toBe('앞 단계도 확인해주세요 · 웨딩홀');
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
