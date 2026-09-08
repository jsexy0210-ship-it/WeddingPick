/**
 * 업종. 디자인 핸드오프 v3.18 §1.3 · v3.15 «업종 순회 로딩»의 준비 순서 그대로다.
 *
 *   결정사 → 웨딩홀 → 스튜디오 → 드레스 → 메이크업 → 본식스냅 → 예물 → 혼수 → 허니문 → 청첩장
 *
 * 순서가 곧 준비 순서라 임의로 섞지 않는다(PREPARATION_CATEGORIES · 순회 로딩 ·
 * Pick 탭 · 웨딩일정 준비현황 · 검색 업종 격자가 전부 이 배열 순서를 쓴다).
 */
/*
 * 2026-09-08 변경 이력.
 * - `planner_agency`(플래닝)는 뺐다 — 플래너 기능 삭제(CLAUDE.md 2026-09-05)와 같은
 *   결정. DB enum 값은 남아 있지만(Postgres는 enum 값을 못 지운다) 화면·API·시드
 *   어디에서도 쓰지 않고, 0081이 그 업종의 업체 행을 지웠다.
 * - `sdm`(스드메)도 뺐다 — 핸드오프 v3.18이 스튜디오·드레스·메이크업을 따로 센다.
 *   DB enum 값은 마찬가지로 남아 있고, 0083이 새 값을 더한 뒤 0084가 남은 `sdm`
 *   업체를 `studio`로 옮겼다. 패키지 견적 안의 역할(PACKAGE_ROLES)은 다른 개념이라
 *   그대로다. 지출 묶음(EXPENSE_BUCKETS)의 `sdm`도 묶음 이름이라 그대로다.
 */
export const VENDOR_CATEGORIES = [
  'wedding_info_company',
  'hall',
  'studio',
  'dress',
  'makeup',
  'snap',
  'goods',
  'dowry',
  'honeymoon',
  'invitation',
  'etc',
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

/**
 * 준비 순서에 놓는 업종. «기타»는 준비 단계가 아니라 분류가 안 되는 업체를 담는
 * 칸이라 빠진다 — 핸드오프 순회 로딩(결정사 → 웨딩홀 → 스튜디오 → 드레스 →
 * 메이크업)이 «준비 순서와 같게 둔다»고 못박은 그 순서다. 홈의 다음 준비 · Pick 탭 ·
 * 웨딩일정 준비현황 · 검색 업종 격자가 전부 이 목록을 쓴다. 사용자 화면 어디에도
 * «기타»를 업종으로 내놓지 않는다.
 */
export const PREPARATION_CATEGORIES: readonly VendorCategory[] = VENDOR_CATEGORIES.filter(
  (category) => category !== 'etc'
);

/** 화면에 쓰는 이름. 코드를 그대로 보여주지 않는다. 핸드오프 v3.18 §1.3. */
export const VENDOR_CATEGORY_LABEL: Record<VendorCategory, string> = {
  /** 결혼정보회사. 사용자가 부르는 이름은 «결정사»다(2026-09-08 오더). */
  wedding_info_company: '결정사',
  hall: '웨딩홀',
  studio: '스튜디오',
  dress: '드레스',
  makeup: '메이크업',
  snap: '본식스냅',
  goods: '예물',
  dowry: '혼수',
  honeymoon: '허니문',
  invitation: '청첩장',
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
