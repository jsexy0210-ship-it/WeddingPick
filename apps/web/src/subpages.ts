import strings from '../../../spec/strings.ko.json';

const COPY = strings.webLanding;
import { socialMeta } from './social-meta';
import type { LegalDocument, LegalSection } from './legal-data';
/**
 * 웨딩픽 랜딩 하위페이지 5종.
 *
 * 서비스 소개 / 자주 묻는 질문 / 고객지원 / 이용약관 / 개인정보처리방침.
 * 랜딩과 같은 GNB·Footer 공유. 모바일·태블릿·데스크톱 대응.
 * 런타임 JS 없음 · 웹폰트 없음.
 */

import { BUSINESS, BUSINESS_NOTICE_LINES } from '@weddingpick/domain';

import { CONTACT_EMAIL } from './content';
import { faviconTags } from './landing-v4';
import { FONT_FACE, FONT_STACK, fontPreloadTag } from './fonts';

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

function legalText(text: string): string {
  return esc(text).replace(/https:\/\/[^\s<>]+/g, url => `<a href="${url}">${url}</a>`);
}

function pickMark(size: number, stroke: string): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${esc(stroke)}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z"></path><path d="M9.4 11.9l1.7 1.7 3.4-3.4"></path></svg>`;
}

const NAV = [
  { label: '서비스 소개', href: '/intro.html' },
  { label: '자주 묻는 질문', href: '/faq.html' },
  { label: '고객지원', href: '/support.html' },
];

/**
 * 하위 5종(소개 · FAQ · 고객지원 · 이용약관 · 처리방침)의 GNB.
 *
 * `19b-landing-sub.dc.html`의 `gnb`(L504) · `gnbWord`(L505) · `gnbCta`(L506)를 그린다 —
 * 높이 76 · 좌우 64 · 아래 1px 선, 브랜드 19/700, CTA는 코랄 pill 38 · radius 999.
 * 랜딩 본 화면의 `marketingHeader()`(흰 테두리 버튼 · 80)와는 다른 chrome이다.
 *
 * 좁은 화면에서는 `.sp-ham-cb` 체크박스가 `.sp-nav`를 펼친다(자바스크립트 없이 CSS만).
 * 체크박스가 `.sp-nav`보다 **앞에** 있어야 `~` 선택자가 걸린다.
 */
function subGnb(activePath: string | null): string {
  const links = NAV.map(n => {
    const on = activePath === n.href;
    return `<a class="sp-nav-link" href="${esc(n.href)}"${on ? ' aria-current="page"' : ''}${on ? ` style="color:${INK};font-weight:700"` : ''}>${esc(n.label)}</a>`;
  }).join('');
  return `<header class="sp-gnb">
    <a class="sp-brand" href="/">${pickMark(24, C)}<span>${esc(COPY.brand)}</span></a>
    <input class="sp-ham-cb" type="checkbox" id="sp-nav-toggle" tabindex="-1" aria-hidden="true">
    <label class="sp-ham-btn" for="sp-nav-toggle" aria-label="${esc(COPY.navLabel)}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16"></path></svg></label>
    <nav class="sp-nav" aria-label="${esc(COPY.navLabel)}">${links}</nav>
    <a class="sp-cta-btn" href="/#download">${esc(COPY.launchLink)}</a>
  </header>`;
}

/**
 * 하위 5종의 Footer. `19b-landing-sub.dc.html`의 `footer`(L547) 이하 —
 * 바탕 `#3A2F30`, 1행 76(브랜드 · 메뉴 · 메일), 1px 구분선, 2행 60(저작권 · 약관 링크).
 *
 * 시안에 없는 `.sp-foot-biz` 한 덩어리는 남긴다 — 사업자 정보는 표시 의무가 있다.
 */
function subFooter(): string {
  const nav = NAV.map(n => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join('');
  const legal = [
    { label: '이용약관', href: '/terms.html' },
    { label: '개인정보처리방침', href: '/privacy.html' },
  ].map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('');
  return `<footer class="sp-foot">
    <div class="sp-foot-top">
      <a class="sp-foot-brand" href="/">${pickMark(20, C)}<span>${esc(COPY.brand)}</span></a>
      <nav class="sp-foot-nav" aria-label="${esc(COPY.footerLabel)}">${nav}</nav>
      ${CONTACT_EMAIL ? `<a class="sp-foot-mail" href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>` : ''}
    </div>
    <div class="sp-foot-biz">${BUSINESS_NOTICE_LINES.map(l => `<p>${esc(l)}</p>`).join('')}</div>
    <div class="sp-foot-bot">
      <p>© ${new Date().getFullYear()} ${esc(BUSINESS.name)}. ${esc(COPY.copyright)}</p>
      <div class="sp-foot-policy">${legal}</div>
    </div>
  </footer>`;
}

const BASE_STYLE = `
${FONT_FACE}
*,::before,::after{box-sizing:border-box}
html{font-family:${FONT_STACK};font-size:16px;-webkit-text-size-adjust:100%}
body{margin:0;background:#f7f8fa;color:${INK}}
a{color:inherit}
/* 풀 와이드. 랜딩(landing-v4.ts)의 .page와 같은 규칙을 쓴다. */
.page{width:100%;margin:0;background:#fff;display:flex;flex-direction:column;min-height:100vh}

/* GNB */
.sp-gnb{height:76px;flex:0 0 76px;display:flex;align-items:center;justify-content:space-between;padding:0 64px;position:relative;gap:32px;background:#fff;box-shadow:inset 0 -1px 0 ${DIVIDER}}
.sp-brand{display:inline-flex;align-items:center;gap:9px;text-decoration:none;font-size:19px;font-weight:700;color:${INK};white-space:nowrap}
.sp-brand svg{flex:0 0 24px}
.sp-nav{display:flex;align-items:center;gap:32px;flex:1;justify-content:center}
.sp-nav-link{font-size:16px;line-height:22px;text-decoration:none;white-space:nowrap;color:${SEC}}
.sp-ham-cb{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.sp-ham-btn{display:none;background:none;border:none;padding:8px;cursor:pointer;line-height:0;flex-shrink:0}
.sp-cta-btn{height:38px;padding:0 18px;border-radius:999px;display:inline-flex;align-items:center;font-size:15px;font-weight:700;text-decoration:none;white-space:nowrap;flex-shrink:0;background:${C};color:#fff}

/* Title band */
.sp-titleband{padding:52px 64px 44px;border-bottom:1px solid ${DIVIDER}}
.sp-titleband h1{font-size:38px;line-height:52px;font-weight:700;color:${INK};letter-spacing:-1.2px;margin:0;white-space:pre-line}

/* Body */
.sp-body{padding:52px 64px 72px}

/* Footer */
.sp-foot{padding:0 64px;background:${FOOT_INK};color:rgba(255,255,255,.72)}
.sp-foot-top{display:flex;align-items:center;justify-content:space-between;height:76px;border-bottom:1px solid rgba(255,255,255,.12);gap:24px}
.sp-foot-brand{display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-size:17px;font-weight:700;color:#fff;white-space:nowrap}
.sp-foot-brand svg{flex:0 0 20px}
.sp-foot-nav{display:flex;align-items:center;gap:24px;flex:1;justify-content:center}
.sp-foot-nav a,.sp-foot-mail{font-size:15px;line-height:22px;color:rgba(255,255,255,.72);text-decoration:none;white-space:nowrap}
.sp-foot-biz{display:flex;flex-direction:column;gap:4px;padding:20px 0 4px;border-top:1px solid rgba(255,255,255,.1)}
.sp-foot-biz p{margin:0;font-size:13px;line-height:19px;color:rgba(255,255,255,.44)}
.sp-foot-bot{display:flex;align-items:center;justify-content:space-between;height:60px;gap:16px}
.sp-foot-bot p{margin:0;font-size:13px;line-height:19px;color:rgba(255,255,255,.44)}
.sp-foot-policy{display:flex;align-items:center;gap:16px}
.sp-foot-policy a{font-size:13px;line-height:19px;color:rgba(255,255,255,.72);text-decoration:none;white-space:nowrap}

/* Legal layout */
.sp-legal{padding:56px 64px 72px;display:flex;gap:56px;align-items:flex-start}
.sp-toc{flex:0 0 200px;position:sticky;top:24px;min-width:0}
.sp-toc summary{font-weight:700;cursor:pointer;padding:12px 0}
.sp-toc nav{display:flex;flex-direction:column}
.sp-toc a{font-size:15px;line-height:1.6;padding:8px 0;color:${SEC};text-decoration:none;overflow-wrap:anywhere}
.sp-content section{scroll-margin-top:24px;min-width:0}
.sp-content span{min-width:0;overflow-wrap:anywhere}
.sp-policy-table{width:100%;border-collapse:collapse;table-layout:fixed;text-align:left;font-size:14px;line-height:1.7}
.sp-policy-table th,.sp-policy-table td{padding:12px;vertical-align:top;border:1px solid ${BORDER};overflow-wrap:anywhere}
.sp-policy-table thead{background:${BAND}}
.sp-policy-table th{color:${INK};font-weight:700}
.sp-policy-table td{color:${SEC}}
.sp-cell-label{display:none}
.sp-content{flex:1;min-width:0;display:flex;flex-direction:column;gap:40px}

/* Tablet */
@media(max-width:1023px){
  .sp-gnb{padding:0 32px}
  .sp-titleband{padding:40px 32px 36px}
  .sp-titleband h1{font-size:30px;line-height:42px}
  .sp-body{padding:40px 32px 56px}
  .sp-foot{padding:0 32px}
  .sp-legal{padding:40px 32px 56px}
  .sp-legal{flex-direction:column;gap:24px}
  .sp-toc{position:static;flex:none;width:100%;border-bottom:1px solid ${DIVIDER}}
  .sp-content{flex:none;width:100%}
  .sp-policy-table,.sp-policy-table tbody,.sp-policy-table tr,.sp-policy-table th,.sp-policy-table td{display:block;width:100%}
  .sp-policy-table thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
  .sp-policy-table tr{border:1px solid ${BORDER};border-radius:8px;margin-bottom:16px;overflow:hidden}
  .sp-policy-table th,.sp-policy-table td{border:0;border-bottom:1px solid ${DIVIDER};padding:14px 16px}
  .sp-policy-table th{background:${BAND}}
  .sp-policy-table td:last-child{border-bottom:0}
  .sp-cell-label{display:block;font-size:12px;font-weight:700;color:${SEC};margin-bottom:4px}
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
  .sp-toc{display:block}
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
${fontPreloadTag()}
<style>${BASE_STYLE}
.sp-titleband,.sp-body,.sp-legal{width:min(1120px,calc(100% - 48px));margin-inline:auto;padding-inline:0}
.sp-titleband{padding-block:64px 40px}.sp-titleband h1{word-break:keep-all;overflow-wrap:anywhere}.sp-editorial{width:min(760px,calc(100% - 48px));margin:0 auto;padding:48px 0 72px;color:${INK}}
.sp-editorial section{padding:32px 0;border-bottom:1px solid ${DIVIDER}}.sp-editorial section:first-child{padding-top:0}.sp-editorial h2{font-size:24px;line-height:1.4;margin:8px 0 16px;word-break:keep-all}.sp-editorial p{font-size:16px;line-height:1.85;color:${SEC};word-break:keep-all;overflow-wrap:anywhere}.sp-number{font-size:14px;color:${SEC}}.sp-link{display:inline-flex;align-items:center;min-height:48px;margin-top:16px;font-size:16px;font-weight:700;text-underline-offset:5px}.sp-editorial .sp-support-note{font-size:14px;margin-top:24px}.sp-faq-list details{border-bottom:1px solid ${DIVIDER}}.sp-faq-list summary{cursor:pointer;font-size:18px;font-weight:700;min-height:64px;padding:20px 0;word-break:keep-all}.sp-faq-list details p{padding-bottom:24px}.sp-legal{padding-top:40px}.sp-content p,.sp-content li{overflow-wrap:anywhere}
@media(max-width:720px){.sp-titleband{padding-block:32px}.sp-titleband h1{font-size:28px;line-height:1.4}.sp-editorial{padding-block:32px 56px}.sp-editorial h2{font-size:22px}.sp-faq-list summary{font-size:16px}}
</style>
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

export function renderIntroPage(): string {
  return subDocument({path:'/intro.html',title:COPY.nav[0]!.label,description:COPY.introBody,activePath:'/intro.html',titleBand:titleBand(COPY.nav[0]!.label,COPY.introTitle,COPY.introBody),body:
    `<div class="sp-editorial">${COPY.steps.map(s => `<section><span class="sp-number">${esc(s.n)}</span><h2>${esc(s.title)}</h2><p>${esc(s.body)}</p></section>`).join('')}
    <section><h2>${esc(COPY.pickTitle).replace(/\n/g,' ')}</h2><p>${esc(COPY.pickBody)}</p></section>
    <section><h2>${esc(COPY.trustTitle).replace(/\n/g,' ')}</h2><p>${esc(COPY.trustBody)}</p><p>${esc(COPY.trustNote)}</p></section>
    <a class="sp-link" href="/#how">${esc(COPY.introLink)}</a></div>`});
}

export function renderFaqPage(): string {
  return subDocument({path:'/faq.html',title:COPY.nav[2]!.label,description:COPY.faqTitle,activePath:'/faq.html',titleBand:titleBand(COPY.nav[2]!.label,COPY.faqTitle),body:
    `<div class="sp-editorial sp-faq-list">${COPY.faq.map(f=>`<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
    <p class="sp-support-note">${esc(COPY.faqSupport)}</p><a class="sp-link" href="/support.html">${esc(COPY.contact)}</a></div>`});
}

export function renderSupportPage(): string {
  const contact=CONTACT_EMAIL ? `<a class="sp-link" href="mailto:${esc(CONTACT_EMAIL)}">${esc(COPY.supportMail)}</a><p>${esc(CONTACT_EMAIL)}</p><p>${esc(COPY.supportMailNote)}</p>` : `<p>${esc(COPY.supportFallback)}</p>`;
  return subDocument({path:'/support.html',title:COPY.footerLinks[1]!.label,description:COPY.supportBody,activePath:'/support.html',titleBand:titleBand(COPY.footerLinks[1]!.label,COPY.supportTitle,COPY.supportBody),body:
    /*
     * WP-BIZ-008 웹 하단 업체 문의 진입. **앱과 같은 창구로 보낸다** — 업체용
     * 접수 경로를 따로 만들면 두 큐를 사람이 나눠 봐야 하고, 한쪽이 밀린다.
     * 로그인을 먼저 요구하지 않는다: 소속 확인은 접수한 뒤의 일이고, 앞에 두면
     * 정보가 틀렸다고 알리러 온 사람이 가입부터 해야 한다.
     */
    `<div class="sp-editorial"><section><h2>${esc(COPY.contact)}</h2>${contact}<p class="sp-support-note">${esc(COPY.supportPrivacy)}</p></section><section id="vendor"><h2>${esc(COPY.supportVendorTitle)}</h2><p>${esc(COPY.supportVendorBody)}</p>${contact}<p class="sp-support-note">${esc(COPY.supportVendorNote)}</p></section><section><h2>${esc(COPY.supportFaq)}</h2><a class="sp-link" href="/faq.html">${esc(COPY.nav[2]!.label)}</a></section></div>`});
}

/*
 * **본문은 여기 없다. 표에 있다**(2026-09-16 대표 지시 — 「개인정보처리방침
 * 이용약관 마케팅 약관도 동일하게 내가 수정가능하도록 하고」).
 *
 * 전까지 이 자리에 `TERMS_ARTICLES` 21개와 `PRIVACY_SECTIONS` 13개가 박혀 있었다.
 * 그래서 한 글자를 고치려면 코드를 고쳐 배포해야 했다. 마이그레이션 0420이 그 본문을
 * **글자 그대로** 표로 옮겼고, 지금은 빌드할 때 읽어 온다(`legal-data.ts`).
 *
 * **정본이 하나라는 규칙은 그대로다** — 읽는 곳은 여전히 이 페이지 하나이고,
 * 앱은 지금처럼 여기로 내보낸다. 바뀐 것은 그 하나가 코드가 아니라 표라는 것뿐이다.
 *
 * 그리는 법은 손대지 않았다. `legalDocument`와 `privacyDocument`는 받는 것이
 * 상수에서 인자로 바뀌었을 뿐이고, 같은 내용이면 같은 HTML이 나온다.
 */

/**
 * 제목 아래 한 줄.
 *
 * **시행일은 판에 붙어 있다**(0420). 전까지는 배포 환경변수
 * `LEGAL_TERMS_EFFECTIVE_ON`에 있었는데, 판마다 다른 값인데 배포 전체에 하나뿐이라
 * 옛 판이 언제부터 언제까지 효력이었는지를 말할 수 없었다.
 *
 * 꼴은 그대로 둔다 — 「시행일 2026년 10월 1일」. 보이는 글자가 바뀌면 그것은
 * 문서가 바뀐 것이다.
 */
function effectiveDateLine(doc: LegalDocument): string {
  const [year, month, day] = doc.effectiveOn.split('-');

  return `시행일 ${year}년 ${Number(month)}월 ${Number(day)}일`;
}

/*
 * 표 모양 절. 방침의 세 절이 이 모양이다 — 목적·항목·보유기간 · 수탁자 · 국외 이전.
 *
 * **약관 쪽에서도 부를 수 있게 둔다.** 지금 약관에는 표가 없지만, 표를 넣는 것은
 * 이제 대표님이 고르실 수 있는 일이다. 여기서 갈라두지 않으면 그날 약관에 넣은 표가
 * 조용히 빈 칸으로 나간다.
 */
function legalTable(s: LegalSection): string {
  const cols = s.cols ?? [];
  const header = `<thead><tr>${cols.map(c => `<th scope="col">${esc(c.label)}</th>`).join('')}</tr></thead>`;
  const rows = (s.rows ?? []).map(r => `<tr>${r.map((cell, ci) => {
    const tag = ci === 0 ? 'th' : 'td';
    return `<${tag}${ci === 0 ? ' scope="row"' : ''}><span class="sp-cell-label" aria-hidden="true">${esc(cols[ci]?.label ?? '')}</span>${legalText(cell)}</${tag}>`;
  }).join('')}</tr>`).join('');

  return `${s.lead ? `<p style="font-size:15px;line-height:24px;color:${SEC};margin:0 0 12px">${esc(s.lead)}</p>` : ''}
        <table class="sp-policy-table" aria-label="${esc(s.t)}">${header}<tbody>${rows}</tbody></table>`;
}

function legalDocument(articles: LegalSection[]): string {
  const toc = articles.map((a, i) => `
    <a href="#article-${i}">${esc(a.t)}</a>`).join('');

  const content = articles.map((a, i) => {
    if (a.table && a.cols && a.rows) {
      return `<section id="article-${i}" style="display:flex;flex-direction:column;gap:12px">
      <h2 style="font-size:19px;line-height:26px;font-weight:700;color:${INK};margin:0">${esc(a.t)}</h2>
      ${legalTable(a)}
    </section>`;
    }

    const clauses = (a.l ?? []).map((text, ci) => `
      <div style="display:flex;gap:12px;align-items:flex-start">
        <span style="width:22px;height:22px;flex:0 0 22px;border-radius:6px;background:${BAND};color:${TER};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums">${ci + 1}</span>
        <span style="flex:1;font-size:16px;line-height:27px;color:${SEC}">${legalText(text)}</span>
      </div>`).join('');

    return `<section id="article-${i}" style="display:flex;flex-direction:column;gap:12px">
      <h2 style="font-size:19px;line-height:26px;font-weight:700;color:${INK};margin:0">${esc(a.t)}</h2>
      <div style="display:flex;flex-direction:column;gap:8px">${clauses}</div>
    </section>`;
  }).join('');

  return `<div class="sp-legal">
    <details class="sp-toc"><summary>목차 보기</summary><nav aria-label="문서 목차">${toc}</nav></details>
    <div class="sp-content">${content}</div>
  </div>`;
}

export function renderTermsPage(doc: LegalDocument): string {
  return subDocument({
    path: "/terms.html",
    title: '이용약관',
    description: '웨딩픽 서비스 이용약관을 확인하세요.',
    activePath: null,
    titleBand: titleBand('홈 · 이용약관', '웨딩픽 서비스 이용약관', effectiveDateLine(doc)),
    body: legalDocument(doc.sections),
  });
}

/* ───────── 5. 개인정보처리방침 ───────── */

function privacyDocument(sections: LegalSection[]): string {
  const toc = sections.map((s, i) => `
    <a href="#ps-${i}">${esc(s.t)}</a>`).join('');

  const content = sections.map((s, i) => {
    let body: string;
    if (s.table && s.cols && s.rows) {
      body = legalTable(s);
    } else {
      const clauses = (s.l ?? []).map((text, ci) => `
        <div style="display:flex;gap:12px;align-items:flex-start">
          <span style="width:22px;height:22px;flex:0 0 22px;border-radius:6px;background:${BAND};color:${TER};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums">${ci + 1}</span>
          <span style="flex:1;font-size:16px;line-height:27px;color:${SEC}">${legalText(text)}</span>
        </div>`).join('');
      body = `<div style="display:flex;flex-direction:column;gap:8px">${clauses}</div>`;
    }

    return `<section id="ps-${i}" style="display:flex;flex-direction:column;gap:12px">
      <h2 style="font-size:19px;line-height:26px;font-weight:700;color:${INK};margin:0">${esc(s.t)}</h2>
      ${body}
    </section>`;
  }).join('');

  return `<div class="sp-legal">
    <details class="sp-toc"><summary>목차 보기</summary><nav aria-label="문서 목차">${toc}</nav></details>
    <div class="sp-content">${content}</div>
  </div>`;
}

export function renderPrivacyPage(doc: LegalDocument): string {
  return subDocument({
    path: "/privacy.html",
    title: '개인정보처리방침',
    description: '웨딩픽 개인정보처리방침을 확인하세요.',
    activePath: null,
    titleBand: titleBand('홈 · 개인정보처리방침', '웨딩픽 개인정보처리방침', effectiveDateLine(doc)),
    body: privacyDocument(doc.sections),
  });
}
