import { socialMeta } from './social-meta';
/**
 * 웨딩픽 랜딩 하위페이지 5종.
 *
 * 서비스 소개 / 자주 묻는 질문 / 고객지원 / 이용약관 / 개인정보처리방침.
 * 랜딩과 같은 GNB·Footer 공유. 1280px 고정폭.
 * 런타임 JS 없음 · 웹폰트 없음.
 */

import { BUSINESS, BUSINESS_NOTICE_LINES } from '@weddingpick/domain';

import { CONTACT_EMAIL } from './content';
import { faviconTags } from './landing-v4';

const C = '#FF6F61';
const INK = '#212124';
const SEC = '#4D5159';
const TER = '#868B94';
const FOOT_INK = '#3A2F30';
const HERO_TINT = '#FDF8F7';
const RECESSED = '#F7F8FA';
const BAND = '#F2F3F6';
const DIVIDER = '#EAEBEE';
const BORDER = '#DCDEE3';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pickMark(size: number, stroke: string): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${esc(stroke)}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z"></path><path d="M8.7 11.9l2.2 2.2 4.4-4.4"></path></svg>`;
}

const NAV = [
  { label: '서비스 소개', href: '/intro.html' },
  { label: '자주 묻는 질문', href: '/faq.html' },
  { label: '고객지원', href: '/support.html' },
];

function subGnb(activePath: string | null): string {
  const links = NAV.map((n) => {
    const active = n.href === activePath;
    return `<a href="${esc(n.href)}" class="sp-nav-link${active ? ' sp-nav-active' : ''}" style="color:${active ? INK : SEC};font-weight:${active ? 700 : 400}">${esc(n.label)}</a>`;
  }).join('');

  return `<header class="sp-gnb" style="border-bottom:1px solid ${esc(DIVIDER)}">
  <a href="/" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit;flex-shrink:0">
    <span style="color:${esc(C)};display:flex;line-height:0">${pickMark(22, C)}</span>
    <span style="font-size:19px;font-weight:700;color:${esc(INK)}">웨딩픽</span>
  </a>
  <input type="checkbox" id="sp-cb" class="sp-ham-cb" aria-hidden="true">
  <nav class="sp-nav">${links}</nav>
  <a href="/" class="sp-cta-btn" style="background:${esc(C)};color:#fff">앱 다운로드</a>
  <label for="sp-cb" class="sp-ham-btn" aria-label="메뉴 열기">
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M3 6h16M3 11h16M3 16h16" stroke="${esc(INK)}" stroke-width="1.8" stroke-linecap="round"/></svg>
  </label>
</header>`;
}

function subFooter(): string {
  const email = CONTACT_EMAIL
    ? `<a href="mailto:${esc(CONTACT_EMAIL)}" style="font-size:14px;color:rgba(255,255,255,.5);text-decoration:none">${esc(CONTACT_EMAIL)}</a>`
    : '';

  return `<footer class="sp-foot" style="background:${esc(FOOT_INK)}">
  <div class="sp-foot-top">
    <a href="/" style="display:flex;align-items:center;gap:8px;text-decoration:none;flex-shrink:0">
      <span style="color:${esc(C)};display:flex;line-height:0">${pickMark(20, C)}</span>
      <span style="font-size:17px;font-weight:700;color:#fff">웨딩픽</span>
    </a>
    <nav class="sp-foot-nav">
      ${NAV.map((n) => `<a href="${esc(n.href)}" style="font-size:14px;color:rgba(255,255,255,.6);text-decoration:none;white-space:nowrap">${esc(n.label)}</a>`).join('')}
    </nav>
    ${email}
  </div>
  <div class="sp-foot-biz">
    ${BUSINESS_NOTICE_LINES.map((line) => `<span style="font-size:13px;line-height:19px;color:rgba(255,255,255,.4)">${esc(line)}</span>`).join('')}
  </div>
  <div class="sp-foot-bot">
    <span style="font-size:13px;color:rgba(255,255,255,.4)">© 2026 ${esc(BUSINESS.name)}. All rights reserved.</span>
    <nav class="sp-foot-policy">
      <a href="/terms.html" style="font-size:13px;color:rgba(255,255,255,.5);text-decoration:none;white-space:nowrap">이용약관</a>
      <span style="font-size:13px;color:rgba(255,255,255,.2)">·</span>
      <a href="/privacy.html" style="font-size:13px;color:rgba(255,255,255,.5);text-decoration:none;white-space:nowrap">개인정보처리방침</a>
    </nav>
  </div>
</footer>`;
}

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

const BASE_STYLE = `
*,::before,::after{box-sizing:border-box}
html{font-family:${FONT_STACK};font-size:16px;-webkit-text-size-adjust:100%}
body{margin:0;background:#f7f8fa;color:${INK}}
a{color:inherit}
/* 풀 와이드. 랜딩(landing-v4.ts)의 .page와 같은 규칙을 쓴다. */
.page{width:100%;margin:0;background:#fff;display:flex;flex-direction:column;min-height:100vh;overflow-x:hidden}

/* GNB */
.sp-gnb{height:76px;flex:0 0 76px;display:flex;align-items:center;justify-content:space-between;padding:0 64px;position:relative;gap:32px}
.sp-nav{display:flex;align-items:center;gap:32px;flex:1;justify-content:center}
.sp-nav-link{font-size:16px;line-height:22px;text-decoration:none;white-space:nowrap}
.sp-ham-cb{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.sp-ham-btn{display:none;background:none;border:none;padding:8px;cursor:pointer;line-height:0;flex-shrink:0}
.sp-cta-btn{height:38px;padding:0 18px;border-radius:999px;display:inline-flex;align-items:center;font-size:15px;font-weight:700;text-decoration:none;white-space:nowrap;flex-shrink:0}

/* Title band */
.sp-titleband{padding:52px 64px 44px;border-bottom:1px solid ${DIVIDER}}
.sp-titleband h1{font-size:38px;line-height:52px;font-weight:700;color:${INK};letter-spacing:-1.2px;margin:0;white-space:pre-line}

/* Body */
.sp-body{padding:52px 64px 72px}

/* Footer */
.sp-foot{padding:0 64px}
.sp-foot-top{display:flex;align-items:center;justify-content:space-between;height:76px;border-bottom:1px solid rgba(255,255,255,.12);gap:24px}
.sp-foot-nav{display:flex;align-items:center;gap:24px;flex:1;justify-content:center}
.sp-foot-biz{display:flex;flex-direction:column;gap:4px;padding:20px 0 4px;border-top:1px solid rgba(255,255,255,.1)}
.sp-foot-bot{display:flex;align-items:center;justify-content:space-between;height:60px;gap:16px}
.sp-foot-policy{display:flex;align-items:center;gap:16px}

/* Legal layout */
.sp-legal{padding:56px 64px 72px;display:flex;gap:56px;align-items:flex-start}
.sp-toc{flex:0 0 200px;position:sticky;top:24px;display:flex;flex-direction:column;gap:0}
.sp-content{flex:1;min-width:0;display:flex;flex-direction:column;gap:40px}

/* Tablet */
@media(max-width:1023px){
  .sp-gnb{padding:0 32px}
  .sp-titleband{padding:40px 32px 36px}
  .sp-titleband h1{font-size:30px;line-height:42px}
  .sp-body{padding:40px 32px 56px}
  .sp-foot{padding:0 32px}
  .sp-legal{padding:40px 32px 56px}
}

/* Mobile */
@media(max-width:767px){
  .sp-gnb{padding:0 24px;height:64px;flex:0 0 64px;gap:0}
  .sp-nav{
    display:none;position:absolute;top:64px;left:0;right:0;
    flex-direction:column;align-items:flex-start;gap:0;flex:none;justify-content:flex-start;
    background:#fff;border-top:1px solid ${DIVIDER};
    box-shadow:0 8px 24px rgba(58,47,48,.12);z-index:99
  }
  .sp-nav-link{display:block;padding:16px 24px;width:100%;border-bottom:1px solid #f0f1f3}
  .sp-ham-cb:checked~.sp-nav{display:flex}
  .sp-ham-btn{display:flex;margin-left:auto;margin-right:8px}
  .sp-cta-btn{font-size:14px !important;height:36px;padding:0 14px}
  .sp-titleband{padding:28px 24px 24px}
  .sp-titleband h1{font-size:26px;line-height:36px}
  .sp-body{padding:28px 24px 48px}
  .sp-foot{padding:0 24px}
  .sp-foot-top{height:auto;padding:20px 0;flex-direction:column;align-items:flex-start;gap:12px}
  .sp-foot-nav{flex-direction:column;align-items:flex-start;gap:8px;flex:none;justify-content:flex-start}
  .sp-foot-bot{height:auto;padding:16px 0;flex-direction:column;align-items:flex-start;gap:8px}
  .sp-legal{padding:24px 24px 48px;flex-direction:column;gap:32px}
  .sp-toc{display:none}
  .sp-content{flex:none;width:100%}
}

/* Small mobile */
@media(max-width:479px){
  .sp-titleband h1{font-size:22px;line-height:32px}
}
`.trim();

function subDocument(opts: {
  path: string;
  title: string;
  description: string;
  activePath: string | null;
  titleBand: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(opts.title)} — 웨딩픽</title>
<meta name="description" content="${esc(opts.description)}">
${socialMeta(opts.path, opts.title + " — 웨딩픽", opts.description)}
${faviconTags()}
<style>${BASE_STYLE}</style>
</head>
<body>
<div class="page">
  ${subGnb(opts.activePath)}
  ${opts.titleBand}
  <main style="flex:1">
    ${opts.body}
  </main>
  ${subFooter()}
</div>
</body>
</html>
`;
}

function titleBand(crumb: string, h1: string, h1sub?: string): string {
  return `<div class="sp-titleband">
  <p style="font-size:14px;line-height:19px;color:${esc(TER)};margin:0 0 16px">${esc(crumb)}</p>
  <h1>${esc(h1)}</h1>
  ${h1sub ? `<p style="font-size:17px;line-height:27px;color:${esc(SEC)};margin:4px 0 0;max-width:700px">${esc(h1sub)}</p>` : ''}
</div>`;
}

/* ───────── 1. 서비스 소개 ───────── */

function introCards(title: string, lead: string, items: { eyebrow?: string; title: string; body?: string; brand?: boolean }[]): string {
  const cardStyle = (brand: boolean) =>
    `border-radius:12px;padding:26px 24px;display:flex;flex-direction:column;gap:8px;${brand ? `box-shadow:inset 0 0 0 1.5px ${C};background:${HERO_TINT}` : `background:${RECESSED}`}`;

  const cards = items.map((c) => `
    <div style="${cardStyle(!!c.brand)}">
      ${c.eyebrow ? `<span style="font-size:13px;font-weight:700;color:${esc(C)}">${esc(c.eyebrow)}</span>` : ''}
      <span style="font-size:18px;font-weight:700;color:${esc(INK)}">${esc(c.title)}</span>
      ${c.body ? `<span style="font-size:15px;line-height:24px;color:${esc(SEC)}">${esc(c.body)}</span>` : ''}
    </div>`).join('');

  return `<section style="padding:40px 0;display:flex;flex-direction:column;gap:16px">
    ${title ? `<h2 style="font-size:24px;line-height:32px;font-weight:700;color:${esc(INK)};margin:0">${esc(title)}</h2>` : ''}
    ${lead ? `<p style="font-size:16px;line-height:26px;color:${esc(SEC)};margin:0">${esc(lead)}</p>` : ''}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">${cards}</div>
  </section>`;
}

function introSteps(title: string, steps: { no: string; title: string; body: string; meta: string }[]): string {
  const rows = steps.map((s) => `
    <div style="display:flex;gap:20px;align-items:flex-start">
      <span style="width:28px;height:28px;border-radius:999px;background:${esc(C)};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;margin-top:2px;font-variant-numeric:tabular-nums">${esc(s.no)}</span>
      <span style="flex:1;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:18px;font-weight:700;color:${esc(INK)}">${esc(s.title)}</span>
        <span style="font-size:15px;line-height:24px;color:${esc(SEC)}">${esc(s.body)}</span>
      </span>
      <span style="font-size:13px;font-weight:700;color:${esc(TER)};white-space:nowrap;padding-top:4px">${esc(s.meta)}</span>
    </div>`).join('');

  return `<section style="padding:40px 0;display:flex;flex-direction:column;gap:16px">
    <h2 style="font-size:24px;line-height:32px;font-weight:700;color:${esc(INK)};margin:0">${esc(title)}</h2>
    <div style="display:flex;flex-direction:column;gap:16px">${rows}</div>
  </section>`;
}

export function renderIntroPage(): string {
  const body = `<div class="sp-body" style="padding-top:0;display:flex;flex-direction:column;gap:0">
    <div style="height:1px;background:${esc(DIVIDER)};margin-bottom:0"></div>
    ${introSteps('이렇게 씁니다', [
      { no: '1', title: '예식일과 지역을 알려주세요', body: '남은 기간에 맞춰 지금 정할 것부터 순서대로 챙겨드려요.', meta: '30초' },
      { no: '2', title: '나에게 맞는 3곳을 확인해요', body: '고른 사진과 예산, 날짜를 보고 웨딩픽이 먼저 골라둡니다.', meta: '홈' },
      { no: '3', title: '금액부터 포함 항목까지 한눈에 비교해요', body: '제보 금액, 포함 항목, 별도로 확인할 비용을 한 화면에서 봐요.', meta: '비교' },
      { no: '4', title: '둘이 같이 골라요', body: '각자 Pick하고 겹치는 곳부터 좁혀나가요. 고르면 웨딩일정에 바로 반영돼요.', meta: 'Pick' },
    ])}
    <div style="height:1px;background:${esc(DIVIDER)}"></div>
    ${introCards('확인된 제보란', '직접 등록해 주신 자료를 바탕으로 구성한 금액 정보예요. 개인 정보 보호를 위해 개별 금액 대신 금액 구간과 건수로 안내해 드려요.', [
      { eyebrow: '0~2건', title: '정보 수집 중', body: '기준 제보가 모이면 공개돼요' },
      { eyebrow: '3~9건', title: '금액 구간 안내', body: '모인 제보에 맞춰 금액 구간을 보여드려요' },
      { eyebrow: '10건 이상', title: '기준금액 안내', body: '제보 금액의 기준금액도 알려드려요', brand: true },
    ])}
    <div style="height:1px;background:${esc(DIVIDER)}"></div>
    ${introCards('웨딩픽의 약속', '', [
      { title: '객관적인 정보 제공', body: '조건과 금액을 있는 그대로 전달해 두 분의 합리적인 선택을 도와요.' },
      { title: '공정한 순위 노출', body: '광고 여부에 상관없이 확인된 제보를 기준으로 추천과 검색 순위를 제공해요.' },
      { title: '투명한 후기 운영', body: '업체 반론권을 보장하면서도 작성된 후기는 투명하게 유지해요.' },
    ])}
  </div>`;

  return subDocument({
    path: "/intro.html",
    title: '서비스 소개',
    description: '웨딩픽이 먼저 골라주고 사용자는 비교해서 Pick하는 서비스예요.',
    activePath: '/intro.html',
    titleBand: titleBand('홈 · 서비스 소개', '다른 사람들은\n얼마에 했는지 확인해보세요', '예식일과 예산에 맞는 곳은 웨딩픽이 먼저 골라드려요. 두 분은 비교하고 Pick하면 돼요.'),
    body,
  });
}

/* ───────── 2. 자주 묻는 질문 ───────── */

const FAQ_CATEGORIES = [
  { title: '확인된 제보', count: 6 },
  { title: 'Pick과 비교', count: 5 },
  { title: '배우자 연결', count: 4 },
  { title: 'Pick 인증', count: 5 },
  { title: '후기', count: 4 },
  { title: '계정과 탈퇴', count: 3 },
];

const FAQ_ROWS = [
  { q: '확인된 제보는 어떻게 만들어요?', a: '직접 올려준 자료를 확인해 만들어요. 개인정보를 분리하고 금액 구간과 건수로 보여드려요.' },
  { q: '회원가입 없이 사용할 수 있나요?', a: '확인된 제보는 로그인 없이 볼 수 있어요. Pick, 웨딩일정, Pick 인증은 가입 후 이용하세요.' },
  { q: 'Pick 인증은 어떻게 하나요?', a: '금액이 보이는 화면을 올리면 웨딩픽이 자동으로 확인해요. 원본 이미지는 24시간 안에 삭제돼요.' },
  { q: '광고하면 추천에 더 많이 나오나요?', a: '아니요. 광고는 추천·검색 순위와 완전히 분리되어 있어요. 광고 영역은 별도로 표시해요.' },
  { q: '배우자는 어떻게 연결하나요?', a: '초대 링크를 보내면 24시간 안에 연결할 수 있어요. 각자 Pick한 곳이 하나로 모여요.' },
  { q: '탈퇴하면 후기도 삭제되나요?', a: '계정과 개인정보는 삭제돼요. 작성한 후기는 작성자 정보를 분리한 뒤 유지될 수 있어요.' },
];

export function renderFaqPage(): string {
  const catGrid = FAQ_CATEGORIES.map((c) => `
    <div style="background:${RECESSED};border-radius:12px;padding:20px 18px;display:flex;flex-direction:column;gap:4px">
      <span style="font-size:16px;font-weight:700;color:${INK}">${esc(c.title)}</span>
      <span style="font-size:14px;color:${TER}">${c.count}개</span>
    </div>`).join('');

  const faqRows = FAQ_ROWS.map((r, i) => `
    <div style="border-top:1px solid ${DIVIDER};padding:20px 0${i === FAQ_ROWS.length - 1 ? ';border-bottom:1px solid ' + DIVIDER : ''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
        <div style="flex:1;display:flex;flex-direction:column;gap:8px">
          <span style="font-size:16px;font-weight:700;color:${INK}">${esc(r.q)}</span>
          <span style="font-size:15px;line-height:24px;color:${SEC}">${esc(r.a)}</span>
        </div>
      </div>
    </div>`).join('');

  const note = `<div style="background:${RECESSED};border-radius:12px;padding:24px;display:flex;flex-direction:column;gap:4px">
    <span style="font-size:16px;font-weight:700;color:${INK}">찾는 답이 없나요?</span>
    <span style="font-size:15px;line-height:24px;color:${SEC}">고객센터로 문의를 남겨주시면 친절히 안내해 드릴게요.
    <a href="/support.html" style="color:${C};font-weight:700;text-decoration:none;margin-left:8px">문의 남기기</a></span>
  </div>`;

  const body = `<div class="sp-body" style="display:flex;flex-direction:column;gap:40px">
    <section style="display:flex;flex-direction:column;gap:16px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">${catGrid}</div>
    </section>
    <section style="display:flex;flex-direction:column;gap:0">
      <h2 style="font-size:24px;line-height:32px;font-weight:700;color:${INK};margin:0 0 20px">많이 보는 질문</h2>
      ${faqRows}
    </section>
    ${note}
  </div>`;

  return subDocument({
    path: "/faq.html",
    title: '자주 묻는 질문',
    description: '웨딩픽 서비스에 대해 자주 묻는 질문과 답변을 확인하세요.',
    activePath: '/faq.html',
    titleBand: titleBand('홈 · 자주 묻는 질문', '무엇이 궁금하세요?'),
    body,
  });
}

/* ───────── 3. 고객지원 ───────── */

const SUPPORT_CARDS = [
  { eyebrow: '가장 빠른 방법', title: '자주 묻는 질문', body: '27개 질문에 답을 정리해뒀어요', brand: true, href: '/faq.html' },
  { title: '문의 남기기', body: '하루 안에 답변드려요', href: '#contact-form' },
  { title: '신고 · 분쟁', body: '후기 신고와 처리 결과를 확인해요', href: '#contact-form' },
];

const SUPPORT_ROWS = [
  { k: 'Pick 인증이 안 됐어요', desc: '이미 등록된 자료이거나 금액을 확인하기 어려울 수 있어요' },
  { k: '배우자 연결이 안 돼요', desc: '초대 코드는 발급 후 24시간 동안만 쓸 수 있어요' },
  { k: '업체 정보가 틀렸어요', desc: '업체 상세 하단에서 바로 제보할 수 있어요' },
  { k: '알림이 오지 않아요', desc: '기기 설정에서 웨딩픽 알림이 켜져 있는지 확인해주세요' },
  { k: '리워드가 아직 안 들어왔어요', desc: '확인하는 데 최대 하루 걸릴 수 있어요' },
];

export function renderSupportPage(): string {
  const quickCards = SUPPORT_CARDS.map((c) => {
    const cardStyle = c.brand
      ? `box-shadow:inset 0 0 0 1.5px ${C};background:${HERO_TINT}`
      : `background:${RECESSED}`;
    return `<a href="${esc(c.href || '#')}" style="${cardStyle};border-radius:12px;padding:26px 24px;display:flex;flex-direction:column;gap:8px;text-decoration:none">
      ${c.eyebrow ? `<span style="font-size:13px;font-weight:700;color:${C}">${esc(c.eyebrow)}</span>` : ''}
      <span style="font-size:18px;font-weight:700;color:${INK}">${esc(c.title)}</span>
      <span style="font-size:15px;line-height:24px;color:${SEC}">${esc(c.body)}</span>
    </a>`;
  }).join('');

  const quickRows = SUPPORT_ROWS.map((r, i) => `
    <a href="#contact-form" style="display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:56px;padding:0;border-top:1px solid ${DIVIDER}${i === SUPPORT_ROWS.length - 1 ? ';border-bottom:1px solid ' + DIVIDER : ''};text-decoration:none">
      <span style="display:flex;flex-direction:column;gap:2px">
        <span style="font-size:16px;font-weight:700;color:${INK}">${esc(r.k)}</span>
        <span style="font-size:14px;line-height:19px;color:${TER}">${esc(r.desc)}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${TER}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"></path></svg>
    </a>`).join('');

  const CATEGORIES = ['일반', 'Pick 인증', '배우자 연결', '업체 정보', '계정', '기타'];
  const categoryOptions = CATEGORIES.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  const contactForm = `<section id="contact-form" style="display:flex;flex-direction:column;gap:16px">
    <h2 style="font-size:24px;line-height:32px;font-weight:700;color:${INK};margin:0">문의 남기기</h2>
    <form action="mailto:${esc(CONTACT_EMAIL || 'help.weddingpick@gmail.com')}" method="get" style="display:flex;flex-direction:column;gap:16px">
      <label style="display:flex;flex-direction:column;gap:6px">
        <span style="font-size:14px;font-weight:700;color:${SEC}">문의 유형</span>
        <select name="subject" style="height:52px;border-radius:8px;box-shadow:inset 0 0 0 1px ${BORDER};padding:0 14px;font-size:16px;color:${INK};background:#fff;border:none;-webkit-appearance:none;cursor:pointer">
          <option value="" disabled selected>유형을 골라주세요</option>
          ${categoryOptions}
        </select>
      </label>
      <label style="display:flex;flex-direction:column;gap:6px">
        <span style="font-size:14px;font-weight:700;color:${SEC}">이메일</span>
        <input type="email" name="email" placeholder="답변받을 메일 주소" style="height:52px;border-radius:8px;box-shadow:inset 0 0 0 1px ${BORDER};padding:0 14px;font-size:16px;color:${INK};background:#fff;border:none;outline:none;font-family:inherit">
      </label>
      <label style="display:flex;flex-direction:column;gap:6px">
        <span style="font-size:14px;font-weight:700;color:${SEC}">문의 내용</span>
        <textarea name="body" placeholder="어떤 점이 불편하셨나요?" rows="5" style="border-radius:8px;box-shadow:inset 0 0 0 1px ${BORDER};padding:14px;font-size:16px;color:${INK};background:#fff;border:none;outline:none;resize:vertical;font-family:inherit;min-height:120px"></textarea>
      </label>
      <button type="submit" style="height:52px;border-radius:10px;background:${C};color:#fff;font-size:16px;font-weight:700;border:none;cursor:pointer;font-family:inherit">문의 보내기</button>
    </form>
    <div style="background:${RECESSED};border-radius:10px;padding:16px 18px">
      <span style="font-size:14px;line-height:22px;color:${TER}">평일 오전 10시부터 오후 6시까지 답변드리고, 주말과 공휴일에 남긴 문의는 다음 영업일에 처리해요.</span>
    </div>
  </section>`;

  const body = `<div class="sp-body" style="display:flex;flex-direction:column;gap:40px">
    <section style="display:flex;flex-direction:column;gap:16px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">${quickCards}</div>
    </section>
    <section style="display:flex;flex-direction:column;gap:12px">
      <h2 style="font-size:24px;line-height:32px;font-weight:700;color:${INK};margin:0">자주 찾는 항목</h2>
      ${quickRows}
    </section>
    ${contactForm}
  </div>`;

  return subDocument({
    path: "/support.html",
    title: '고객지원',
    description: '웨딩픽 서비스 이용 중 불편한 점이 있으시면 고객센터로 문의해주세요.',
    activePath: '/support.html',
    titleBand: titleBand('홈 · 고객지원', '무엇을 도와드릴까요?'),
    body,
  });
}

/* ───────── 4. 이용약관 ───────── */

interface TermsArticle { t: string; l: string[] }

const TERMS_ARTICLES: TermsArticle[] = [
  { t: '제1조 목적', l: [`이 약관은 ${BUSINESS.name}(이하 '회사')이 제공하는 ${BUSINESS.serviceName} 서비스의 이용조건, 회사와 회원의 권리·의무, 서비스 운영 및 분쟁 처리 기준을 정하는 것을 목적으로 합니다.`] },
  { t: '제2조 정의', l: ["'서비스'란 회사가 모바일 애플리케이션과 웹을 통해 제공하는 웨딩업체 정보 검색, Pick, 비교, 일정·지출 관리, 배우자 연결, 후기, 제보 금액 정보, 알림 및 이벤트 기능을 말합니다.", "'회원'이란 소셜 인증, 연령 확인 및 필수 약관 동의를 마치고 계정이 활성화된 이용자를 말합니다.", "'Pick 인증 자료'란 회원이 실제 이용금액 확인을 위해 제출하는 영수증, 결제내역, 결제문자, 계좌이체 또는 간편결제 내역 등을 말합니다.", "'확인된 제보'란 제출 자료에서 필요한 항목을 추출·검증하고 작성자 정보와 분리해 제공하는 금액·품목·이용일·조건 등의 정보를 말합니다.", "'업체'란 서비스에 표시되는 웨딩홀, 스튜디오, 드레스, 메이크업 등 웨딩 관련 사업자를 말합니다. 서비스 노출만으로 제휴관계가 성립하지 않습니다."] },
  { t: '제3조 약관의 게시와 변경', l: ["회사는 회원이 약관을 쉽게 확인할 수 있도록 서비스 내에 게시합니다. 약관을 변경할 때에는 변경 내용, 사유 및 시행일을 관계 법령과 변경의 중대성에 맞는 기간 전에 알립니다. 회원에게 불리하거나 별도 동의가 필요한 변경은 필요한 절차를 거칩니다."] },
  { t: '제4조 이용계약과 가입', l: ["회원가입은 소셜 인증, 만 14세 이상 확인, 필수 약관 동의 및 회사의 가입 승인으로 성립합니다.", "소셜 인증에 성공했더라도 필수 동의가 완료되지 않으면 계정을 활성화하지 않습니다.", "회사는 타인의 정보 도용, 허위정보 입력, 반복적인 부정 가입 또는 기술상 현저한 장애가 있는 경우 가입을 거절하거나 보류할 수 있으며 가능한 범위에서 사유를 안내합니다.", "한 회원은 여러 소셜 계정을 연결할 수 있습니다. 이메일이 같다는 이유만으로 계정을 자동 병합하지 않으며, 기존 계정 재인증 등 본인 확인을 거칩니다."] },
  { t: '제5조 계정 관리', l: ["회원은 자신의 계정과 인증수단을 안전하게 관리해야 하며, 도용이나 무단사용을 알게 되면 지체 없이 회사에 알려야 합니다. 회사는 소셜 제공자가 요구하는 연결 해제 또는 토큰 폐기 절차를 지원합니다."] },
  { t: '제6조 서비스의 내용', l: ["업체 정보 검색·비교와 Pick", "웨딩 준비 일정·지출 관리 및 배우자 연결", "후기 작성·열람과 업체의 정정·반론 절차", "Pick 인증 자료를 통한 제보 금액 정보 제공", "알림, 이벤트, 광고·스폰서 영역 및 그 밖에 회사가 정하는 기능", "회사는 중개·예약·결제 당사자가 아닌 정보 제공 서비스입니다. 다만 향후 상담·견적·예약 기능을 제공하는 경우 해당 기능의 역할과 책임, 개인정보 제공 기준을 별도로 고지합니다."] },
  { t: '제7조 Pick 인증 자료', l: ["회원은 자신이 적법하게 보유하고 제출할 권한이 있는 자료만 제출해야 합니다.", "회사는 통계 작성에 필요한 업체명, 금액, 이용일, 품목·옵션 등 최소 항목만 이용하고 불필요한 금융정보와 제3자 정보는 가림 또는 삭제합니다.", "원본 이미지는 업로드 완료 시점부터 최대 24시간 이내 삭제합니다. 기한 안에 검증이 끝나지 않으면 연장 보관하지 않고 재제출 또는 별도 확인으로 전환할 수 있습니다.", "삭제 후에도 자료 식별자, 삭제 예정·완료 시각, 결과 코드 등 최소한의 감사기록은 별도로 정한 기간 동안 보관할 수 있습니다.", "회사는 중복·조작·오매칭 가능성을 검토할 수 있으나 이미지 지문이나 자동 점수만으로 부정행위를 확정하지 않습니다."] },
  { t: '제8조 확인된 제보의 이용', l: ["회원은 회사가 제출 자료에서 개인정보와 작성자 정보를 분리한 확인된 제보를 서비스 제공, 통계 작성, 품질 개선 및 오류·분쟁 대응에 필요한 범위에서 이용하는 데 동의합니다. 회사는 필요한 범위를 넘는 영구적 권리를 일괄 취득하지 않으며, 원본 자료 자체를 공개하지 않습니다."] },
  { t: '제9조 가격정보와 통계', l: ["제보 금액은 실제 제출 사례의 범위와 중앙값 등 통계정보이며 업체의 공식 견적이나 판매가격을 보장하지 않습니다.", "최근 12개월을 기본 구간으로 하되 카테고리 변동성, 계절, 평일·주말, 시간대, 보증인원 및 옵션을 반영할 수 있습니다.", "조건별 정보가 부족하거나 재식별 가능성이 있으면 세부정보를 묶거나 공개하지 않습니다.", "패키지 금액은 항목별 금액이 확인되지 않으면 개별 서비스 가격으로 임의 안분하지 않습니다."] },
  { t: '제10조 후기와 회원 콘텐츠', l: ["회원은 타인의 권리를 침해하지 않는 범위에서 후기와 콘텐츠를 작성할 수 있습니다. 회사는 서비스 표시·운영·백업·신고 처리에 필요한 비독점적 이용권을 보유하되 목적과 기간을 필요한 범위로 제한합니다. 위법, 명예훼손, 개인정보 노출, 광고·도배 또는 무관한 콘텐츠는 기준에 따라 임시 비공개하거나 제한할 수 있고 작성자에게 소명 기회를 제공합니다."] },
  { t: '제11조 배우자 연결', l: ["배우자 연결은 상대방의 명시적 수락으로 성립합니다. 공유 범위는 화면에 표시하며 연결 해제 시 이후 공유를 중단합니다. 각 회원은 본인이 작성한 정보에 대한 권리를 유지합니다."] },
  { t: '제12조 광고와 추천', l: ["회사는 광고·스폰서 영역을 자연 검색·추천과 구분해 표시합니다. 광고비와 제휴 여부는 제보 금액, 후기, 검증 결과 및 비광고 순위에 영향을 주지 않습니다."] },
  { t: '제13조 이벤트와 보상', l: ["이벤트별 기간, 참여조건, 인원, 보상, 예산, 지급절차, 제한사항은 별도 안내합니다.", "보상은 검증과 지급조건 확인 후 지급합니다. 취소·환불·중복·도용이 확인되면 지급을 보류하거나 합리적인 범위에서 회수할 수 있습니다.", "정상적인 마케팅 수신 거부만을 이유로 서비스 이용을 제한하지 않습니다. 이벤트 참여에 별도 개인정보 제공이 필요한 경우 이벤트 화면에서 따로 안내합니다.", "지급 실패 시 재시도하거나 수령정보 확인을 요청할 수 있으며, 장기·반복 지급을 보장하지 않습니다."] },
  { t: '제14조 금지행위', l: ["타인의 계정·자료·개인정보 도용", "이미지·금액·일자·업체 정보의 위조 또는 고의적 왜곡", "동일 자료의 반복 제출, 다계정 악용 또는 보상 목적의 취소 은폐", "서비스의 보안·운영을 방해하는 행위", "타인의 권리, 명예, 영업비밀 또는 저작권을 침해하는 행위", "법령 또는 공서양속에 반하는 행위"] },
  { t: '제15조 이용제한과 이의제기', l: ["회사는 위반의 내용과 정도에 따라 경고, 해당 콘텐츠·통계 반영 보류, 기능 제한, 일시정지 또는 계약 해지를 할 수 있습니다. 긴급한 개인정보 노출이나 보안사고를 제외하고 가능한 범위에서 사유와 기간을 알리고 소명·이의제기 방법을 제공합니다. 자동화된 탐지 결과만으로 영구 정지하지 않습니다."] },
  { t: '제16조 업체의 정정·이의제기', l: ["업체는 정보 오류, 오매칭, 권리침해 또는 통계 오류를 신고할 수 있습니다. 회사는 제휴 여부와 무관하게 접수하고 필요한 경우 임시 비공개한 뒤 제출 자료와 검증 이력을 검토합니다. 단순 삭제 요청을 자동 기각하지 않으며 유지·수정·통계 제외·비공개 결과와 사유를 기록합니다."] },
  { t: '제17조 서비스 변경·중단', l: ["회사는 운영·보안·기술·법령상 필요에 따라 서비스 일부를 변경하거나 중단할 수 있습니다. 회원에게 중대한 영향이 있으면 사전에 알리며, 긴급 장애·보안사고 등 사전 고지가 어려운 경우 사후에 알릴 수 있습니다."] },
  { t: '제18조 회원탈퇴', l: ["회원은 서비스 내 탈퇴 기능을 이용할 수 있으며 탈퇴하면 계정과 개인화 정보는 삭제되고 되돌릴 수 없습니다.", "후기와 확인된 제보는 작성자 정보와 분리해 유지될 수 있습니다. 화면에는 해당 항목과 개수를 구체적으로 표시합니다.", "법령상 보관이 필요한 정보는 해당 기간 동안 다른 정보와 분리해 보관하고 목적이 끝나면 삭제합니다.", "연결된 소셜 계정은 제공자 정책에 따른 연결 해제 또는 토큰 폐기 절차를 수행합니다."] },
  { t: '제19조 회사의 책임', l: ["회사는 고의 또는 과실로 회원에게 손해를 발생시킨 경우 관계 법령에 따라 책임을 부담합니다. 회사가 통제할 수 없는 천재지변, 통신망 장애, 회원의 귀책사유로 발생한 손해에는 책임이 제한될 수 있습니다. 이 조항은 회사의 고의·중과실 책임이나 법령상 배제할 수 없는 책임을 면제하지 않습니다."] },
  { t: '제20조 분쟁 처리', l: ["회원은 서비스 내 고객센터를 통해 문의와 이의제기를 할 수 있습니다. 회사와 회원은 분쟁 해결을 위해 성실히 협의하며, 해결되지 않는 경우 대한민국 법령과 민사소송법상 관할법원에 따릅니다."] },
  { t: '제21조 사업자 정보', l: [`상호: ${BUSINESS.name}`, `대표자: ${BUSINESS.representative}`, `사업자등록번호: ${BUSINESS.registrationNumber}`, `업태·종목: ${BUSINESS.businessType} · ${BUSINESS.businessItem}`, `문의: ${CONTACT_EMAIL ?? 'help.weddingpick@gmail.com'}`] },
];

function legalDocument(articles: TermsArticle[]): string {
  const toc = articles.map((a, i) => `
    <a href="#article-${i}" style="display:block;font-size:15px;line-height:23px;padding:6px 0;color:${TER};text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${esc(a.t)}</a>`).join('');

  const content = articles.map((a, i) => {
    const clauses = a.l.map((text, ci) => `
      <div style="display:flex;gap:12px;align-items:flex-start">
        <span style="width:22px;height:22px;flex:0 0 22px;border-radius:6px;background:${BAND};color:${TER};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums">${ci + 1}</span>
        <span style="flex:1;font-size:16px;line-height:27px;color:${SEC}">${esc(text)}</span>
      </div>`).join('');

    return `<section id="article-${i}" style="display:flex;flex-direction:column;gap:12px">
      <h2 style="font-size:19px;line-height:26px;font-weight:700;color:${INK};margin:0">${esc(a.t)}</h2>
      <div style="display:flex;flex-direction:column;gap:8px">${clauses}</div>
    </section>`;
  }).join('');

  return `<div class="sp-legal">
    <aside class="sp-toc">${toc}</aside>
    <div class="sp-content">${content}</div>
  </div>`;
}

export function renderTermsPage(): string {
  return subDocument({
    path: "/terms.html",
    title: '이용약관',
    description: '웨딩픽 서비스 이용약관을 확인하세요.',
    activePath: null,
    titleBand: titleBand('홈 · 이용약관', '웨딩픽 서비스 이용약관', '시행일 2026년 9월 1일'),
    body: legalDocument(TERMS_ARTICLES),
  });
}

/* ───────── 5. 개인정보처리방침 ───────── */

interface PrivacySection {
  t: string;
  l?: string[];
  table?: boolean;
  cols?: { label: string; w: string }[];
  rows?: string[][];
  lead?: string;
}

const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    t: '1. 개인정보 처리 목적·항목·보유기간',
    table: true,
    cols: [{ label: '목적', w: '150px' }, { label: '처리 항목', w: 'auto' }, { label: '보유기간', w: '230px' }],
    rows: [
      ['회원가입·계정', '소셜 제공자, 제공자별 회원 식별자, 필수 동의 이력, 만 14세 이상 확인 결과, 가입·활성화 일시', '탈퇴 시까지. 법정 보관 또는 분쟁처리가 필요한 경우 해당 기간'],
      ['소셜 프로필 기본값', '제공자가 이용자 동의에 따라 전달한 이름, 이메일, 별명, 프로필 사진, 전화번호, 생년 관련 정보 중 실제 설정한 항목', '계정 연결 해제, 직접 삭제 또는 탈퇴 시까지. 원본 응답 전체는 장기 보관하지 않음'],
      ['웨딩 준비 관리', '예식 예정일, 준비 단계, Pick한 곳, 일정, 지출, 선택한 취향·조건', '직접 삭제 또는 탈퇴 시까지'],
      ['배우자 연결', '초대·연결 식별자, 연결 상태, 공유 범위와 변경 이력', '연결 해제 또는 탈퇴 시까지'],
      ['Pick 인증', '업체명, 금액, 이용일, 품목·옵션, 자료 유형, 검증 결과, 중복·오류 확인값', '구조화 정보는 통계·분쟁처리 목적 기간. 원본 이미지는 업로드 완료부터 최대 24시간'],
      ['후기·문의·신고', '작성 내용, 첨부자료, 처리상태, 계정 식별자, 답변 이력', '게시·처리 목적 달성 또는 탈퇴 시까지. 작성자와 분리된 후기는 유지될 수 있음'],
      ['이벤트·보상', '이벤트 참여 이력, 지급상태, 수령에 필요한 이름·휴대전화번호 등 별도 안내 항목', '이벤트 종료·정산·분쟁처리 목적 달성 시까지 또는 법정 보관기간'],
      ['서비스 보안·운영', '접속일시, IP, 기기·앱 정보, 오류·보안 로그, 요청 식별자', '서비스 운영과 보안에 필요한 기간. 법정 근거가 있는 경우 해당 기간'],
    ],
    lead: '선택정보를 제공하지 않아도 해당 선택 기능을 제외한 기본 서비스를 이용할 수 있습니다. 소셜 제공자가 항목을 전달하지 않으면 필요한 경우에만 추가 입력을 요청합니다.',
  },
  { t: '2. Pick 인증 원본의 처리', l: ["원본 이미지는 업로드 완료 시점부터 최대 24시간 이내 삭제합니다.", "카드번호, 승인번호, 계좌번호, 제3자 성명·연락처 등 통계에 불필요한 정보는 기기와 서버 단계에서 가림 또는 삭제합니다.", "기기 내 가림만으로 안전을 보장하지 않으며 서버 수신 후에도 재검사합니다.", "24시간 안에 검증이 끝나지 않으면 원본을 연장 보관하지 않고 재제출 또는 별도 확인으로 전환합니다.", "삭제 기록에는 자료 식별자, 예정·완료 시각, 결과 코드, 재시도 횟수만 보관하며 원본 경로나 개인정보가 포함된 추출 원문을 남기지 않습니다."] },
  { t: '3. 개인정보의 제3자 제공', l: ["회사는 정보주체의 동의 또는 법령상 근거가 있는 경우에만 개인정보를 제3자에게 제공합니다. 업체 상담·견적·예약 기능이나 보상 발송을 위해 제공이 필요한 경우 제공받는 자, 목적, 항목, 보유기간, 동의 거부권을 해당 기능 사용 전에 별도로 알립니다."] },
  {
    t: '4. 개인정보 처리위탁',
    table: true,
    cols: [{ label: '업무', w: '150px' }, { label: '위탁 내용', w: 'auto' }, { label: '수탁자·보유기준', w: '260px' }],
    rows: [
      ['클라우드·객체 저장', '서비스 정보 및 Pick 인증 원본의 시한부 저장', '수탁자가 정해지는 경우 서비스 내 처리방침에 공개'],
      ['문자인식·영상 분석', 'Pick 인증 자료에서 필요한 항목 추출·가림·검증', '수탁자가 정해지는 경우 서비스 내 처리방침에 공개'],
      ['인증', '카카오·네이버·구글·애플 소셜 인증', '각 제공자의 개인정보처리방침 및 이용자 선택에 따름'],
      ['알림·메시지', '푸시·전자우편·문자·알림톡 발송', '수탁자가 정해지는 경우 서비스 내 처리방침에 공개'],
      ['보상 발송', '이벤트 보상 지급과 실패 처리', '수탁자가 정해지는 경우 서비스 내 처리방침에 공개'],
    ],
    lead: '회사는 수탁자와 문서로 위탁계약을 체결하고 목적 외 처리 금지, 안전조치, 재위탁, 사고 통지 및 삭제 여부를 관리·감독합니다.',
  },
  { t: '5. 개인정보의 국외 이전', l: ["해외 리전 또는 해외 사업자가 개인정보를 처리하는 경우 이전 국가, 받는 자, 목적, 항목, 시기·방법, 보유기간 및 이전 거부 방법을 공개합니다. 국외 이전이 발생하는 경우 이전 국가, 이전받는 자, 목적, 항목, 시기·방법, 보유기간과 거부 방법을 서비스 내 개인정보처리방침에 공개합니다."] },
  { t: '6. 개인정보의 파기', l: ["보유기간이 지나거나 목적을 달성하면 지체 없이 파기합니다.", "전자파일은 복구하기 어려운 방법으로 삭제하고 종이문서는 분쇄 또는 소각합니다.", "법령에 따라 보관할 정보는 다른 정보와 분리하고 정해진 목적 외에는 이용하지 않습니다.", "원본 이미지 삭제 범위에는 주 저장소, 복제본, 임시파일, 기기 임시저장 및 외부 처리업체 사본을 포함합니다."] },
  { t: '7. 정보주체의 권리와 행사방법', l: ["이용자는 개인정보 열람, 정정·삭제, 처리정지, 동의철회 및 계정탈퇴를 요청할 수 있습니다.", "앱 설정 또는 서비스 내 고객센터를 통해 요청할 수 있으며 회사는 본인 확인 후 관계 법령에 따라 처리합니다.", "마케팅 동의는 채널별로 언제든 변경하거나 철회할 수 있습니다.", "자동 탐지 또는 점수로 기능이 제한된 경우 사유 설명과 이의제기를 요청할 수 있습니다."] },
  { t: '8. 만 14세 미만 아동', l: ["웨딩픽은 만 14세 미만의 회원가입을 받지 않습니다. 가입 과정에서 만 14세 이상 여부만 확인하고, 생년월일 전체를 보관할 필요가 없는 경우 판정 결과와 확인 시각만 보관합니다."] },
  { t: '9. 자동 수집정보와 행태정보', l: ["서비스 안정성과 보안을 위해 접속일시, IP, 기기·앱 정보, 오류 로그를 자동으로 생성할 수 있습니다. 맞춤 추천·광고를 위해 행태정보를 이용하는 경우 수집 항목, 방법, 목적, 보유기간, 통제 방법과 제3자 제공 여부를 별도로 공개합니다."] },
  { t: '10. 안전성 확보조치', l: ["접근권한 최소화와 역할 분리", "전송·저장 구간 암호화", "접속기록 보관과 위변조 방지", "취약점 점검과 침해사고 대응", "수탁자 관리·감독", "원본 이미지 접근 제한과 자동 삭제 검증"] },
  { t: '11. 개인정보 보호책임자', l: [`개인정보 보호책임자: ${BUSINESS.representative} (${BUSINESS.name} 대표)`, `연락처: ${CONTACT_EMAIL ?? 'help.weddingpick@gmail.com'}`, `개인정보 관련 문의와 권리행사는 서비스 내 고객센터 또는 위 연락처로 접수할 수 있습니다. 보호책임자는 접수 내용을 확인하여 관계 법령에 따라 처리합니다.`] },
  { t: '12. 권익침해 구제', l: ["이용자는 개인정보침해 신고센터, 개인정보분쟁조정위원회, 경찰청 등 관계기관에 상담이나 분쟁조정을 신청할 수 있습니다. 기관명·연락처는 시행 시점의 공식 정보를 확인해 게시합니다."] },
  { t: '13. 처리방침 변경', l: ["이 처리방침을 변경할 때에는 시행일, 변경 내용과 사유를 서비스에서 알리고 이전 처리방침을 확인할 수 있도록 제공합니다. 별도 동의가 필요한 처리 목적·제3자 제공·국외 이전 등의 변경은 기능 사용 전에 필요한 절차를 거칩니다."] },
];

function privacyDocument(sections: PrivacySection[]): string {
  const toc = sections.map((s, i) => `
    <a href="#ps-${i}" style="display:block;font-size:15px;line-height:23px;padding:6px 0;color:${TER};text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${esc(s.t)}</a>`).join('');

  const content = sections.map((s, i) => {
    let body: string;
    if (s.table && s.cols && s.rows) {
      const colWidths = s.cols.map((c) => c.w);
      const cellStyle = (w: string, bold: boolean) =>
        `width:${w === 'auto' ? 'auto' : w};${w === 'auto' ? 'flex:1 1 0;' : 'flex:0 0 auto;'}min-width:0;font-size:14px;line-height:22px;color:${bold ? INK : SEC};font-weight:${bold ? 700 : 400};padding:10px 12px;text-wrap:pretty`;

      const header = `<div style="display:flex;border-bottom:2px solid ${BORDER};background:${BAND}">
        ${s.cols.map((c, ci) => `<span style="${cellStyle(colWidths[ci] ?? 'auto', true)}">${esc(c.label)}</span>`).join('')}
      </div>`;
      const rows = s.rows.map((r) => `
        <div style="display:flex;border-bottom:1px solid ${DIVIDER}">
          ${r.map((cell, ci) => `<span style="${cellStyle(colWidths[ci] ?? 'auto', ci === 0)}">${esc(cell)}</span>`).join('')}
        </div>`).join('');

      body = `${s.lead ? `<p style="font-size:15px;line-height:24px;color:${SEC};margin:0 0 12px">${esc(s.lead)}</p>` : ''}
        <div style="border-radius:8px;border:1px solid ${BORDER};overflow:hidden;overflow-x:auto">
          ${header}${rows}
        </div>`;
    } else {
      const clauses = (s.l ?? []).map((text, ci) => `
        <div style="display:flex;gap:12px;align-items:flex-start">
          <span style="width:22px;height:22px;flex:0 0 22px;border-radius:6px;background:${BAND};color:${TER};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums">${ci + 1}</span>
          <span style="flex:1;font-size:16px;line-height:27px;color:${SEC}">${esc(text)}</span>
        </div>`).join('');
      body = `<div style="display:flex;flex-direction:column;gap:8px">${clauses}</div>`;
    }

    return `<section id="ps-${i}" style="display:flex;flex-direction:column;gap:12px">
      <h2 style="font-size:19px;line-height:26px;font-weight:700;color:${INK};margin:0">${esc(s.t)}</h2>
      ${body}
    </section>`;
  }).join('');

  return `<div class="sp-legal">
    <aside class="sp-toc">${toc}</aside>
    <div class="sp-content">${content}</div>
  </div>`;
}

export function renderPrivacyPage(): string {
  return subDocument({
    path: "/privacy.html",
    title: '개인정보처리방침',
    description: '웨딩픽 개인정보처리방침을 확인하세요.',
    activePath: null,
    titleBand: titleBand('홈 · 개인정보처리방침', '웨딩픽 개인정보처리방침', '웨딩픽은 개인정보 보호법 등 관계 법령을 준수하며, 서비스에 필요한 최소한의 개인정보만 처리합니다.'),
    body: privacyDocument(PRIVACY_SECTIONS),
  });
}
