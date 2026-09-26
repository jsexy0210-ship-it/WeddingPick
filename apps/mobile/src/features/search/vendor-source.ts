import strings from '../../../../../spec/strings.ko.json';

/**
 * 업체 상세의 정보 출처 표기 — 「공공데이터」 한 이름으로 통일한다(2026-09-26 대표 지시).
 *
 * 전에는 서버 `vendorSourceNote`가 만든 문장을 그대로 적었다 — 「지방행정 인허가 데이터 ·
 * 공공데이터포털」 · 「공공데이터포털 자료」 · 「행정안전부 지방행정 인허가 데이터 (… 확인)」처럼
 * 같은 출처가 업체마다 다른 말로 떴다. 서버는 `source = 'public_data'`인 업체에만 그 문장을
 * 주고 나머지는 null이므로, **값이 있으면 공공데이터 업체다** — 화면은 이름 하나만 적는다.
 *
 * 서버 문장(`sourceNote`)은 바꾸지 않는다 — 화면에 적는 값만 이 함수로 바꾼다. 같은 업체의
 * 출처가 뜨는 자리(업체 상세 · 업체 비교 «업체 정보 출처» · 견적 결과 «업체 정보 출처»)는
 * 전부 이 함수를 거친다 — 한 곳만 바꾸면 같은 업체의 출처가 화면마다 달라진다.
 *
 * `데이터`는 사용자 화면 금지어지만 `공공데이터` 한 낱말만 용어집 `allow`의 예외다
 * (spec/glossary.json · lint-copy.js `maskAllowed` — 그 낱말만 풀고 줄 전체는 풀지 않는다).
 */
export const VENDOR_SOURCE_LABEL = strings.vendor['official.source'];
export const PUBLIC_DATA_SOURCE = strings.vendor['official.sourcePublic'];

export function vendorSourceValue(sourceNote: string | null | undefined): string | null {
  return sourceNote && sourceNote.trim().length > 0 ? PUBLIC_DATA_SOURCE : null;
}
