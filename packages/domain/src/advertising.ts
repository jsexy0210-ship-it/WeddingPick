/**
 * 광고와 자연 결과의 방화벽. 최종통합정책 v2.0 E장.
 *
 * > 광고비·CPA·CPL·B2B 계약 여부는 다음에 영향을 주지 않는다: 실제 결제 데이터,
 * > 후기 내용/평가, 검증 결과, 신고 결과, 자연 검색 품질점수, 비광고 비교 결과.
 *
 * **광고가 아직 없다.** 없는 동안 이 경계를 정해두는 것이 싸다 — 생긴 뒤에 나누려
 * 하면 이미 섞여 있고, 무엇이 광고 때문인지 아무도 답할 수 없게 된다.
 *
 * 이 파일은 **광고가 절대 건드리지 못하는 것의 목록**이고, 테스트가 그 목록을
 * 지킨다. 광고를 붙이는 사람이 이 파일을 먼저 만난다.
 */

/**
 * 광고가 영향을 줄 수 없는 것들. v3.10 §4가 목록을 다시 적었다.
 *
 * v2.0 E-1의 여섯 가지를 대체한다 — 그때는 없던 추천(TOP3·오늘의 Pick·개인화)이
 * 생겼고, **새로 만든 것부터 광고가 붙기 쉽다.** 목록을 갱신하지 않으면 새 기능은
 * 아무도 지키지 않는 자리가 된다.
 */
export const ADVERTISING_MUST_NOT_AFFECT = [
  'top3',
  'todays_pick',
  'personalized',
  'search_ranking',
  'verified_data',
  'reviews',
] as const;

export type ProtectedSurface = (typeof ADVERTISING_MUST_NOT_AFFECT)[number];

/**
 * 관리자·운영 화면에서 쓰는 이름.
 *
 * `AI TOP3`처럼 사용자 화면에 못 쓰는 말이 들어 있다. 정책 문서가 보호 대상을
 * 그 이름으로 적어두었고, 여기는 그 목록을 사람이 눈으로 맞춰보는 자리라
 * 정책과 같은 말을 쓴다. **사용자 화면에서는 이 표를 쓰지 않는다.**
 */
export const PROTECTED_SURFACE_LABEL: Record<ProtectedSurface, string> = {
  top3: 'AI TOP3',
  todays_pick: '오늘의 Pick',
  personalized: '개인화 추천',
  search_ranking: '자연 검색순위',
  verified_data: '확인된 정보',
  reviews: '후기 및 후기 순위',
};

/**
 * 검색 결과 한 줄이 광고인가.
 *
 * **광고 여부는 순위를 매기는 신호와 따로 둔다**(E-2). 하나로 섞으면 "이 업체가
 * 위에 있는 것이 광고 때문인지"에 답할 수 없다.
 */
export type Placement =
  | { kind: 'organic'; reasons: readonly RankingReason[] }
  | { kind: 'sponsored'; label: string };

/**
 * 왜 이 순서인가. E-2 — 추천/랭킹 결과에는 내부적으로 근거를 기록한다.
 *
 * 화면에 그대로 띄우려고 두는 것이 아니라 **답할 수 있게** 두는 것이다.
 */
export const RANKING_REASONS = [
  'search_match',
  'region',
  'data_sufficiency',
  'explicit_interest',
  'recency',
] as const;

export type RankingReason = (typeof RANKING_REASONS)[number];

export const RANKING_REASON_LABEL: Record<RankingReason, string> = {
  search_match: '검색어와 맞음',
  region: '지역이 가까움',
  data_sufficiency: '데이터가 충분함',
  explicit_interest: '관심업체로 담아둠',
  recency: '최근 자료가 있음',
};

/** 유료 노출에 붙이는 말. 명확해야 하고, 애매한 말을 쓰지 않는다. */
export const SPONSORED_LABEL = '광고';

/**
 * 광고를 자연 결과 사이에 끼워 넣지 않는다.
 *
 * E-1이 "영역을 분리한다"고 정했다. 섞어 놓고 배지만 붙이면, 배지를 못 본 사람에게
 * 그건 그냥 검색 결과다.
 */
export function isSeparated(rows: readonly Placement[]): boolean {
  const kinds = rows.map((row) => row.kind);
  const firstOrganic = kinds.indexOf('organic');
  const lastSponsored = kinds.lastIndexOf('sponsored');

  // 광고가 없거나 자연 결과가 없으면 섞일 일이 없다.
  if (firstOrganic === -1 || lastSponsored === -1) return true;

  return lastSponsored < firstOrganic;
}

/**
 * 초기 광고 상품. 통합정책 v3.10 §2.
 *
 * **월 정액이다.** 트래픽과 성과 데이터가 모이기 전에 CPC/성과형을 넣지 않는다 —
 * 셀 것이 없는데 성과로 값을 매기면 그 값은 우리가 지어낸 값이다.
 *
 * 위 등급이 아래를 포함한다. 배열 순서가 그 포함 관계다.
 */
export const AD_TIERS = ['light', 'standard', 'premium'] as const;

export type AdTier = (typeof AD_TIERS)[number];

export type AdTierRule = {
  label: string;
  monthlyKrw: number;
  /** 이 등급에서 새로 열리는 지면. 아래 등급 것은 그대로 포함한다. */
  adds: readonly AdSurface[];
};

/** 광고가 실릴 수 있는 자리. `ads.placements`의 surface와 같은 목록이다. */
export const AD_SURFACES = ['vendor_detail', 'search', 'region_category'] as const;

export type AdSurface = (typeof AD_SURFACES)[number];

export const AD_SURFACE_LABEL: Record<AdSurface, string> = {
  vendor_detail: '업체 상세 스폰서 혜택',
  search: '검색 결과 스폰서 슬롯',
  region_category: '지역·카테고리 스폰서 영역',
};

export const AD_TIER_RULES: Record<AdTier, AdTierRule> = {
  light: { label: 'LIGHT', monthlyKrw: 30_000, adds: ['vendor_detail'] },
  standard: { label: 'STANDARD', monthlyKrw: 70_000, adds: ['search'] },
  premium: { label: 'PREMIUM', monthlyKrw: 150_000, adds: ['region_category'] },
};

/**
 * 이 등급이 살 수 있는 지면 전부.
 *
 * 등급마다 목록을 따로 적어두지 않는 이유는, 포함 관계가 두 곳에 적히면 언젠가
 * 한쪽만 고쳐지기 때문이다. 순서에서 계산한다.
 */
export function surfacesFor(tier: AdTier): AdSurface[] {
  return AD_TIERS.slice(0, AD_TIERS.indexOf(tier) + 1).flatMap(
    (step) => AD_TIER_RULES[step].adds
  );
}

/**
 * 초기 광고주 확보 프로모션. v3.10 §3.
 *
 * 첫 달만이다. **영구 무료는 상품이 아니다** — 값을 매기지 않은 지면은 지면이
 * 아니라 부탁이고, 부탁으로 시작한 관계는 나중에 값을 받기 어렵다.
 */
export const AD_PROMOTIONS = ['first_month_free', 'first_month_half'] as const;

export type AdPromotion = (typeof AD_PROMOTIONS)[number];

export const AD_PROMOTION_LABEL: Record<AdPromotion, string> = {
  first_month_free: '첫 달 무료',
  first_month_half: '첫 달 50% 할인',
};

/** 첫 달에 실제로 받는 금액. 둘째 달부터는 정가다. */
export function firstMonthKrw(tier: AdTier, promotion: AdPromotion | null): number {
  const price = AD_TIER_RULES[tier].monthlyKrw;

  if (promotion === 'first_month_free') return 0;
  if (promotion === 'first_month_half') return price / 2;

  return price;
}

/**
 * 재고 있는 성과 지표. v3.10 §5.
 *
 * 노출·클릭·Pick 전환까지만 잰다. 이 셋이 쌓이기 전에는 성과형 과금을 넣지
 * 않는다 — 재보지 않은 것으로 값을 매길 수는 없다.
 */
export const AD_METRICS = ['impression', 'click', 'pick'] as const;

export type AdMetric = (typeof AD_METRICS)[number];

export const AD_METRIC_LABEL: Record<AdMetric, string> = {
  impression: '노출',
  click: '클릭',
  pick: 'Pick 전환',
};
