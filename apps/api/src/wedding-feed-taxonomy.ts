import type { Pool } from 'pg';

import { WEDDING_FEED_TABS, type WeddingFeedTab } from '@weddingpick/domain';

/**
 * 웨딩피드의 칩 줄 — 공개 목록(`/v1/wedding-feed`)이 글과 함께 내려주는 `tabs`.
 *
 * **표에서 읽지 않는다**(2026-09-26 대표 지적 — 「관리자 웨딩피드 카테고리와 앱웹
 * 카테고리와 정보가 전혀 다르다」). 2026-09-16부터 열흘 동안 탭·카테고리는 표(0421)에
 * 있었고 관리자가 고쳤다. 그런데 그 탭을 그리던 앱 화면은 2026-09-25 정본에 없는
 * 화면이라 지워졌고(#535), 남은 라운지 「웨딩정보」는 정본 칩(my.js `cats`)을 그렸다 —
 * 관리자가 무엇을 고쳐도 앱은 그대로였다.
 *
 * 칩은 정본이 정하는 값이라(CLAUDE.md 2026-09-24 절대 지침) 관리자가 바꿀 수 있는 자리가
 * 아니다. 목록은 domain `WEDDING_FEED_CHIPS` · `WEDDING_FEED_CATEGORIES` 하나이고, 서버
 * 검사(`checkWeddingFeedInput`) · 관리자 화면 · 앱 칩이 같은 것을 본다. 표 두 개(0421)는
 * 0442가 이 목록과 같게 맞춰 두었고, 글의 `category_id`를 잇는 데에만 쓴다.
 *
 * `pool`은 받기만 한다 — 부르는 쪽(`listPublished`)의 모양을 바꾸지 않으려고 둔다.
 */
export async function listTabs(_pool?: Pool): Promise<readonly WeddingFeedTab[]> {
  return WEDDING_FEED_TABS;
}
