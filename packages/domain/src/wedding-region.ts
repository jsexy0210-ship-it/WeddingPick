/**
 * 온보딩 2/4 지역. 디자인 핸드오프 01-onboarding.dc.html #11d — 시안이 정한 아홉
 * 칩을 그대로 쓴다. 업체 목록에 어떤 시도가 있느냐로 선택지를 정하지 않는다.
 *
 * 저장은 이 문구 그대로다("서울"). 업체의 region은 "서울특별시 강남구"처럼 공식
 * 이름이라, 견줄 때는 앞글자로 맞춘다(regionMatches) — 화면이 내려준 값을 서버
 * 형식으로 바꾸지 않는다.
 */

export const WEDDING_REGIONS = [
  '서울',
  '경기',
  '인천',
  '부산',
  '대구',
  '대전',
  '광주',
  '울산',
  '그 외',
] as const;

export type WeddingRegion = (typeof WEDDING_REGIONS)[number];

/** 아홉 칩의 마지막. 지역으로 거르지 않는다는 뜻이다. */
export const OTHER_REGION = '그 외';

/** 추천·검색에서 지역으로 거를 값. `그 외`는 전국이다 — null. */
export function regionFilter(region: string | null | undefined): string | null {
  if (region === null || region === undefined) return null;

  const trimmed = region.trim();

  return trimmed === '' || trimmed === OTHER_REGION ? null : trimmed;
}

/**
 * 시/도 이름의 긴 꼴을 짧은 꼴로. «서울특별시» → «서울», «경기도» → «경기», «제주특별자치도» → «제주».
 *
 * 온보딩은 «서울특별시 강남구»로 적고 업체는 «서울 강남구»로도 «서울특별시 강남구»로도
 * 적혀 있다(공공데이터 · 표본). 앞글자 비교만으로는 둘이 만나지 않아 지역 추천이 비었다.
 */
export function regionTokens(region: string): string[] {
  return region
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token, index) => (index === 0 ? shortRegionName(token) : token));
}

/**
 * 시/도 이름에서 떼어낼 꼬리. **SQL도 이 값을 쓴다**(`/v1/vendors/regions`) —
 * 같은 규칙을 두 곳에 따로 적으면 한쪽만 고쳐져 지역 칩이 갈린다. 실제로
 * 「경기」와 「경기도」가 필터에 나란히 뜬 적이 있다(2026-09-10 사용자 보고).
 *
 * 긴 꼴을 먼저 적는다 — 「제주특별자치도」에서 「도」만 떼면 「제주특별자치」가 된다.
 */
export const REGION_SUFFIX_PATTERN = '(특별자치시|특별자치도|특별시|광역시|도)$';

/** 시/도 한 낱말을 짧은 꼴로. «경기도» → «경기» · «서울특별시» → «서울». */
export function shortRegionName(token: string): string {
  return token.replace(new RegExp(REGION_SUFFIX_PATTERN), '');
}

/** 업체 지역이 고른 지역에 드는가. "서울" ↔ "서울특별시 강남구" · "서울 강남구" · "서울특별시 강남구". */
export function regionMatches(vendorRegion: string, region: string): boolean {
  const wanted = regionTokens(region);
  const actual = regionTokens(vendorRegion);

  return wanted.every((token, index) => (actual[index] ?? '').startsWith(token));
}

/**
 * SQL LIKE 패턴. «서울특별시 강남구» → «서울% 강남구%», «서울» → «서울%».
 * regionMatches와 같은 규칙을 DB 쪽에서 쓴다 — 둘이 다르면 SQL이 거른 것과 이유가 어긋난다.
 */
export function regionLikePattern(region: string): string {
  return regionTokens(region)
    .map((token) => token.replace(/[%_]/g, ''))
    .map((token) => `${token}%`)
    .join(' ');
}

/**
 * 온보딩 2/4의 구 단위 선택(시안 #11d districts). 시/도를 고른 뒤 더 좁힐 수
 * 있다 — «그 외»와 광역시가 아닌 «경기」는 구 대신 시·군 단위다.
 *
 * 여기 없는 지역(«그 외»)은 구 목록이 없다 — 전국이라는 뜻이라 더 좁힐 것이
 * 없다.
 */
export const REGION_DISTRICTS: Partial<Record<WeddingRegion, readonly string[]>> = {
  서울: [
    '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
    '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
    '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구',
  ],
  경기: [
    '수원시', '성남시', '고양시', '용인시', '부천시', '안산시', '안양시', '남양주시',
    '화성시', '평택시', '의정부시', '시흥시', '파주시', '김포시', '광명시', '광주시',
    '군포시', '이천시', '양주시', '오산시', '구리시', '안성시', '포천시', '의왕시',
    '하남시', '여주시', '동두천시', '과천시', '양평군', '가평군', '연천군',
  ],
  인천: ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'],
  부산: [
    '중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구',
    '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군',
  ],
  대구: ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'],
  대전: ['동구', '중구', '서구', '유성구', '대덕구'],
  광주: ['동구', '서구', '남구', '북구', '광산구'],
  울산: ['중구', '남구', '동구', '북구', '울주군'],
};

/** 구·군을 붙일 때 쓰는 공식 시·도 이름. 업체 지역(공공데이터)이 이 이름을 쓴다. */
const REGION_OFFICIAL_PREFIX: Partial<Record<WeddingRegion, string>> = {
  서울: '서울특별시',
  경기: '경기도',
  인천: '인천광역시',
  부산: '부산광역시',
  대구: '대구광역시',
  대전: '대전광역시',
  광주: '광주광역시',
  울산: '울산광역시',
};

/**
 * 시/도 칩과 구·군을 합쳐 서버에 보낼 값을 만든다.
 *
 * 화면 칩은 «서울»처럼 짧지만, 업체 지역은 «서울특별시 강남구»처럼 공식
 * 이름이다(공공데이터 주소 앞 두 토큰, `toRegion`). 짧은 이름을 그대로 이어
 * «서울 강남구»로 보내면 `regionMatches`의 접두어 비교가 어긋난다 — 그래서
 * 구를 고른 경우에만 공식 이름으로 바꿔서 잇는다.
 */
export function combineRegion(region: WeddingRegion, district: string | null): string {
  if (district === null) return region;

  const prefix = REGION_OFFICIAL_PREFIX[region];

  return prefix ? `${prefix} ${district}` : region;
}
