/**
 * 디자인 시안(웨딩픽 웹.dc.html)과 동기화된 스타일.
 * 값은 시안 renderVals()에서 추출했다.
 *
 * packages/ui/src/theme.ts, typography.ts와 **같은 값이어야 한다.**
 * 번들러 없이 인라인으로 실리므로 변수 대신 직접 값을 쓴다.
 * apps/api/src/test/typography.test.ts가 두 곳이 갈라지지 않았는지 지킨다.
 */
export const STYLES = `
:root {
  color-scheme: light dark;

  /* 브랜드 */
  --coral: #ff6f61;
  --coral-dark: #e2564a;

  /* 텍스트 */
  --text-p: #212124;
  --text-s: #4d5159;
  --text-m: #868b94;
  --text-w: #868b94;

  /* 배경 */
  --bg: #ffffff;
  --bg-light: #f7f8fa;
  --bg-input: #f2f3f6;

  /* 테두리 */
  --border: #eaebee;
  --border-card: #dcdee3;

  /* 레이아웃 */
  --max: 1280px;
  --pad: 56px;
  --pad-sm: 24px;

  /* 타이포 — t 스케일. 앱과 같은 수 */
  --t44: 44px;
  --t40: 40px;
  --t36: 36px;
  --t32: 32px;
  --t28: 28px;
  --t26: 26px;
  --t24: 24px;
  --t22: 22px;
  --t20: 20px;
  --t18: 18px;
  --t16: 16px;
  --t15: 15px;
  --t14: 14px;
  --t13: 13px;
  --t12: 12px;

  /* 앱 타이포 스케일 — packages/ui/src/typography.ts와 같은 값 */
  --text-t1: 32px;
  --text-t2: 26px;
  --text-t4: 20px;
  --text-t5: 18px;
  --text-t6: 16px;
  --text-t7: 14px;
  --text-badge: 12px;
  --text-amount: 32px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --text-p: #ecedee;
    --text-s: #9ba1a6;
    --text-m: #6b7684;
    --text-w: #6b7684;
    --bg: #151718;
    --bg-light: #1f2325;
    --bg-input: #23282b;
    --border: #2c3134;
    --border-card: #2c3134;
    --coral: #ff8478;
    --coral-dark: #ff6f61;
  }
}

*, *::before, *::after { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text-p);
  font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard',
    'Noto Sans KR', 'Malgun Gothic', system-ui, sans-serif;
  font-size: var(--t16);
  line-height: 1.6;
  word-break: keep-all;
  -webkit-font-smoothing: antialiased;
}

/* ── 접근성 ── */
.skip {
  position: absolute;
  left: -9999px;
}
.skip:focus {
  position: static;
  display: inline-block;
  padding: 0.5rem 0.75rem;
  z-index: 100;
}
a:focus-visible,
button:focus-visible {
  outline: 2px solid var(--coral);
  outline-offset: 2px;
}

/* ── 공통 래퍼 ── */
.wrap {
  width: min(100% - calc(var(--pad) * 2), var(--max));
  margin-inline: auto;
}
@media (max-width: 1023px) {
  .wrap { width: min(100% - 48px, var(--max)); }
}
@media (max-width: 767px) {
  .wrap { width: min(100% - 40px, var(--max)); }
}
@media (max-width: 479px) {
  .wrap { width: min(100% - 32px, var(--max)); }
}

/* ── GNB ── */
.gnb {
  position: sticky;
  top: 0;
  z-index: 50;
  height: 72px;
  display: flex;
  align-items: center;
  background: var(--bg);
  box-shadow: inset 0 -1px 0 var(--border);
}
.gnb-inner {
  display: flex;
  align-items: center;
  gap: 0;
  width: min(100% - calc(var(--pad) * 2), var(--max));
  margin-inline: auto;
}
@media (max-width: 1023px) {
  .gnb-inner { width: min(100% - 48px, var(--max)); }
}
@media (max-width: 767px) {
  .gnb-inner { width: min(100% - 40px, var(--max)); }
}
@media (max-width: 479px) {
  .gnb-inner { width: min(100% - 32px, var(--max)); }
}

.gnb-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  text-decoration: none;
}
.gnb-logo-text {
  font-size: var(--t22);
  font-weight: 700;
  color: var(--text-p);
  white-space: nowrap;
}

.gnb-menu {
  display: flex;
  gap: 26px;
  margin-left: 34px;
  list-style: none;
  padding: 0;
  margin-top: 0;
  margin-bottom: 0;
}
.gnb-menu a {
  font-size: var(--t16);
  font-weight: 700;
  color: var(--text-s);
  text-decoration: none;
  white-space: nowrap;
}
.gnb-menu a:hover,
.gnb-menu a[aria-current] { color: var(--text-p); }

.gnb-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  flex: 0 0 auto;
}
.gnb-login {
  font-size: var(--t16);
  font-weight: 700;
  color: var(--text-s);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

/* 햄버거 (모바일) */
.gnb-hamburger {
  display: none;
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: var(--text-p);
  margin-left: auto;
}

@media (max-width: 767px) {
  .gnb-menu { display: none; }
  .gnb-login { display: none; }
  .gnb-hamburger { display: flex; align-items: center; }
}

/* 모바일 드로어 */
.gnb-drawer {
  display: none;
  position: fixed;
  inset: 72px 0 0 0;
  z-index: 49;
  background: var(--bg);
  padding: 24px 20px;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 8px 24px rgba(0,0,0,.12);
  overflow-y: auto;
}
.gnb-drawer.open { display: flex; }
.gnb-drawer a {
  padding: 14px 0;
  font-size: var(--t18);
  font-weight: 700;
  color: var(--text-s);
  text-decoration: none;
  border-bottom: 1px solid var(--border);
}
.gnb-drawer a:last-child { border-bottom: none; }
.gnb-drawer a:hover { color: var(--text-p); }

/* ── 버튼 ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 42px;
  padding: 0 18px;
  border-radius: 6px;
  background: var(--coral);
  color: #fff;
  font-size: var(--t16);
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover { background: var(--coral-dark); }
.btn-primary-md {
  height: 52px;
  padding: 0 26px;
  font-size: var(--t17, var(--t16));
}
.btn-primary-full {
  width: 100%;
  height: 52px;
  font-size: var(--t17, var(--t16));
}
.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 42px;
  padding: 0 18px;
  border-radius: 6px;
  border: 1px solid var(--border-card);
  background: var(--bg);
  color: var(--text-p);
  font-size: var(--t16);
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}
.btn-ghost:hover { background: var(--bg-light); }
.btn-ghost-full {
  width: 100%;
  height: 52px;
}

/* ── Hero ── */
.hero {
  display: flex;
  gap: 56px;
  padding: 64px var(--pad) 56px;
  max-width: var(--max);
  margin-inline: auto;
}
@media (max-width: 1023px) {
  .hero { padding: 48px 24px 48px; gap: 40px; }
}
@media (max-width: 767px) {
  .hero {
    flex-direction: column;
    gap: 32px;
    padding: 40px 20px 40px;
  }
}

.hero-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hero-h1 {
  margin: 0;
  font-size: clamp(32px, 4vw, var(--t44));
  line-height: 1.32;
  font-weight: 700;
  color: var(--text-p);
  letter-spacing: -0.02em;
  word-break: keep-all;
}

.hero-sub {
  margin: 0;
  font-size: var(--t18);
  line-height: 1.56;
  color: var(--text-s);
}

.hero-search {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 64px;
  border-radius: 10px;
  background: var(--bg-input);
  padding: 0 10px 0 20px;
  max-width: 620px;
}
.hero-search-icon { flex: 0 0 auto; color: var(--text-m); }
.hero-search-placeholder {
  flex: 1;
  font-size: var(--t16);
  color: var(--text-m);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (max-width: 767px) {
  .hero-search { max-width: 100%; }
}

.hero-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  list-style: none;
  padding: 0;
  margin: 0;
}
.hero-chip {
  display: inline-flex;
  align-items: center;
  height: 38px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--bg-input);
  font-size: var(--t15);
  font-weight: 700;
  color: var(--text-s);
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
}
.hero-chip:hover { background: var(--border); }

.hero-stat {
  width: 360px;
  flex: 0 0 360px;
  border-radius: 12px;
  background: var(--bg-light);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-self: flex-start;
}
@media (max-width: 1023px) {
  .hero-stat { width: 300px; flex: 0 0 300px; padding: 20px; }
}
@media (max-width: 767px) {
  .hero-stat { width: 100%; flex: 0 0 auto; padding: 20px; }
}

.hero-stat-label {
  font-size: var(--t14);
  font-weight: 700;
  color: var(--text-s);
}
.hero-stat-total {
  font-size: var(--t40);
  line-height: 1.3;
  font-weight: 700;
  color: var(--text-p);
  font-variant-numeric: tabular-nums;
}
.hero-stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 44px;
  padding: 8px 0;
}
.hero-stat-row-label {
  font-size: var(--t16);
  color: var(--text-s);
}
.hero-stat-row-value {
  font-size: var(--t16);
  font-weight: 700;
  color: var(--text-p);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.hero-stat-divider {
  height: 1px;
  background: var(--border);
}

/* ── 섹션 공통 ── */
.section {
  padding: 0 var(--pad) 64px;
}
.section-wrap {
  max-width: var(--max);
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
@media (max-width: 1023px) {
  .section { padding: 0 24px 56px; }
}
@media (max-width: 767px) {
  .section { padding: 0 20px 48px; }
}

.section-gray {
  background: var(--bg-light);
  padding: 56px var(--pad);
}
.section-gray .section-wrap { padding: 0; }
@media (max-width: 1023px) {
  .section-gray { padding: 48px 24px; }
}
@media (max-width: 767px) {
  .section-gray { padding: 40px 20px; }
}

.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.section-title {
  margin: 0;
  font-size: var(--t28);
  line-height: 1.32;
  font-weight: 700;
  color: var(--text-p);
}
.section-more {
  font-size: var(--t16);
  font-weight: 700;
  color: var(--text-s);
  text-decoration: none;
  white-space: nowrap;
}
.section-more:hover { color: var(--text-p); }

/* ── 업체 카드 그리드 ── */
.vendor-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
@media (max-width: 1023px) {
  .vendor-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 479px) {
  .vendor-grid { grid-template-columns: 1fr; }
}

.vendor-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}
.vendor-card-img {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 1;
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-input);
}
.vendor-card-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.vendor-card-name {
  font-size: var(--t20);
  line-height: 1.35;
  font-weight: 700;
  color: var(--text-p);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vendor-card-price {
  font-size: var(--t18);
  line-height: 1.33;
  font-weight: 700;
  color: var(--text-p);
  font-variant-numeric: tabular-nums;
}
.vendor-card-count {
  font-size: var(--t14);
  line-height: 1.36;
  color: var(--text-m);
  font-variant-numeric: tabular-nums;
}

/* ── How it works 카드 ── */
.how-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
@media (max-width: 1023px) {
  .how-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 479px) {
  .how-grid { grid-template-columns: 1fr; }
}

.how-card {
  background: var(--bg);
  border-radius: 12px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
@media (max-width: 767px) {
  .how-card { padding: 20px; }
}

.how-step-no {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: var(--coral);
  color: #fff;
  font-size: var(--t15);
  font-weight: 700;
}
.how-card-title {
  font-size: var(--t20);
  line-height: 1.35;
  font-weight: 700;
  color: var(--text-p);
}
.how-card-body {
  font-size: var(--t16);
  line-height: 1.63;
  color: var(--text-s);
}

/* ── 레거시 콘텐츠 섹션 (하위 호환) ── */
.legacy-section {
  padding: 40px var(--pad) 0;
}
.legacy-section-wrap {
  max-width: var(--max);
  margin-inline: auto;
}
@media (max-width: 1023px) {
  .legacy-section { padding: 32px 24px 0; }
}
@media (max-width: 767px) {
  .legacy-section { padding: 24px 20px 0; }
}

.legacy-section h2 {
  margin: 0 0 1rem;
  font-size: var(--t24);
  font-weight: 700;
  letter-spacing: -0.01em;
}
.legacy-section h3 {
  margin: 0 0 0.35rem;
  font-size: var(--t16);
  font-weight: 700;
}
.legacy-section p {
  margin: 0 0 1rem;
  font-size: var(--t16);
  line-height: 1.7;
  color: var(--text-s);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.75rem;
}
.card {
  padding: 1rem 1.15rem;
  border-radius: 0.9rem;
  background: var(--bg-light);
}
.card p {
  margin: 0;
  color: var(--text-s);
  font-size: var(--t16);
}

/* 표 */
.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
table {
  width: 100%;
  min-width: 26rem;
  border-collapse: collapse;
  font-size: var(--t16);
}
caption {
  text-align: left;
  padding-bottom: 0.5rem;
  color: var(--text-s);
  font-size: var(--t14);
}
th, td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}
thead th { color: var(--text-s); font-weight: 600; font-size: var(--t14); }
tbody th { font-weight: 600; white-space: nowrap; }

/* 출처 목록 */
ul.sources, ul.policies {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}
ul.sources li, ul.policies li {
  display: grid;
  gap: 0.2rem;
  padding: 1rem 1.15rem;
  border-radius: 0.9rem;
  background: var(--bg-light);
  font-size: var(--t16);
}
ul.sources span, ul.policies span { color: var(--text-s); }

.status {
  justify-self: start;
  padding: 0.1rem 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  font-size: var(--t12);
}
.pending { font-size: var(--t14); }

ul.plain {
  margin: 0 0 1rem;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.35rem;
  font-size: var(--t16);
  color: var(--text-s);
}
ul.plain strong { color: var(--text-p); }

a { color: var(--coral); }

/* ── Footer ── */
.footer {
  background: var(--bg-light);
  padding: 44px var(--pad) 40px;
  margin-top: auto;
}
.footer-inner {
  max-width: var(--max);
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
}
@media (max-width: 1023px) {
  .footer { padding: 40px 24px; }
}
@media (max-width: 767px) {
  .footer { padding: 36px 20px; }
}

.footer-cols {
  display: flex;
  gap: 56px;
  flex-wrap: wrap;
}
@media (max-width: 767px) {
  .footer-cols { gap: 32px; }
}
@media (max-width: 479px) {
  .footer-cols { gap: 24px; }
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 100px;
}
.footer-col-title {
  font-size: var(--t14);
  font-weight: 700;
  color: var(--text-p);
}
.footer-col a {
  font-size: var(--t14);
  line-height: 1.36;
  color: var(--text-m);
  text-decoration: none;
}
.footer-col a:hover { color: var(--text-p); }
.footer-col a.highlight {
  font-weight: 700;
  color: var(--coral);
}
.footer-col a.highlight:hover { color: var(--coral-dark); }

.footer-bottom {
  padding-top: 24px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.footer-bottom p {
  margin: 0;
  font-size: var(--t14);
  line-height: 1.5;
  color: var(--text-m);
}

/* ── 하위 페이지 타이틀 밴드 ── */
.title-band {
  background: var(--bg-light);
  padding: 48px var(--pad) 40px;
}
.title-band-inner {
  max-width: var(--max);
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
@media (max-width: 1023px) {
  .title-band { padding: 40px 24px; }
}
@media (max-width: 767px) {
  .title-band { padding: 32px 20px; }
}

.title-band-dash {
  width: 32px;
  height: 4px;
  border-radius: 2px;
  background: var(--coral);
}
.title-band-breadcrumb {
  font-size: var(--t14);
  color: var(--text-m);
}
.title-band-breadcrumb a {
  color: var(--text-m);
  text-decoration: none;
}
.title-band-breadcrumb a:hover { color: var(--text-p); }
.title-band-h1 {
  margin: 0;
  font-size: clamp(28px, 3.5vw, var(--t36));
  font-weight: 700;
  color: var(--text-p);
  letter-spacing: -0.02em;
}
.title-band-desc {
  margin: 0;
  font-size: var(--t18);
  line-height: 1.56;
  color: var(--text-s);
}

/* ── FAQ ── */
.faq-wrap {
  max-width: var(--max);
  margin-inline: auto;
  padding: 48px var(--pad) 80px;
}
@media (max-width: 1023px) {
  .faq-wrap { padding: 40px 24px 64px; }
}
@media (max-width: 767px) {
  .faq-wrap { padding: 32px 20px 56px; }
}

.faq-list {
  list-style: none;
  padding: 0;
  margin: 32px 0 0;
}
.faq-item {
  border-bottom: 1px solid var(--border);
}
.faq-item:first-child { border-top: 1px solid var(--border); }

.faq-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 64px;
  padding: 16px 0;
  font-size: var(--t18);
  font-weight: 700;
  color: var(--text-p);
  cursor: pointer;
  list-style: none;
  -webkit-appearance: none;
}
.faq-summary::-webkit-details-marker { display: none; }
.faq-summary::marker { display: none; }

.faq-chevron {
  flex: 0 0 auto;
  transition: transform 0.2s;
  color: var(--text-m);
}
details[open] .faq-chevron { transform: rotate(180deg); }

.faq-answer {
  padding: 0 0 20px;
  font-size: var(--t16);
  line-height: 1.7;
  color: var(--text-s);
}

/* ── 문의 폼 ── */
.contact-wrap {
  max-width: min(720px, 100%);
  margin-inline: auto;
  padding: 48px var(--pad) 80px;
}
@media (max-width: 1023px) {
  .contact-wrap { padding: 40px 24px 64px; }
}
@media (max-width: 767px) {
  .contact-wrap { padding: 32px 20px 56px; }
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 32px;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-label {
  font-size: var(--t15);
  font-weight: 700;
  color: var(--text-p);
}
.form-select,
.form-input,
.form-textarea {
  width: 100%;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-card);
  background: var(--bg);
  color: var(--text-p);
  font-size: var(--t16);
  font-family: inherit;
  -webkit-appearance: none;
}
.form-select:focus,
.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--coral);
  box-shadow: 0 0 0 3px rgba(255, 111, 97, 0.15);
}
.form-textarea { resize: vertical; min-height: 140px; line-height: 1.6; }

.form-consent {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: var(--t14);
  color: var(--text-s);
  line-height: 1.5;
}
.form-consent input[type="checkbox"] {
  flex: 0 0 auto;
  margin-top: 2px;
  width: 18px;
  height: 18px;
  accent-color: var(--coral);
}

/* ── 약관 페이지 ── */
.terms-layout {
  display: flex;
  gap: 48px;
  max-width: var(--max);
  margin-inline: auto;
  padding: 48px var(--pad) 80px;
  align-items: flex-start;
}
@media (max-width: 1023px) {
  .terms-layout { padding: 40px 24px 64px; gap: 32px; }
}
@media (max-width: 767px) {
  .terms-layout { flex-direction: column; padding: 32px 20px 56px; gap: 0; }
}

/* Sticky TOC (desktop) */
.terms-toc {
  width: 220px;
  flex: 0 0 220px;
  position: sticky;
  top: calc(72px + 24px);
  max-height: calc(100vh - 72px - 48px);
  overflow-y: auto;
}
@media (max-width: 767px) {
  .terms-toc {
    position: static;
    width: 100%;
    flex: none;
    max-height: none;
    margin-bottom: 32px;
  }
}

.toc-title {
  font-size: var(--t14);
  font-weight: 700;
  color: var(--text-p);
  margin: 0 0 12px;
}
.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.toc-list li a {
  display: block;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: var(--t14);
  color: var(--text-s);
  text-decoration: none;
  line-height: 1.4;
}
.toc-list li a:hover { color: var(--text-p); background: var(--bg-input); }
.toc-list li a.active { color: var(--coral); font-weight: 700; }

/* 모바일 TOC 드롭다운 */
.toc-select {
  display: none;
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-card);
  background: var(--bg);
  color: var(--text-p);
  font-size: var(--t15);
  font-family: inherit;
  margin-bottom: 32px;
  -webkit-appearance: none;
}
@media (max-width: 767px) {
  .toc-list { display: none; }
  .toc-select { display: block; }
  .toc-title { display: none; }
}

.terms-body { flex: 1; min-width: 0; }

.terms-article {
  margin-bottom: 48px;
  scroll-margin-top: calc(72px + 24px);
}
.terms-article-title {
  font-size: var(--t20);
  font-weight: 700;
  color: var(--text-p);
  margin: 0 0 16px;
}
.terms-article p {
  font-size: var(--t16);
  line-height: 1.7;
  color: var(--text-s);
  margin: 0 0 12px;
}
.terms-article ul {
  padding-left: 1.2em;
  margin: 0 0 12px;
}
.terms-article ul li {
  font-size: var(--t16);
  line-height: 1.7;
  color: var(--text-s);
  margin-bottom: 6px;
}

/* 안내 박스 */
.note-box {
  padding: 16px 20px;
  border-radius: 10px;
  background: var(--bg-light);
  border: 1px solid var(--border);
  font-size: var(--t14);
  color: var(--text-s);
  line-height: 1.6;
  margin-top: 8px;
}

/* ── 서비스 소개 ── */
.about-wrap {
  max-width: var(--max);
  margin-inline: auto;
  padding: 48px var(--pad) 80px;
}
@media (max-width: 1023px) {
  .about-wrap { padding: 40px 24px 64px; }
}
@media (max-width: 767px) {
  .about-wrap { padding: 32px 20px 56px; }
}

.about-section {
  margin-bottom: 56px;
}
.about-section-title {
  font-size: var(--t24);
  font-weight: 700;
  color: var(--text-p);
  margin: 0 0 16px;
}
.about-section p {
  font-size: var(--t16);
  line-height: 1.7;
  color: var(--text-s);
  margin: 0 0 12px;
}
`;
