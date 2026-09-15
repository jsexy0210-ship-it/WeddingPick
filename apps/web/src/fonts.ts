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
 * **가변 폰트 한 벌만 싣는다.** 45~920 축 하나가 400·600·700·800을 전부 덮는다 —
 * 정적 네 벌(약 3MB)보다 작고(2.0MB) 요청도 하나다.
 *
 * `font-display: swap`이다. 2.0MB가 뜨기를 기다리는 동안 글자가 안 보이면
 * 검색으로 들어온 사람은 빈 화면을 본다. 시스템 서체로 먼저 읽히고 바뀐다.
 */

/**
 * 서체 스택. **네 스타일시트가 각자 적지 않고 여기서 가져간다.**
 *
 * 원본은 `spec/tokens.json` `typography.$fontFamily.web` 하나다 — 옮겨 적으면
 * 갈라지고, 실제로 2026-09-15까지 네 파일이 서로 다른 스택을 들고 있었다.
 */
export const FONT_STACK: string = tokens.typography.$fontFamily.web;

/** 웹폰트가 놓인 자리. `apps/web/public/`이 통째로 출력 폴더로 복사된다(build.ts). */
export const FONT_URL = '/assets/fonts/PretendardVariable.woff2';

/**
 * `@font-face` 한 벌. 모든 스타일시트 맨 앞에 붙인다.
 *
 * 값은 원본 배포판의 `variable/pretendardvariable.css`를 그대로 옮긴 것이다 —
 * `font-weight: 45 920` · `format('woff2-variations')`. 숫자를 지어내지 않았다.
 */
export const FONT_FACE = `@font-face{font-family:'Pretendard Variable';font-weight:45 920;font-style:normal;font-display:swap;src:url('${FONT_URL}') format('woff2-variations')}`;

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
