import subsets from '../../../spec/font-subsets.json';

/**
 * 웹에서 Pretendard를 싣는 `@font-face` 두 벌.
 *
 * **한 벌이 아니라 두 벌인 이유.** 한글 폰트가 큰 이유는 음절 11,172자를 다 담기
 * 때문이고, 원본은 2.0MB다. 화면마다 그것을 받는다.
 *
 * 흔한 글자(KS X 1001 2,350)와 나머지를 갈라 두면 브라우저가 `unicode-range`를 보고
 * **그 화면에 실제로 나온 글자가 든 쪽만** 받는다. 재서 확인했다(2026-09-17 · Chromium):
 *
 *     보통 화면   [koCommon]            493KB      ← 1.4MB를 안 받는다
 *     드문 글자   [koCommon, koRest]    받아서 그린다 — 빠지는 글자가 없다
 *
 * **연속 구간으로 자르는 것은 소용이 없었다.** 1,000자씩 열둘로 잘라 재 보니 우리 문구가
 * 쓰는 음절 841개가 열두 덩이 전부에 흩어져 있었다. 그래서 빈도로 가른다.
 *
 * **순서가 규칙이다.** `rest`를 «먼저» 선언하고 `common`을 뒤에 둔다. 둘의 범위가
 * 한글 전체에서 겹치는데, 겹치면 «나중에 선언한 쪽»이 이긴다(CSS Fonts). 그래서
 * 낱개 목록 14KB를 한 번만 적는다. 순서를 바꾸면 보통 화면도 1.4MB를 받는다.
 *
 * 값의 원본은 `spec/font-subsets.json`이고 `scripts/subset-fonts.py`가 만든다.
 * **손으로 옮겨 적지 않는다** — 폰트 파일과 짝이라 한쪽만 바뀌면 글자가 빠진다.
 */
export type FontSubset = { file: string; bytes: number; unicodeRange: string };

/** 보통 화면이 받는 쪽. 미리 받기(`preload`)는 이것만 건다. */
export const FONT_COMMON: FontSubset = subsets.common;

/** 드문 글자가 나올 때만 받는 쪽. */
export const FONT_REST: FontSubset = subsets.rest;

/**
 * `@font-face` 두 벌을 만든다. `dir`는 폰트가 놓인 주소의 앞부분이다 —
 * 앱 웹은 `/fonts`, 웹사이트는 `/assets/fonts`로 서로 다르다.
 */
export function fontFaceRules(dir: string): string {
  const face = (subset: FontSubset) =>
    `@font-face{font-family:'Pretendard Variable';font-weight:45 920;font-style:normal;` +
    `font-display:swap;src:url('${dir}/${subset.file}') format('woff2-variations');` +
    `unicode-range:${subset.unicodeRange}}`;

  // rest가 먼저다. 위 주석의 「순서가 규칙이다」를 지키는 자리.
  return face(FONT_REST) + face(FONT_COMMON);
}
