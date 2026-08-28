/**
 * 서비스 카테고리. 사업계획서 6번의 확장 순서와 같다.
 * 초기부터 모든 카테고리를 같은 깊이로 다루지 않는다.
 */
export const VENDOR_CATEGORIES = [
  'wedding_info_company',
  'hall',
  'sdm',
  'planner_agency',
  'snap',
  'goods',
  'etc',
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

/**
 * 정보의 출처. 사업계획서 25번.
 * 공식정보와 실제 데이터를 섞지 않기 위해 값마다 출처를 들고 다닌다 — 제품 원칙 3.
 */
export const SOURCE_TYPES = [
  'public_data',
  'vendor_official',
  'user_quote',
  'contract_verified',
  'usage_verified',
  'ai_extraction',
  'external_schedule',
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

/** 변하기 쉬운 정보는 출처와 마지막 확인일을 함께 들고 다닌다. 사업계획서 25번. */
export type Sourced<T> = {
  value: T;
  source: SourceType;
  /** ISO 8601 날짜 */
  lastVerifiedAt: string;
};

export type Vendor = {
  id: string;
  category: VendorCategory;
  name: string;
  region: string;
  lastVerifiedAt: string;
};

export type Planner = {
  id: string;
  /** 소속 업체. 프리랜서면 없다. 플래너는 업체 부속정보가 아니라 독립 비교대상이다 — 사업계획서 11번. */
  vendorId: string | null;
  name: string;
  regions: string[];
};
