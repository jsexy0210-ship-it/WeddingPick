import { getWeddingFeed, getWeddingFeedPost } from '@/api/client';

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

/**
 * 글 하나를 열었을 때 그릴 것.
 *
 * 카드(`WeddingContentItem`)에 본문 · 한 줄 요약 · 공개 시각이 더 붙는다. **카드에
 * 없는 값이 여기 있는 것이 요점이다** — 목록이 본문까지 실어 나르면 읽지도 않을
 * 본문 여덟 편이 카드 여덟 장과 같이 건너온다.
 *
 * `publishedAt`이 비는 글은 없다(공개된 것만 나간다) — 그래도 계약이 `null`을 허용해서
 * 화면이 그 경우를 그린다.
 */
export type WeddingContentDetail = WeddingContentItem & {
  summary: string;
  body: string;
  publishedAt: string | null;
};

/**
 * 피드 화면이 그릴 탭 하나.
 *
 * **서버가 준다**(2026-09-16 대표 지시 — 「탭별 카테고리별로 다 설정 가능해야한다」).
 * 탭과 카테고리는 관리자가 표에서 고치고, 앱은 받은 것을 그대로 그린다.
 * `categories`가 빈 것이 「전체」이고 아무것도 거르지 않는다.
 */
export type WeddingFeedTabItem = {
  key: string;
  label: string;
  categories: readonly string[];
};

/**
 * 글과 탭을 **한 번에** 받는다.
 *
 * 따로 부르면 목록이 먼저 그려지고 탭 줄이 나중에 끼어들어 본문이 손가락 아래에서
 * 밀린다. 한 응답이면 둘이 같이 나타나거나 같이 안 나타난다.
 */
export async function listWeddingFeed(limit?: number): Promise<{
  items: readonly WeddingContentItem[];
  tabs: readonly WeddingFeedTabItem[];
}> {
  const { items, tabs } = await getWeddingFeed(limit);

  return {
    items: items.map((item) => ({
      id: item.id,
      categoryLabel: item.categoryLabel,
      title: item.title,
      imageUri: item.imageUrl,
    })),
    tabs,
  };
}

/**
 * 글 하나. 카드를 눌러 들어간 자리가 쓴다(`(tabs)/(home)/feed/[id].tsx`).
 *
 * **목록과 같은 이름을 쓴다** — 목록이 `imageUri`로 넘기는 것을 상세만 `imageUrl`로
 * 받으면 같은 그림이 화면마다 다른 이름을 갖는다. 웨딩피드를 부르는 곳은 이 파일
 * 하나이고, 이름을 맞추는 자리도 여기 하나다.
 */
export async function getWeddingFeedDetail(id: string): Promise<WeddingContentDetail> {
  const post = await getWeddingFeedPost(id);

  return {
    id: post.id,
    categoryLabel: post.categoryLabel,
    title: post.title,
    summary: post.summary,
    body: post.body,
    imageUri: post.imageUrl,
    publishedAt: post.publishedAt,
  };
}

/**
 * 글만 필요한 자리. 홈이 쓴다 — 홈의 웨딩피드는 3건 미리보기라 탭이 없다.
 */
export async function listWeddingContent(limit?: number): Promise<readonly WeddingContentItem[]> {
  const { items } = await listWeddingFeed(limit);

  return items;
}
