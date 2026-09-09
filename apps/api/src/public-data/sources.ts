/** 수집 허용을 실제 확인한 데이터셋만 등록한다. 임의 URL 입력은 받지 않습니다. */
export const PUBLIC_SOURCES = {
  'icheon-halls': {
    url: 'https://www.data.go.kr/data/15100736/fileData.do',
    name: '경기도 이천시 예식장현황',
    format: 'municipal' as const,
    nameColumn: '업체명',
    dateColumn: '기준일자',
    checkedOn: '2026-09-04',
  },
  'jecheon-halls': {
    url: 'https://www.data.go.kr/data/15129542/fileData.do',
    name: '충청북도 제천시 예식장',
    format: 'municipal' as const,
    nameColumn: '상호명',
    dateColumn: '데이터기준일자',
    checkedOn: '2026-09-04',
  },
  sbiz: {
    url: 'https://www.data.go.kr/data/15012005/openapi.do',
    name: '소상공인시장진흥공단 상가(상권)정보',
    format: 'sbiz' as const,
    nameColumn: '상호명',
    dateColumn: '',
    checkedOn: '2026-09-04',
  },
  /** 소상공인진흥공단 OpenAPI — 서울특별시 웨딩업종 전수 (SBIZ_API_KEY 필수) */
  'sbiz-seoul': {
    url: 'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInUpjong/v2',
    name: '소상공인시장진흥공단 서울특별시 상권정보',
    format: 'sbiz-api' as const,
    nameColumn: 'bizesNm',
    dateColumn: '',
    ctprvnCd: '11',
    checkedOn: '2026-09-04',
  },
  /** 소상공인진흥공단 OpenAPI — 경기도 웨딩업종 전수 (SBIZ_API_KEY 필수) */
  'sbiz-gyeonggi': {
    url: 'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInUpjong/v2',
    name: '소상공인시장진흥공단 경기도 상권정보',
    format: 'sbiz-api' as const,
    nameColumn: 'bizesNm',
    dateColumn: '',
    ctprvnCd: '41',
    checkedOn: '2026-09-04',
  },
} as const;

export type SourceKey = keyof typeof PUBLIC_SOURCES;
export type SourceFormat = typeof PUBLIC_SOURCES[SourceKey]['format'];

export function sourceKey(value: string): SourceKey {
  if (!Object.hasOwn(PUBLIC_SOURCES, value)) throw new Error('출처가 허용 목록에 없습니다.');
  return value as SourceKey;
}

/**
 * 아는 출처인가. `sourceKey`와 달리 던지지 않는다 — 부르는 쪽이 404로 답해야 하는
 * 자리(관리자 수집 스위치)에서는 예외보다 참·거짓이 쓰기 편하다.
 */
export function isKnownSourceKey(value: string): value is SourceKey {
  return Object.hasOwn(PUBLIC_SOURCES, value);
}
