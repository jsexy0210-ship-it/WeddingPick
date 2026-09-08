import { SITE_ORIGIN } from '@weddingpick/domain';
import strings from '../../../spec/strings.ko.json';

/** 서비스 주소는 @weddingpick/domain SITE_ORIGIN 한 곳에서 온다(앱 약관 링크와 같은 값). */
export { SITE_ORIGIN };
export const SHARE_TITLE = strings.webLanding.metaTitle;
export const SHARE_DESCRIPTION = strings.webLanding.metaDescription;
export const SHARE_IMAGE = `${SITE_ORIGIN}/assets/weddingpick-og.png`;

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
<meta property="og:image" content="${SHARE_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="웨딩픽 — 확인하고 비교해서 골라요">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${SHARE_IMAGE}">`;
}
