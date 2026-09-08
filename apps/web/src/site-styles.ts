/**
 * 서비스 웹(WP-WEB)의 스타일. 한 파일에 담아 인라인으로 넣는다.
 *
 * `styles.ts`(출시 전 소개 한 장)와 따로 둔다 — 소개 한 장은 글을 읽히는 것이
 * 일이고 이쪽은 검색으로 들어온 사람에게 업체와 금액을 보이는 것이 일이다. 폭도
 * 다르다(44rem 대 1280px). 한 파일에 섞으면 한쪽을 고칠 때 다른 쪽이 딸려 온다.
 *
 * **색은 `packages/ui/src/theme.ts`의 팔레트를 그대로 옮겨 적는다.** 이 파일은
 * 번들러 없이 통째로 문서에 실려서 tokens.css를 import할 수 없다. 옮겨 적은 값은
 * 갈라지므로 `site.test.ts`가 두 곳이 같은지 지킨다.
 */

/**
 * 글자 크기. **화면이 직접 적지 않고 이 표에서만 고른다.**
 *
 * 앱의 t 스케일(`packages/ui/src/typography.ts`)은 손에 쥔 화면용이라 t1 32px에서
 * 끝난다. 1280px 판에서 32px은 섹션 제목 크기이고 헤드라인 자리가 없다 — 그래서
 * 웹은 자기 스케일을 갖는다. 앱과 겹치는 자리(20·18·16·14·32)는 **같은 수를
 * 쓴다**: 같은 서비스가 앱에서는 16px, 웹에서는 17px로 보이면 나란히 놓고 보기
 * 전까지 아무도 모른다. `site.test.ts`가 그 겹치는 자리를 지킨다.
 *
 * 이름은 크기가 아니라 역할로 붙였다. `--fs-44`로 두면 44px을 바꾸는 순간
 * 이름이 거짓말이 된다.
 */
const TYPE_SCALE = `
  --fs-hero: 44px;      --lh-hero: 58px;
  --fs-display: 40px;   --lh-display: 52px;
  --fs-title1: 36px;    --lh-title1: 47px;
  --fs-amount: 32px;    --lh-amount: 43px;
  --fs-title2: 28px;    --lh-title2: 37px;
  --fs-title3: 24px;    --lh-title3: 32px;
  --fs-title4: 20px;    --lh-title4: 27px;
  --fs-lead: 18px;      --lh-lead: 28px;
  --fs-body: 16px;      --lh-body: 26px;
  --fs-label: 15px;     --lh-label: 21px;
  --fs-caption: 14px;   --lh-caption: 21px;
`;

export const SITE_STYLES = `
:root {
  color-scheme: light dark;

  /*
   * SEED gray 램프와 코랄. theme.ts의 palette를 그대로 옮겼다.
   *
   * 역할 이름으로만 쓴다 — 본문에서 hex를 집으면 어두운 모드에서 그 자리만
   * 밝은 색으로 남는다.
   */
  --ink: #212124;
  --ink-2: #393a40;
  --text-2: #4d5159;
  --text-3: #868b94;
  --line: #eaebee;
  --border: #dcdee3;
  --surface: #ffffff;
  --surface-1: #f7f8fa;
  --surface-2: #f2f3f6;
  --tint: #ff6f61;
  --tint-strong: #e2564a;
  --positive: #1aa174;
  --positive-bg: #e8faf6;

  /* 코랄 위의 글자. **어두운 모드에서도 뒤집지 않는다** — SEED on-primary 규칙. */
  --on-tint: #ffffff;

  /* 좌우 여백. 디자인의 56px. 좁은 화면에서는 아래 미디어 쿼리가 줄인다. */
  --gutter: 56px;
  /* 본문 최대 폭. 디자인의 웹 판 1280px에서 여백을 뺀 값이다. */
  --page: 1280px;
  /* 우측 기둥(실 제보 카드·집계). 디자인의 360px. */
  --side: 360px;
${TYPE_SCALE}
}

@media (prefers-color-scheme: dark) {
  :root {
    --ink: #eaebee;
    --ink-2: #ced3de;
    --text-2: #adb1ba;
    --text-3: #868b94;
    --line: #34373d;
    --border: #43474f;
    --surface: #17171a;
    --surface-1: #212124;
    --surface-2: #2b2e33;
    --tint: #ff8478;
    --tint-strong: #ffa79e;
    --positive: #3ecf8e;
    --positive-bg: #12281d;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--surface);
  color: var(--ink);
  /*
   * Pretendard를 싣지 않는다. 이 문서는 자기 혼자 서야 하고, 웹폰트 한 벌은
   * 검색으로 들어온 사람이 첫 화면을 보기까지를 늘린다. 핸드오프도 웹은 시스템
   * 서체로 두라고 적었다.
   */
  font-family: -apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo',
    'Malgun Gothic', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  /* 한글은 낱말 안에서 끊지 않는다. */
  word-break: keep-all;
}

.skip { position: absolute; left: -9999px; }
.skip:focus { position: static; display: inline-block; padding: 0.5rem 0.75rem; }

a { color: inherit; text-decoration: none; }
a:focus-visible, .skip:focus-visible, button:focus-visible, input:focus-visible {
  outline: 2px solid var(--tint);
  outline-offset: 2px;
}

.wrap { max-width: var(--page); margin-inline: auto; padding-inline: var(--gutter); }

/* ── GNB ─────────────────────────────────────────────────────────── */

.gnb { box-shadow: inset 0 -1px 0 var(--line); }
.gnb > .wrap { display: flex; align-items: center; min-height: 72px; gap: 34px; }

.logo { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.logo b {
  font-size: var(--fs-title4);
  line-height: var(--lh-title4);
  font-weight: 700;
  color: var(--ink);
}

.gnb nav { display: flex; flex-wrap: wrap; gap: 26px; }
.gnb nav a, .gnb nav span {
  font-size: var(--fs-body);
  font-weight: 700;
  color: var(--text-2);
  white-space: nowrap;
}
.gnb nav [aria-current='page'] { color: var(--ink); }

.gnb .side { margin-left: auto; display: flex; align-items: center; gap: 12px; }

/* ── 버튼 ────────────────────────────────────────────────────────── */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  font-family: inherit;
  font-size: var(--fs-body);
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}
.btn-primary { background: var(--tint); color: var(--on-tint); }
.btn-primary:hover { background: var(--tint-strong); }
.btn-ghost { background: var(--surface); color: var(--ink); border: 1px solid var(--border); }

.btn-sm { height: 42px; padding: 0 18px; }
.btn-md { height: 48px; padding: 0 26px; }
.btn-full { height: 52px; width: 100%; font-size: var(--fs-lead); }

.quiet {
  background: none;
  border: 0;
  padding: 0;
  font-family: inherit;
  font-size: var(--fs-body);
  font-weight: 700;
  color: var(--text-2);
  white-space: nowrap;
  cursor: pointer;
}

/* ── 홈 ─────────────────────────────────────────────────────────── */

.hero > .wrap {
  display: flex;
  gap: 56px;
  padding-block: 64px 56px;
  align-items: flex-start;
}
.hero-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 18px; }

h1 {
  margin: 0;
  font-size: var(--fs-hero);
  line-height: var(--lh-hero);
  font-weight: 700;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.lead {
  margin: 0;
  font-size: var(--fs-lead);
  line-height: var(--lh-lead);
  color: var(--text-2);
  text-wrap: pretty;
}

/* 검색. GET form이라 자바스크립트를 켜지 않아도 눌린다. */
.search {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 620px;
  min-height: 64px;
  padding: 8px 10px 8px 20px;
  border-radius: 10px;
  background: var(--surface-2);
}
.search svg { flex: 0 0 auto; }
.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  color: var(--ink);
  font-family: inherit;
  font-size: var(--fs-body);
}
.search input::placeholder { color: var(--text-3); }

.chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.chip {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--surface-2);
  font-size: var(--fs-label);
  line-height: var(--lh-label);
  font-weight: 700;
  color: var(--text-2);
  white-space: nowrap;
}

/* 우측 집계 기둥. */
.stat {
  flex: 0 0 var(--side);
  width: var(--side);
  padding: 28px;
  border-radius: 12px;
  background: var(--surface-1);
}
.stat h2 {
  margin: 0;
  font-size: var(--fs-caption);
  line-height: var(--lh-caption);
  font-weight: 700;
  color: var(--text-2);
}
.stat .total {
  display: block;
  margin: 4px 0 8px;
  font-size: var(--fs-display);
  line-height: var(--lh-display);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* 이름 왼쪽 · 값 오른쪽 · 사이에 1px. 홈의 집계와 상세의 공식정보가 같이 쓴다. */
.rows { margin: 0; }
.rows > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  min-height: 44px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
.rows > div:last-child { border-bottom: 0; }
.rows dt { font-size: var(--fs-body); line-height: var(--lh-label); color: var(--text-2); }
.rows dd {
  margin: 0;
  font-size: var(--fs-body);
  line-height: var(--lh-label);
  font-weight: 700;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

section > .wrap { padding-block: 0 64px; }
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
h2 {
  margin: 0;
  font-size: var(--fs-title2);
  line-height: var(--lh-title2);
  font-weight: 700;
  letter-spacing: -0.01em;
}
h3 {
  margin: 0;
  font-size: var(--fs-title3);
  line-height: var(--lh-title3);
  font-weight: 700;
}

.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 0; padding: 0; list-style: none; }

.vendor-card { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.vendor-card .name {
  font-size: var(--fs-title4);
  line-height: var(--lh-title4);
  font-weight: 700;
  color: var(--ink);
  /* 이름이 길어도 카드 폭을 밀지 않는다. */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vendor-card .price {
  font-size: var(--fs-lead);
  line-height: var(--lh-title4);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.vendor-card .price.none { font-weight: 400; color: var(--text-2); }
.vendor-card .meta {
  font-size: var(--fs-caption);
  line-height: var(--lh-caption);
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

/*
 * 이미지 자리. 업체 제공·사용동의 이미지가 아직 없다 — 회색 판을 뚫어두는 것을
 * 정책이 막았으므로(vendor-detail.ts hero_image) 자리마다 왜 비었는지 적는다.
 */
.shot {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border-radius: 10px;
  background: var(--surface-1);
  color: var(--text-3);
  font-size: var(--fs-caption);
  line-height: var(--lh-caption);
  text-align: center;
}
.shot-wide { aspect-ratio: 2 / 1; }
.shot-hero { aspect-ratio: 3 / 2; border-radius: 12px; }

.band { background: var(--surface-1); }
.band > .wrap { padding-block: 56px; }

.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 0; padding: 0; list-style: none; }
.step {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 28px;
  border-radius: 12px;
  background: var(--surface);
}
.step-no {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: var(--tint);
  color: var(--on-tint);
  font-size: var(--fs-label);
  line-height: var(--lh-label);
  font-weight: 700;
}
.step h3 { font-size: var(--fs-title4); line-height: var(--lh-title4); }
.step p { margin: 0; color: var(--text-2); text-wrap: pretty; }

/* ── 업체 상세 ────────────────────────────────────────────────────── */

.detail > .wrap {
  display: flex;
  gap: 48px;
  padding-block: 48px 64px;
  align-items: flex-start;
}
.detail-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 32px; }

.detail-head { display: flex; flex-direction: column; gap: 12px; }
.detail-head h1 {
  font-size: var(--fs-title1);
  line-height: var(--lh-title1);
  letter-spacing: -0.01em;
}
.badge {
  align-self: flex-start;
  padding: 4px 9px;
  border-radius: 4px;
  background: var(--positive-bg);
  color: var(--positive);
  font-size: var(--fs-caption);
  line-height: var(--lh-caption);
  font-weight: 700;
}

.block { display: flex; flex-direction: column; gap: 14px; }
.block > p { margin: 0; color: var(--text-2); text-wrap: pretty; }

/*
 * 아직 채울 자료가 없는 자리.
 *
 * 목록에서 지우지 않고 남긴다 — 정책이 정한 열세 자리 중 어디에 들어가는지를
 * 자료가 생기는 날 다시 정하지 않게 하려는 것이다(vendor-detail.ts).
 */
.pending {
  margin: 0;
  padding: 16px 18px;
  border-radius: 12px;
  background: var(--surface-1);
  color: var(--text-2);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
}

.aside { flex: 0 0 var(--side); width: var(--side); display: flex; flex-direction: column; gap: 20px; }

.card-outline {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 12px;
}
.card-plain {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 24px;
  border-radius: 12px;
  background: var(--surface-1);
}
.card-outline h2, .card-plain h2 {
  font-size: var(--fs-caption);
  line-height: var(--lh-caption);
  font-weight: 700;
  color: var(--text-2);
}
.amount {
  font-size: var(--fs-amount);
  line-height: var(--lh-amount);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.amount.none { font-size: var(--fs-title3); line-height: var(--lh-title3); color: var(--text-2); }
.caption {
  margin: 0;
  font-size: var(--fs-caption);
  line-height: var(--lh-caption);
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}
.note {
  margin: 0;
  font-size: var(--fs-caption);
  line-height: var(--lh-caption);
  color: var(--text-3);
  text-wrap: pretty;
}
.rule { height: 1px; background: var(--line); }

/* 공식정보. 값이 오른쪽에서 접힐 수 있어 rows와 따로 둔다. */
.facts { margin: 0; }
.facts > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
}
.facts dt {
  flex: 0 0 auto;
  font-size: var(--fs-caption);
  line-height: var(--lh-caption);
  color: var(--text-3);
}
.facts dd {
  margin: 0;
  font-size: var(--fs-body);
  line-height: var(--lh-label);
  font-weight: 700;
  text-align: right;
}

/* ── Footer ──────────────────────────────────────────────────────── */

footer { margin-top: auto; background: var(--surface-1); }
footer > .wrap { padding-block: 44px 40px; }
.foot-cols {
  display: flex;
  flex-wrap: wrap;
  gap: 56px;
  margin: 0 0 32px;
  padding: 0;
  list-style: none;
}
.foot-cols h2 {
  font-size: var(--fs-caption);
  line-height: var(--lh-caption);
  font-weight: 700;
  color: var(--ink);
}
.foot-cols ul { display: grid; gap: 10px; margin: 10px 0 0; padding: 0; list-style: none; }
.foot-cols li {
  font-size: var(--fs-caption);
  line-height: var(--lh-caption);
  color: var(--text-3);
}
.foot-cols a { color: var(--text-3); }
.foot-cols a:hover { color: var(--ink); }
.foot-cols .brand-link { font-weight: 700; color: var(--tint); }
.foot-cols .brand-link:hover { color: var(--tint-strong); }

.foot-bottom {
  display: grid;
  gap: 6px;
  padding-top: 24px;
  box-shadow: inset 0 1px 0 var(--line);
}
.foot-bottom p {
  margin: 0;
  font-size: var(--fs-caption);
  line-height: var(--lh-caption);
  color: var(--text-3);
  text-wrap: pretty;
}

/* ── 좁은 화면 ───────────────────────────────────────────────────── */

/*
 * 웹은 검색으로 들어오는 창구다 — 검색은 손에 쥔 화면에서 더 많이 일어난다.
 * 판이 좁아지면 두 기둥을 한 줄로 세우고 여백을 줄인다. 앱으로 보내는 화면이
 * 아니라 여기서 읽히는 화면이어야 한다.
 */
@media (max-width: 1000px) {
  :root { --gutter: 24px; }

  .hero > .wrap, .detail > .wrap { flex-direction: column; gap: 32px; }
  .stat, .aside { flex: 1 1 auto; width: 100%; }
  .cards, .steps { grid-template-columns: 1fr; }
}

@media (max-width: 700px) {
  :root {
    --fs-hero: 32px;      --lh-hero: 42px;
    --fs-display: 32px;   --lh-display: 43px;
    --fs-title1: 26px;    --lh-title1: 35px;
    --fs-title2: 22px;    --lh-title2: 30px;
    --fs-title3: 20px;    --lh-title3: 27px;
  }

  .hero > .wrap { padding-block: 40px 32px; }
  .gnb nav { display: none; }
  .search { flex-wrap: wrap; }
  .search .btn { width: 100%; }
}
`;
