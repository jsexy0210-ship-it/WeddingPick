import {
  TASTE_CATEGORIES,
  TASTE_PRIORITY,
  TASTE_SETS,
  TASTE_SET_SIZE,
  isTasteKey,
  nextTasteCategory,
  reconcileTasteSelection,
  summarizeTasteKeys,
  tasteStepDescription,
} from './taste';

describe('취향 세트', () => {
  it('SPEC §13.6의 아홉 업종을 우선순위 순으로 둔다', () => {
    expect(TASTE_PRIORITY).toEqual([
      'hall',
      'studio',
      'dress',
      'makeup',
      'snap',
      'goods',
      'dowry',
      'honeymoon',
      'invitation',
    ]);
  });

  it('업종마다 정확히 여섯 장이고 키가 겹치지 않는다', () => {
    const keys = new Set<string>();

    for (const category of TASTE_CATEGORIES) {
      expect(TASTE_SETS[category]).toHaveLength(TASTE_SET_SIZE);

      for (const option of TASTE_SETS[category]) {
        // 키는 업종 접두사를 달고 ascii snake_case다 — 사진 파일 이름이 이 키를 쓴다.
        expect(option.key).toMatch(new RegExp(`^${category}_[a-z]+$`));
        expect(keys.has(option.key)).toBe(false);
        keys.add(option.key);
      }
    }
  });

  it('라벨은 SPEC 문구 그대로다', () => {
    const labels = (category: (typeof TASTE_CATEGORIES)[number]) =>
      TASTE_SETS[category].map((option) => option.label);

    expect(labels('hall')).toEqual(['호텔', '채플', '야외', '하우스웨딩', '밝은 홀', '어두운 홀']);
    expect(labels('studio')).toEqual([
      '깔끔한 화이트',
      '모던 미니멀',
      '따뜻한 필름',
      '야외 자연광',
      '클래식',
      '화보',
    ]);
    expect(labels('dress')).toEqual(['실크', '비즈', '레이스', '미니멀', '화려한 스타일', '클래식']);
    expect(labels('makeup')).toEqual(['내추럴', '청순', '또렷한', '화사한', '음영', '글로우']);
    expect(labels('snap')).toEqual([
      '밝고 깨끗한',
      '필름톤',
      '다큐멘터리',
      '감성적인',
      '클래식',
      '자연스러운',
    ]);
    expect(labels('goods')).toEqual(['심플', '클래식', '화려한', '모던', '빈티지', '유니크']);
    expect(labels('dowry')).toEqual(['미니멀', '따뜻한 우드', '모던', '내추럴', '호텔식', '컬러 포인트']);
    expect(labels('honeymoon')).toEqual(['휴양', '관광', '자연', '도시', '액티비티', '럭셔리']);
    expect(labels('invitation')).toEqual(['미니멀', '클래식', '감성', '일러스트', '사진형', '전통적']);
  });

  it('다른 업종의 키는 그 업종에서 못 쓴다', () => {
    expect(isTasteKey('hall', 'hall_hotel')).toBe(true);
    expect(isTasteKey('hall', 'studio_white')).toBe(false);
  });
});

describe('취향을 물을 업종', () => {
  it('아무것도 준비하지 않았으면 웨딩홀부터', () => {
    expect(nextTasteCategory([])).toBe('hall');
  });

  it('준비 현황에서 완료한 업종은 건너뛴다', () => {
    expect(nextTasteCategory(['hall'])).toBe('studio');
    expect(nextTasteCategory(['hall', 'studio', 'dress'])).toBe('makeup');
  });

  it('취향을 묻지 않는 업종(결정사 · 헤어변형 · 부케)은 순서에 영향이 없다', () => {
    expect(nextTasteCategory(['wedding_info_company', 'hair', 'bouquet'])).toBe('hall');
  });

  it('아홉 업종을 전부 준비했으면 null — 5/5를 건너뛴다', () => {
    expect(nextTasteCategory([...TASTE_CATEGORIES])).toBeNull();
  });

  it('설명 줄에 업종명이 들어간다', () => {
    expect(tasteStepDescription('makeup')).toBe('아직 정하지 않은 메이크업 취향을 반영할게요');
  });
});

describe('답 줄 요약', () => {
  it('두 개까지는 그대로, 셋부터 첫 항목 외 N개', () => {
    expect(summarizeTasteKeys('studio', ['studio_white'])).toBe('깔끔한 화이트');
    expect(summarizeTasteKeys('studio', ['studio_white', 'studio_film'])).toBe('깔끔한 화이트 · 따뜻한 필름');
    expect(summarizeTasteKeys('studio', ['studio_white', 'studio_film', 'studio_classic'])).toBe(
      '깔끔한 화이트 외 2개'
    );
  });

  it('저장된 것 중 모르는 값은 버린다', () => {
    expect(reconcileTasteSelection('studio', ['studio_white', 'flower'])).toEqual({
      category: 'studio',
      keys: ['studio_white'],
    });
    expect(reconcileTasteSelection(null, ['studio_white'])).toEqual({ category: null, keys: [] });
    expect(reconcileTasteSelection('etc', ['x'])).toEqual({ category: null, keys: [] });
  });
});
