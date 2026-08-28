import { DATA_SOURCES, formatAttribution, listDataSources } from './data-sources';

describe('자료 출처', () => {
  it('출처마다 제공기관과 확인일이 있다', () => {
    for (const source of listDataSources()) {
      expect(source.authority).toBeTruthy();
      expect(source.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(source.usedFor).toBeTruthy();
    }
  });

  it('확인하지 않은 이용허락범위는 적어두지 않는다', () => {
    // 확인하지도 않은 유형을 화면에 띄우면 지키지 않을 약속을 하는 것이다.
    for (const source of listDataSources()) {
      expect(source.license).toBeUndefined();
    }
  });

  it('출처 문장에 기관·자료명·확인일이 들어간다', () => {
    expect(formatAttribution(DATA_SOURCES.localdata)).toBe(
      '행정안전부 지방행정 인허가 데이터 (2026-08-28 확인)'
    );
  });
});
