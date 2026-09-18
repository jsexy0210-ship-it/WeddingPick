import type { LoungeReviewListResponse } from '@weddingpick/api-contract';
import type { VendorCategory } from '@weddingpick/domain';

/**
 * 라운지 정본의 칩은 후기/웨딩정보가 함께 쓰므로 «예산»처럼 업체 업종이 아닌 값도 있다.
 * 서버 후기 필터에는 실제 업체 업종만 보낸다. 모르는 값을 임의 업종으로 바꾸지 않는다.
 */
export function loungeReviewCategory(label: string): VendorCategory | undefined {
  switch (label) {
    case '웨딩홀': return 'hall';
    case '드레스': return 'dress';
    case '스튜디오': return 'studio';
    case '메이크업': return 'makeup';
    case '허니문': return 'honeymoon';
    default: return undefined;
  }
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
