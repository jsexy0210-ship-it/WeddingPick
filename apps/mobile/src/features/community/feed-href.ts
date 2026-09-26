/**
 * 웨딩정보(웨딩피드) 목록 · 글 상세 주소 — 진입 출처(`from`)를 목록 ↔ 상세 사이에서 잃지 않는다.
 *
 *   MY 「웨딩정보」 → /community/feed?from=my → 글 → /community/feed/<id>?from=my
 *   글 하단 「목록」 → /community/feed?from=my  (목록의 Back은 다시 MY로 간다)
 *
 * 2026-09-26 대표 지시 「글 상세 하단 돌아가기 → 목록」. `from`은 받은 값을 그대로 옮기기만
 * 한다 — 무엇으로 돌아갈지는 목록 화면의 Depth Back(`depth-back-rules.ts` `originTarget`)이
 * 아는 값만 받아 정한다(모르는 값은 추측하지 않는다).
 */
export const FEED_LIST_PATH = '/community/feed';

function withFrom(path: string, from: string | null | undefined): string {
  return from ? `${path}?from=${encodeURIComponent(from)}` : path;
}

/** 글 상세 하단 「목록」이 가는 곳. */
export function feedListHref(from?: string | null): string {
  return withFrom(FEED_LIST_PATH, from);
}

/** 목록에서 연 글 상세. 목록이 받은 출처를 상세에도 실어 「목록」이 같은 목록으로 돌아가게 한다. */
export function feedDetailHref(id: string, from?: string | null): string {
  return withFrom(`${FEED_LIST_PATH}/${encodeURIComponent(id)}`, from);
}
