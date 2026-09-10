import { OTHER_REGION, REGION_DISTRICTS, WEDDING_REGIONS, combineRegion, regionFilter, regionLikePattern, regionMatches, regionLabel, shortDistrictName, shortRegionName } from './wedding-region';

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

describe('시도 이름 짧은 꼴 — 지역 칩이 갈리지 않게', () => {
  /*
   * 업체의 region은 출처마다 꼴이 다르다 — 공공데이터는 「경기도 성남시」,
   * 표본은 「경기 성남시」. 앞 낱말을 그대로 묶으면 필터에 「경기」와 「경기도」가
   * 다른 칩 두 개로 나온다(2026-09-10 사용자 보고).
   */
  it('긴 꼴을 짧은 꼴로 모은다', () => {
    expect(shortRegionName('경기도')).toBe('경기');
    expect(shortRegionName('서울특별시')).toBe('서울');
    expect(shortRegionName('부산광역시')).toBe('부산');
    expect(shortRegionName('세종특별자치시')).toBe('세종');
    // 긴 꼬리를 먼저 떼지 않으면 「제주특별자치」가 된다.
    expect(shortRegionName('제주특별자치도')).toBe('제주');
    expect(shortRegionName('강원특별자치도')).toBe('강원');
  });

  it('이미 짧은 꼴은 그대로 둔다', () => {
    for (const name of ['경기', '서울', '부산', '대구', '대전', '광주', '인천', '울산']) {
      expect(shortRegionName(name)).toBe(name);
    }
  });

  it('두 꼴이 같은 이름으로 모인다', () => {
    expect(shortRegionName('경기도')).toBe(shortRegionName('경기'));
    expect(shortRegionName('서울특별시')).toBe(shortRegionName('서울'));
  });
});

describe('화면에 적을 지역 이름 — 시·군·구까지 뗀다', () => {
  it('시·군·구를 뗀다', () => {
    expect(shortDistrictName('성남시')).toBe('성남');
    expect(shortDistrictName('수원시')).toBe('수원');
    expect(shortDistrictName('강남구')).toBe('강남');
    expect(shortDistrictName('가평군')).toBe('가평');
  });

  it('두 글자는 그대로 두고 세 글자부터 뗀다', () => {
    /*
     * 「중구」 「동구」는 부산 · 대구 · 광주 · 인천에 실제로 있는 이름이다.
     * 「중」 「동」만 남기면 무슨 말인지 알 수 없다.
     */
    for (const name of ['중구', '동구', '서구', '남구', '북구']) {
      expect(shortDistrictName(name)).toBe(name);
    }
    // 세 글자부터는 뗀다.
    expect(shortDistrictName('서구청')).toBe('서구청');
    expect(shortDistrictName('부천시')).toBe('부천');
    expect(shortDistrictName('서귀포시')).toBe('서귀포');
  });

  it('시도와 시군구를 함께 줄인다', () => {
    expect(regionLabel('경기도 성남시')).toBe('경기 성남');
    expect(regionLabel('서울특별시 강남구')).toBe('서울 강남');
    expect(regionLabel('제주특별자치도 서귀포시')).toBe('제주 서귀포');
    expect(regionLabel('부산광역시 중구')).toBe('부산 중구');
  });

  it('이미 짧은 꼴도 같은 값으로 나온다', () => {
    // 출처마다 꼴이 달라도 화면에서는 한 가지로 보여야 한다.
    expect(regionLabel('경기 성남시')).toBe(regionLabel('경기도 성남시'));
    expect(regionLabel('서울 강남구')).toBe(regionLabel('서울특별시 강남구'));
  });

  it('빈 값은 빈 문자열이다', () => {
    expect(regionLabel(null)).toBe('');
    expect(regionLabel(undefined)).toBe('');
    expect(regionLabel('  ')).toBe('');
  });
});
