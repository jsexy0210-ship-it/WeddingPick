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

/** 업체 지역이 고른 지역에 드는가. "서울" ↔ "서울특별시 강남구" · "서울 강남구". */
export function regionMatches(vendorRegion: string, region: string): boolean {
  return vendorRegion.startsWith(region);
}
