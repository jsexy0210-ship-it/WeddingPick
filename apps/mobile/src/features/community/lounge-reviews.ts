import type { LoungeReviewListResponse } from '@weddingpick/api-contract';
import { PREPARATION_GROUPS, VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';

/** 정본 my.js `cats` — 라운지 후기 · 웨딩정보가 함께 쓰는 칩 여섯. */
export const LOUNGE_CATEGORIES = ['전체', '웨딩홀', '스드메', '본식', '예물 · 신혼', '예산'] as const;
export type LoungeCategory = (typeof LOUNGE_CATEGORIES)[number];

/** 칩 → 업종 묶음. 준비 현황 그룹(`PREPARATION_GROUPS`)과 같은 묶음이다. «예산»은 업종이 아니다. */
function groupOf(label: string): readonly VendorCategory[] | null {
  switch (label) {
    case '웨딩홀': return PREPARATION_GROUPS.find((group) => group.key === 'start')?.categories ?? [];
    case '스드메': return PREPARATION_GROUPS.find((group) => group.key === 'sdm')?.categories ?? [];
    case '본식': return PREPARATION_GROUPS.find((group) => group.key === 'ceremony')?.categories ?? [];
    case '예물 · 신혼': return PREPARATION_GROUPS.find((group) => group.key === 'goods')?.categories ?? [];
    default: return null;
  }
}

/**
 * 서버 후기 필터에는 업종 하나만 보낸다 — 한 업종짜리 칩(«웨딩홀»)만 보내고, 묶음 칩은
 * 전체를 받아 화면에서 거른다(`loungeVendorMatches`). 모르는 값을 임의 업종으로 바꾸지 않는다.
 */
export function loungeReviewCategory(label: string): VendorCategory | undefined {
  const group = groupOf(label);
  return group && group.length === 1 ? group[0] : undefined;
}

/** 후기 카드가 칩에 드는가. «전체»는 모두 · «예산»은 업종이 아니라 후기가 없다. */
export function loungeVendorMatches(label: string, category: VendorCategory): boolean {
  if (label === '전체') return true;
  return groupOf(label)?.includes(category) ?? false;
}

/** 웨딩정보 글이 칩에 드는가 — 글 분류(`categoryLabel`)가 묶음 안 업종 이름이거나 칩 이름과 같다. */
export function loungeFeedMatches(label: string, categoryLabel: string): boolean {
  if (label === '전체' || label === categoryLabel) return true;
  const group = groupOf(label);
  return group ? group.some((category) => VENDOR_CATEGORY_LABEL[category] === categoryLabel) : false;
}

/**
 * cursor 다음 쪽을 붙일 때 같은 후기 id를 두 번 그리지 않는다.
 * 새 페이지가 최신 caveat/nextCursor의 정본이고, 기존 카드 순서는 유지한다.
 */
export function appendLoungeReviewPage(
  current: LoungeReviewListResponse,
  next: LoungeReviewListResponse
): LoungeReviewListResponse {
  const seen = new Set(current.reviews.map((review) => review.id));
  return {
    reviews: [...current.reviews, ...next.reviews.filter((review) => !seen.has(review.id))],
    nextCursor: next.nextCursor,
    caveat: next.caveat,
  };
}
