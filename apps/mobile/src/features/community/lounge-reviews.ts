import type { LoungeReviewListResponse } from '@weddingpick/api-contract';
import {
  PREPARATION_GROUPS,
  WEDDING_FEED_CHIPS,
  weddingFeedMatchesChip,
  type VendorCategory,
  type WeddingFeedChipKey,
  type WeddingFeedChipLabel,
} from '@weddingpick/domain';

/** 후기 칩은 업종 묶음이다. 웨딩정보 칩은 글 소분류 묶음이라 각각 유지한다. */
const REVIEW_CHIPS = [
  { key: 'all', label: '전체' },
  { key: 'start', label: '웨딩홀' },
  { key: 'sdm', label: '스드메' },
  { key: 'ceremony', label: '본식' },
  { key: 'goods', label: '예물 · 신혼' },
  { key: 'budget', label: '예산' },
] as const;

export const LOUNGE_CATEGORIES = REVIEW_CHIPS.map((chip) => chip.label);
export const LOUNGE_FEED_CATEGORIES: readonly WeddingFeedChipLabel[] = WEDDING_FEED_CHIPS.map((chip) => chip.label);
export type LoungeCategory = (typeof REVIEW_CHIPS)[number]['label'] | WeddingFeedChipLabel;

function chipKeyOf(label: string): WeddingFeedChipKey | null {
  return WEDDING_FEED_CHIPS.find((chip) => chip.label === label)?.key ?? null;
}

/** 칩 → 업종 묶음. 칩 키가 준비 현황 그룹 키와 같다(`PREPARATION_GROUPS`). «예산»은 업종이 아니다. */
function groupOf(label: string): readonly VendorCategory[] | null {
  const key = REVIEW_CHIPS.find((chip) => chip.label === label)?.key;

  return PREPARATION_GROUPS.find((group) => group.key === key)?.categories ?? null;
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

/**
 * 웨딩정보 글이 칩에 드는가 — domain 목록(`WEDDING_FEED_CATEGORIES`)의 칩 배정을 그대로 쓴다.
 * 목록 밖 이름은 «전체»에서만 보인다. 등록된 소분류는 모두 대분류 칩에 속한다.
 */
export function loungeFeedMatches(label: string, categoryLabel: string): boolean {
  const key = chipKeyOf(label);

  return key !== null && weddingFeedMatchesChip(key, categoryLabel);
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
