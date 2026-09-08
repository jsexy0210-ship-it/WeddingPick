import { OTHER_REGION, REGION_DISTRICTS, WEDDING_REGIONS, combineRegion, regionFilter, regionLikePattern, regionMatches } from './wedding-region';

describe('온보딩 지역', () => {
  it('시안 #11d의 아홉 칩을 그 순서로 둔다', () => {
    expect(WEDDING_REGIONS).toEqual(['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '그 외']);
  });

  it('그 외는 지역으로 거르지 않는다', () => {
    expect(regionFilter(OTHER_REGION)).toBeNull();
    expect(regionFilter('서울')).toBe('서울');
    expect(regionFilter(null)).toBeNull();
    expect(regionFilter('  ')).toBeNull();
  });

  it('업체의 공식 지역 이름과 화면의 짧은 이름을 앞글자로 맞춘다', () => {
    // 공공데이터 업체는 "서울특별시 강남구", 손으로 넣은 업체는 "서울 강남구"다.
    expect(regionMatches('서울특별시 강남구', '서울')).toBe(true);
    expect(regionMatches('서울 강남구', '서울')).toBe(true);
    expect(regionMatches('경기도 이천시', '경기')).toBe(true);
    expect(regionMatches('경기도 이천시', '서울')).toBe(false);
  });

  it('구를 고르지 않으면 시/도 값 그대로다', () => {
    expect(combineRegion('서울', null)).toBe('서울');
  });

  it('구를 고르면 공식 시/도 이름으로 합쳐 업체 지역과 접두어가 맞는다', () => {
    const combined = combineRegion('서울', '강남구');

    expect(combined).toBe('서울특별시 강남구');
    expect(regionMatches('서울특별시 강남구', combined)).toBe(true);
    // 다른 구는 걸러진다 — 접두어가 정확히 구 단위까지 좁혀졌다.
    expect(regionMatches('서울특별시 서초구', combined)).toBe(false);
  });

  it('그 외는 구 목록이 없다', () => {
    expect(REGION_DISTRICTS[OTHER_REGION]).toBeUndefined();
  });

  it('구가 있는 여덟 지역 모두 목록을 가진다', () => {
    for (const region of WEDDING_REGIONS.filter((r) => r !== OTHER_REGION)) {
      expect(REGION_DISTRICTS[region]?.length).toBeGreaterThan(0);
    }
  });
});

describe('지역 맞추기 — 긴 꼴과 짧은 꼴(v3.24)', () => {
  it('서울특별시 강남구와 서울 강남구는 같은 곳이다', () => {
    expect(regionMatches('서울 강남구', '서울특별시 강남구')).toBe(true);
    expect(regionMatches('서울특별시 강남구', '서울 강남구')).toBe(true);
    expect(regionMatches('서울특별시 강남구', '서울')).toBe(true);
    expect(regionMatches('경기 수원시', '서울특별시 강남구')).toBe(false);
    expect(regionMatches('서울 서초구', '서울특별시 강남구')).toBe(false);
  });

  it('LIKE 패턴도 같은 규칙이다', () => {
    expect(regionLikePattern('서울특별시 강남구')).toBe('서울% 강남구%');
    expect(regionLikePattern('서울')).toBe('서울%');
    expect(regionLikePattern('경기도 수원시')).toBe('경기% 수원시%');
  });
});
