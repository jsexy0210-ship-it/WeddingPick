import type { LoungeReviewListResponse } from '@weddingpick/api-contract';
import {
  PREPARATION_GROUPS,
  WEDDING_FEED_CHIPS,
  weddingFeedMatchesChip,
  type VendorCategory,
  type WeddingFeedChipKey,
  type WeddingFeedChipLabel,
} from '@weddingpick/domain';

/**
 * 정본 my.js `cats` — 라운지 후기 · 웨딩정보가 함께 쓰는 칩 여섯.
 *
 * **값은 domain `WEDDING_FEED_CHIPS` 하나다**(2026-09-26 대표 지적 — 관리자와 앱의 웨딩피드
 * 카테고리가 전혀 달랐다). 관리자 화면 · 서버 검사 · 이 칩이 같은 상수를 본다.
 */
export const LOUNGE_CATEGORIES: readonly WeddingFeedChipLabel[] = WEDDING_FEED_CHIPS.map((chip) => chip.label);
export type LoungeCategory = WeddingFeedChipLabel;

function chipKeyOf(label: string): WeddingFeedChipKey | null {
  return WEDDING_FEED_CHIPS.find((chip) => chip.label === label)?.key ?? null;
}

/** 칩 → 업종 묶음. 칩 키가 준비 현황 그룹 키와 같다(`PREPARATION_GROUPS`). «예산»은 업종이 아니다. */
function groupOf(label: string): readonly VendorCategory[] | null {
  const key = chipKeyOf(label);

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
 * 목록 밖 이름 · 칩 없는 카테고리(체크리스트 · 일정 · 하객 · 계약)는 «전체»에서만 보인다 —
 * 관리자 글 목록의 «앱 칩» 칸이 같은 함수로 같은 말을 한다.
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
