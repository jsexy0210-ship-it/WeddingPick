import { FONT_COMMON, fontFaceRules } from '@weddingpick/domain';

import tokens from '../../../spec/tokens.json';

/*
 * Pretendard 웹폰트 — 웹의 서체는 여기 하나에서 온다.
 *
 * `spec/tokens.json` `typography.$fontFamily`가 「Pretendard 단일」이고 웹 스택 맨 앞이
 * `'Pretendard Variable'`이다. **그런데 2026-09-15까지 그 스택은 거짓이었다** — 저장소
 * 어디에도 폰트 파일이 없었고 `@font-face`도 없어서, 브라우저는 첫 이름을 못 찾고
 * 그대로 시스템 서체로 떨어졌다. 앱은 한 번도 Pretendard로 그려진 적이 없다.
 *
 * 대표님이 2026-09-15에 원본 파일을 올리셨다. 이 파일이 그것을 실제로 싣는 자리다.
 *
 * **가변 폰트를 쓰되 두 벌로 갈라 싣는다**(2026-09-17 대표 지시 「용량은 미리 축소한다」).
 * 45~920 축 하나가 400·600·700·800을 전부 덮으므로 굵기별로 나누지 않는다.
 *
 *     전        PretendardVariable.woff2          2.0MB  ← 화면마다 이것을 받았다
 *     후        …-koCommon.woff2                  493KB  ← 보통 화면은 이것만
 *              …-koRest.woff2                    1.4MB  ← 드문 글자가 나올 때만
 *
 * 가른 기준과 잰 값은 `packages/domain/src/web-font.ts`와 `scripts/subset-fonts.py`에
 * 있다. **빠지는 글자는 없다** — 둘을 합치면 원본을 덮는다.
 *
 * `font-display: swap`이다. 폰트가 뜨기를 기다리는 동안 글자가 안 보이면 검색으로
 * 들어온 사람은 빈 화면을 본다. 시스템 서체로 먼저 읽히고 바뀐다.
 */

/**
 * 서체 스택. **네 스타일시트가 각자 적지 않고 여기서 가져간다.**
 *
 * 원본은 `spec/tokens.json` `typography.$fontFamily.web` 하나다 — 옮겨 적으면
 * 갈라지고, 실제로 2026-09-15까지 네 파일이 서로 다른 스택을 들고 있었다.
 */
export const FONT_STACK: string = tokens.typography.$fontFamily.web;

/** 웹폰트가 놓인 자리. `apps/web/public/`이 통째로 출력 폴더로 복사된다(build.ts). */
export const FONT_DIR = '/assets/fonts';

/** 미리 받는 것은 **보통 화면이 쓰는 한 벌뿐**이다. 나머지는 필요할 때 브라우저가 받는다. */
export const FONT_URL = `${FONT_DIR}/${FONT_COMMON.file}`;

/**
 * `@font-face` 두 벌. 모든 스타일시트 맨 앞에 붙인다.
 *
 * 만드는 자리는 `packages/domain`이다 — 앱 웹(`+html.tsx`)과 웹사이트가 같은 글자를
 * 써야 하고, 두 곳에 따로 적으면 한쪽만 고쳐서 갈라진다. 실제로 2026-09-15까지
 * 네 파일이 서로 다른 서체 스택을 들고 있었다.
 */
export const FONT_FACE = fontFaceRules(FONT_DIR);

/**
 * `<head>`에 넣는 미리 받기.
 *
 * 스타일시트 안의 `@font-face`는 CSS가 읽히고 그 서체를 쓰는 글자가 나타나야 받기
 * 시작한다. `preload`는 그 두 단계를 건너뛴다. **`crossorigin`이 없으면 두 번 받는다** —
 * 폰트는 익명 CORS로 받게 돼 있어서 속성이 빠지면 preload한 것과 다른 요청이 된다.
 */
export function fontPreloadTag(): string {
  return `<link rel="preload" href="${FONT_URL}" as="font" type="font/woff2" crossorigin>`;
}
