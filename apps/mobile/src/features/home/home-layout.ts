import { ROOT_TAB_GUTTER } from '@/components/root-tab-header';

/**
 * 홈(WP-HOME-001 · 002 · 003) 좌우 여백 **20**.
 *
 * 근거 — `docs/design/React_Native/home.js`에서 홈 세 프레임(home.jsx 391~709행)이 쓰는 키가
 * 전부 20이다: `header` `padding:0 20px` · `heroWrap` `0 20px 24px` · `hsec` `0 20px 24px` ·
 * `secLast` `0 20px` · `secHeadPad` `0 20px` · `prepGridPad` `0 20px 14px`. 같은 파일의 로그인 ·
 * 온보딩 · 혜택 시트(`loginBrand` · `loginAuth` · `qBlock` · `sec` · `benSheet` …)는 24다.
 *
 * 그래서 **전역 `Layout.gutter`(24)는 바꾸지 않고** 홈 화면 안에서만 이 값을 쓴다. 한 화면 안에
 * 20과 24가 섞이지 않게 홈의 머리 · 히어로 · 섹션 · 뼈대가 모두 이 한 값을 본다(2026-09-26 대표
 * 감사 — 홈 per-screen 모델 20 vs 구현 24).
 *
 * **값은 여기 적지 않는다** — 같은 날 대표 지시 「통일해」로 Root 5탭이 전부 20이 됐고, 그 한 값이
 * `ROOT_TAB_GUTTER`(components/root-tab-header)다. 홈은 그것을 이 이름으로 다시 내보낼 뿐이다.
 */
export const HOME_PAGE_X = ROOT_TAB_GUTTER;
