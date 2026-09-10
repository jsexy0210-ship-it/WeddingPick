import { SITE_ORIGIN } from '@weddingpick/domain';
import strings from '../../../spec/strings.ko.json';

import { ogImageAlt } from './og-image';

/** 서비스 주소는 @weddingpick/domain SITE_ORIGIN 한 곳에서 온다(앱 약관 링크와 같은 값). */
export { SITE_ORIGIN };
export const SHARE_TITLE = strings.webLanding.metaTitle;
export const SHARE_DESCRIPTION = strings.webLanding.metaDescription;
export const SHARE_IMAGE = `${SITE_ORIGIN}/assets/weddingpick-og.png`;

/**
 * 관리자가 고쳐 둔 카드 문구.
 *
 * 빌드가 `/v1/site-meta`에서 한 번 읽어 `applySiteMeta()`로 넣는다. 없으면 spec의
 * 값을 그대로 쓴다 — 관리자가 손대지 않은 항목까지 표에 복사해 두면, 나중에 spec이
 * 바뀌어도 낡은 사본이 계속 이긴다.
 *
 * **왜 모듈 변수인가.** 카드 태그를 만드는 자리가 네 곳(랜딩 · 소개 · 하위페이지 ·
 * 업체 상세)이고 그 사이에 렌더 함수가 여러 겹 끼어 있다. 값을 인자로 흘려보내려면
 * 그 함수들의 서명을 전부 고쳐야 하는데, 빌드는 한 번 돌고 끝나는 프로세스라
 * 여기 담아두는 것으로 충분하다.
 */
export type SiteMetaOverride = {
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;
  ogImageAlt?: string | null;
};

let override: SiteMetaOverride | null = null;

export function applySiteMeta(next: SiteMetaOverride | null): void {
  override = next;
}

/** 홈 카드의 제목·설명. 하위 페이지는 각자의 제목을 쓴다. */
export function homeTitle(): string {
  return override?.ogTitle?.trim() || SHARE_TITLE;
}

export function homeDescription(): string {
  return override?.ogDescription?.trim() || SHARE_DESCRIPTION;
}

function shareImage(): string {
  return override?.ogImageUrl?.trim() || SHARE_IMAGE;
}

function shareImageAlt(): string {
  return override?.ogImageAlt?.trim() || ogImageAlt();
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Render in the static HTML head so crawlers never need JavaScript. */
export function socialMeta(path = '/', title = SHARE_TITLE, description = SHARE_DESCRIPTION): string {
  const t = escapeAttribute(title);
  const d = escapeAttribute(description);
  const url = escapeAttribute(new URL(path, SITE_ORIGIN).href);
  return `<link rel="canonical" href="${url}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${escapeAttribute(shareImage())}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="${escapeAttribute(shareImageAlt())}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${escapeAttribute(shareImage())}">`;
}
