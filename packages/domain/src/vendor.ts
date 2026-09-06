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
  'honeymoon',
  'etc',
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

/** 화면에 쓰는 이름. 코드를 그대로 보여주지 않는다. */
export const VENDOR_CATEGORY_LABEL: Record<VendorCategory, string> = {
  wedding_info_company: '웨딩정보회사',
  hall: '웨딩홀',
  sdm: '스드메',
  planner_agency: '플래닝',
  snap: '스냅·영상',
  goods: '예물·예단',
  honeymoon: '허니문',
  etc: '기타',
};

/**
 * 패키지 견적 안의 개별 업체 역할. `structured.quote_sub_vendors`의 `package_role`과
 * 값을 맞춘다. 스튜디오·드레스·메이크업을 한 평점으로 합치지 않기 위해 후기 화면이
 * 이 이름으로 각 업체를 부른다(사업계획서 19번).
 */
export const PACKAGE_ROLES = ['studio', 'dress', 'makeup', 'planning', 'snap', 'other'] as const;

export type PackageRole = (typeof PACKAGE_ROLES)[number];

export const PACKAGE_ROLE_LABEL: Record<PackageRole, string> = {
  studio: '스튜디오',
  dress: '드레스',
  makeup: '메이크업',
  planning: '플래닝',
  snap: '스냅·영상',
  other: '기타',
};

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
