import { getWeddingFeed } from '@/api/client';

/**
 * 웨딩피드 — 홈 아래쪽의 이미지 피드.
 *
 * `GET /v1/wedding-feed`(공개된 글만)를 부른다 — 관리자가 등록·수정·삭제하고
 * 자동 작성이 채우는 그 표다(`apps/api/src/wedding-feed.ts` `listPublished`).
 *
 * 목록이 비면 홈이 그 섹션을 통째로 접는다 — 눌러도 아무것도 없는 카드가 홈에
 * 두 장 있는 것은 섹션이 없는 것보다 나쁘다. **실패는 여기서 삼키지 않는다** —
 * 부르는 쪽마다 다루는 법이 다르다. 홈(`(tabs)/index.tsx`)은 조용히 넘기고,
 * 전체 보기(`(tabs)/(home)/feed.tsx`)는 오류 화면을 보여준다.
 *
 * 사용자에게 보이는 말은 «웨딩피드»다 — `AI`라고 적지 않는다.
 */

export type WeddingContentItem = {
  id: string;
  /** 어느 업종 이야기인가. 카드 위 작은 줄. */
  categoryLabel: string;
  title: string;
  imageUri: string | null;
};

export async function listWeddingContent(limit?: number): Promise<readonly WeddingContentItem[]> {
  const { items } = await getWeddingFeed(limit);

  return items.map((item) => ({
    id: item.id,
    categoryLabel: item.categoryLabel,
    title: item.title,
    imageUri: item.imageUrl,
  }));
}
