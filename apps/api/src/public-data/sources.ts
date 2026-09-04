/** 수집 허용을 실제 확인한 데이터셋만 등록한다. 임의 URL 입력은 받지 않는다. */
export const PUBLIC_SOURCES = {
  'icheon-halls': {
    url: 'https://www.data.go.kr/data/15100736/fileData.do',
    name: '경기도 이천시 예식장현황',
    format: 'municipal',
    nameColumn: '업체명',
    dateColumn: '기준일자',
    checkedOn: '2026-09-04',
  },
  'jecheon-halls': {
    url: 'https://www.data.go.kr/data/15129542/fileData.do',
    name: '충청북도 제천시 예식장',
    format: 'municipal',
    nameColumn: '상호명',
    dateColumn: '데이터기준일자',
    checkedOn: '2026-09-04',
  },
  sbiz: {
    url: 'https://www.data.go.kr/data/15012005/openapi.do',
    name: '소상공인시장진흥공단 상가(상권)정보',
    format: 'sbiz',
    nameColumn: '상호명',
    dateColumn: '',
    checkedOn: '2026-09-04',
  },
} as const;

export type SourceKey = keyof typeof PUBLIC_SOURCES;
export function sourceKey(value: string): SourceKey {
  if (!Object.hasOwn(PUBLIC_SOURCES, value)) throw new Error('출처가 허용 목록에 없습니다.');
  return value as SourceKey;
}
