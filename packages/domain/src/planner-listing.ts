import type { SourceType } from './vendor';

/**
 * 플래너를 검색에 싣는 규칙.
 *
 * 플래너는 업체와 달리 개인이다. 견적서에서 읽어낸 이름은 사용자가 자기 계약을
 * 확인받으려고 올린 문서에서 나온 것이고, 그것을 누구나 검색할 수 있는 목록에 싣는 것은
 * 수집한 목적과 다른 이용이다.
 *
 * 그래서 공개는 저절로 되지 않는다. 근거가 있어야 하고, 근거가 될 수 있는 것은 정해져
 * 있다. 같은 규칙이 DB 제약(0008)에도 들어 있다 — 여기만 고쳐서 뚫리지 않게.
 */

export const PLANNER_LISTING_STATUSES = ['private', 'public', 'withdrawn'] as const;

export type PlannerListingStatus = (typeof PLANNER_LISTING_STATUSES)[number];

export const PLANNER_LISTING_STATUS_LABEL: Record<PlannerListingStatus, string> = {
  private: '검색에 나오지 않음',
  public: '검색에 나옴',
  withdrawn: '노출 중단 요청됨',
};

/**
 * 공개의 근거가 될 수 있는 출처.
 *
 * `public_data`는 공개된 자료에 이미 실려 있다는 뜻이고, `vendor_official`은 업체나
 * 본인이 스스로 밝혔다는 뜻이다. `ai_extraction`은 남의 계약서에서 읽은 것이라
 * 근거가 아니다 — 이 목록에 없는 이유다.
 */
export const PLANNER_LISTING_SOURCES = ['public_data', 'vendor_official'] as const;

export type PlannerListingSource = (typeof PLANNER_LISTING_SOURCES)[number];

export function canListPlanner(source: SourceType | null): source is PlannerListingSource {
  return (
    source !== null && (PLANNER_LISTING_SOURCES as readonly SourceType[]).includes(source)
  );
}

/**
 * 왜 이 플래너가 검색에 나오는지. 화면에 그대로 적는다.
 *
 * 검색 결과에 개인 이름이 있는데 왜 있는지 적어두지 않으면, 본인도 다른 사람도 그것을
 * 따져볼 방법이 없다.
 */
export const PLANNER_LISTING_BASIS: Record<PlannerListingSource, string> = {
  public_data: '공개된 자료에 실려 있어 검색에 나옵니다',
  vendor_official: '소속 업체나 본인이 밝힌 정보라 검색에 나옵니다',
};

/** 노출 중단 안내. 검색 화면과 상세 화면 모두에 둔다. */
export const PLANNER_WITHDRAWAL_NOTICE =
  '검색에 나오는 것을 원하지 않으시면 알려주세요. 내려드리고 다시 올리지 않습니다.';
