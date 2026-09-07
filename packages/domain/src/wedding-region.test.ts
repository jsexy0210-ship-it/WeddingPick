import { OTHER_REGION, WEDDING_REGIONS, regionFilter, regionMatches } from './wedding-region';

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
});
