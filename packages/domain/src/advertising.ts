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

/** 광고가 영향을 줄 수 없는 것들. E-1이 정한 여섯 가지. */
export const ADVERTISING_MUST_NOT_AFFECT = [
  'payment_data',
  'review_content',
  'verification',
  'report_decision',
  'search_quality',
  'comparison',
] as const;

export type ProtectedSurface = (typeof ADVERTISING_MUST_NOT_AFFECT)[number];

export const PROTECTED_SURFACE_LABEL: Record<ProtectedSurface, string> = {
  payment_data: '실제 결제 데이터',
  review_content: '후기 내용과 평가',
  verification: '검증 결과',
  report_decision: '신고 결과',
  search_quality: '자연 검색 품질점수',
  comparison: '비광고 비교 결과',
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
