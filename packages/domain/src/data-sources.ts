/**
 * 앱이 쓰는 바깥 자료의 출처.
 *
 * 공공데이터는 이용허락범위(공공누리)에 따라 출처 표시를 요구한다. 유형이 무엇이든
 * 출처 표시는 공통이므로 자료명·제공기관·확인일을 화면에 그대로 보여준다.
 *
 * `license`는 데이터셋 페이지에서 확인한 뒤에만 채운다. 확인하지 않은 유형을 적어두면
 * 지키지도 않는 약속을 화면에 띄우게 된다.
 */

export type DataSource = {
  id: string;
  /** 자료 이름 */
  name: string;
  /** 제공 기관 */
  authority: string;
  /** 이 앱에서 무엇에 쓰는지 */
  usedFor: string;
  /** 원문을 볼 수 있는 곳 */
  url?: string;
  /** 이용허락범위. 확인 전에는 비워둔다. */
  license?: string;
  /** ISO 8601 날짜. 사업계획서 25번 — 변하기 쉬운 정보는 마지막 확인일을 함께 둔다. */
  lastVerifiedAt: string;
};

export const DATA_SOURCES = {
  localdata: {
    id: 'localdata',
    name: '지방행정 인허가 데이터',
    authority: '행정안전부',
    usedFor: '업체 이름·지역·영업 여부',
    // 2026년 4월 localdata.go.kr 서비스 종료, 이후 공공데이터포털(data.go.kr)로 통합
    url: 'https://www.data.go.kr',
    lastVerifiedAt: '2026-09-01',
  },
  consumerDisputeStandard: {
    id: 'consumer-dispute-standard',
    name: '소비자분쟁해결기준 (예식업)',
    authority: '공정거래위원회',
    usedFor: '취소 위약금 기준과의 대조',
    lastVerifiedAt: '2026-08-28',
  },
  weddingAgencyTermsCorrection: {
    id: 'wedding-agency-terms-correction',
    name: '결혼준비대행업 불공정약관 시정',
    authority: '공정거래위원회',
    usedFor: '기본 제공이어야 하는 항목 확인',
    lastVerifiedAt: '2026-08-28',
  },
} as const satisfies Record<string, DataSource>;

export type DataSourceId = keyof typeof DATA_SOURCES;

/** 화면에 보여줄 출처 목록. */
export function listDataSources(): DataSource[] {
  return Object.values(DATA_SOURCES);
}

/** "행정안전부 지방행정 인허가 데이터 (2026-08-28 확인)" */
export function formatAttribution(source: DataSource): string {
  return `${source.authority} ${source.name} (${source.lastVerifiedAt} 확인)`;
}
