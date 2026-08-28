import {
  PLANNER_LISTING_BASIS,
  PLANNER_LISTING_SOURCES,
  canListPlanner,
} from './planner-listing';
import { SOURCE_TYPES } from './vendor';

describe('플래너 검색 노출', () => {
  it('문서에서 읽어낸 이름은 공개 근거가 되지 않는다', () => {
    // 사용자가 자기 계약을 확인받으려고 올린 문서다. 검색 목록에 실으라고 준 것이 아니다.
    expect(canListPlanner('ai_extraction')).toBe(false);
    expect(canListPlanner('user_quote')).toBe(false);
    expect(canListPlanner('contract_verified')).toBe(false);
    expect(canListPlanner(null)).toBe(false);
  });

  it('공개된 자료나 본인이 밝힌 것만 근거가 된다', () => {
    expect(canListPlanner('public_data')).toBe(true);
    expect(canListPlanner('vendor_official')).toBe(true);
  });

  it('근거로 인정하는 출처는 전체 출처보다 좁다', () => {
    // 출처가 늘어날 때 자동으로 공개 근거가 되지 않게 한다.
    expect(PLANNER_LISTING_SOURCES.length).toBeLessThan(SOURCE_TYPES.length);
  });

  it('왜 검색에 나오는지 근거마다 설명이 있다', () => {
    for (const source of PLANNER_LISTING_SOURCES) {
      expect(PLANNER_LISTING_BASIS[source]).toBeTruthy();
    }
  });
});
