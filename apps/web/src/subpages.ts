import strings from '../../../spec/strings.ko.json';
import { marketingHeader, marketingFooter, MARKETING_CHROME } from './landing';
const COPY = strings.webLanding;
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
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${esc(stroke)}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z"></path><path d="M9.4 11.9l1.7 1.7 3.4-3.4"></path></svg>`;
}

const NAV = [
  { label: '서비스 소개', href: '/intro.html' },
  { label: '자주 묻는 질문', href: '/faq.html' },
  { label: '고객지원', href: '/support.html' },
];

function subGnb(_activePath: string | null): string { return marketingHeader(); }
function subFooter(): string { return marketingFooter(); }

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
<style>${BASE_STYLE}
${MARKETING_CHROME}
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

interface TermsArticle { t: string; l: string[] }

const TERMS_ARTICLES: TermsArticle[] = [
  { t: '제1조 목적', l: [`이 약관은 ${BUSINESS.name}(이하 '회사')이 제공하는 ${BUSINESS.serviceName} 서비스의 이용조건, 회사와 회원의 권리·의무, 서비스 운영 및 분쟁 처리 기준을 정하는 것을 목적으로 합니다.`] },
  { t: '제2조 정의', l: ["'서비스'란 회사가 모바일 애플리케이션과 웹을 통해 제공하는 웨딩업체 정보 검색, Pick, 비교, 일정·지출 관리, 배우자 연결, 후기, 제보 금액 정보, 알림 및 이벤트 기능을 말합니다.", "'회원'이란 소셜 인증, 연령 확인 및 필수 약관 동의를 마치고 계정이 활성화된 이용자를 말합니다.", "'Pick 인증 자료'란 회원이 실제 이용금액 확인을 위해 제출하는 영수증, 결제내역, 결제문자, 계좌이체 또는 간편결제 내역 등을 말합니다.", "'실 제보'란 제출 자료에서 필요한 항목을 추출·검증하고 작성자 정보와 분리해 제공하는 금액·품목·이용일·조건 등의 정보를 말합니다.", "'업체'란 서비스에 표시되는 웨딩홀, 스튜디오, 드레스, 메이크업 등 웨딩 관련 사업자를 말합니다. 서비스 노출만으로 제휴관계가 성립하지 않습니다."] },
  { t: '제3조 약관의 게시와 변경', l: ["회사는 회원이 약관을 쉽게 확인할 수 있도록 서비스 내에 게시합니다. 약관을 변경할 때에는 변경 내용, 사유 및 시행일을 관계 법령과 변경의 중대성에 맞는 기간 전에 알립니다. 회원에게 불리하거나 별도 동의가 필요한 변경은 필요한 절차를 거칩니다."] },
  { t: '제4조 이용계약과 가입', l: ["회원가입은 소셜 인증, 만 14세 이상 확인, 필수 약관 동의 및 회사의 가입 승인으로 성립합니다.", "소셜 인증에 성공했더라도 필수 동의가 완료되지 않으면 계정을 활성화하지 않습니다.", "회사는 타인의 정보 도용, 허위정보 입력, 반복적인 부정 가입 또는 기술상 현저한 장애가 있는 경우 가입을 거절하거나 보류할 수 있으며 가능한 범위에서 사유를 안내합니다.", "한 회원은 여러 소셜 계정을 연결할 수 있습니다. 이메일이 같다는 이유만으로 계정을 자동 병합하지 않으며, 기존 계정 재인증 등 본인 확인을 거칩니다."] },
  { t: '제5조 계정 관리', l: ["회원은 자신의 계정과 인증수단을 안전하게 관리해야 하며, 도용이나 무단사용을 알게 되면 지체 없이 회사에 알려야 합니다. 회사는 소셜 제공자가 요구하는 연결 해제 또는 토큰 폐기 절차를 지원합니다."] },
  { t: '제6조 서비스의 내용', l: ["업체 정보 검색·비교와 Pick", "웨딩 준비 일정·지출 관리 및 배우자 연결", "후기 작성·열람과 업체의 정정·반론 절차", "Pick 인증 자료를 통한 제보 금액 정보 제공", "알림, 이벤트, 광고·스폰서 영역 및 그 밖에 회사가 정하는 기능", "회사는 중개·예약·결제 당사자가 아닌 정보 제공 서비스입니다. 다만 향후 상담·견적·예약 기능을 제공하는 경우 해당 기능의 역할과 책임, 개인정보 제공 기준을 별도로 고지합니다."] },
  { t: '제7조 Pick 인증 자료', l: ["회원은 자신이 적법하게 보유하고 제출할 권한이 있는 자료만 제출해야 합니다.", "회사는 통계 작성에 필요한 업체명, 금액, 이용일, 품목·옵션 등 최소 항목만 이용하고 불필요한 금융정보와 제3자 정보는 가림 또는 삭제합니다.", "원본 이미지는 업로드 완료 시점부터 최대 24시간 이내 삭제합니다. 기한 안에 검증이 끝나지 않으면 연장 보관하지 않고 재제출 또는 별도 확인으로 전환할 수 있습니다.", "삭제 후에도 자료 식별자, 삭제 예정·완료 시각, 결과 코드 등 최소한의 감사기록은 별도로 정한 기간 동안 보관할 수 있습니다.", "회사는 중복·조작·오매칭 가능성을 검토할 수 있으나 이미지 지문이나 자동 점수만으로 부정행위를 확정하지 않습니다."] },
  { t: '제8조 실 제보의 이용', l: ["회원은 회사가 제출 자료에서 개인정보와 작성자 정보를 분리한 실 제보를 서비스 제공, 통계 작성, 품질 개선 및 오류·분쟁 대응에 필요한 범위에서 이용하는 데 동의합니다. 회사는 필요한 범위를 넘는 영구적 권리를 일괄 취득하지 않으며, 원본 자료 자체를 공개하지 않습니다."] },
  { t: '제9조 가격정보와 통계', l: ["제보 금액은 실제 제출 사례의 구간과 기준금액 등 통계정보이며 업체의 공식 견적이나 판매가격을 보장하지 않습니다.", "최근 12개월을 기본 구간으로 하되 카테고리 변동성, 계절, 평일·주말, 시간대, 보증인원 및 옵션을 반영할 수 있습니다.", "조건별 정보가 부족하거나 재식별 가능성이 있으면 세부정보를 묶거나 공개하지 않습니다.", "패키지 금액은 항목별 금액이 확인되지 않으면 개별 서비스 가격으로 임의 안분하지 않습니다."] },
  { t: '제10조 후기와 회원 콘텐츠', l: ["회원은 타인의 권리를 침해하지 않는 범위에서 후기와 콘텐츠를 작성할 수 있습니다. 회사는 서비스 표시·운영·백업·신고 처리에 필요한 비독점적 이용권을 보유하되 목적과 기간을 필요한 범위로 제한합니다. 위법, 명예훼손, 개인정보 노출, 광고·도배 또는 무관한 콘텐츠는 기준에 따라 임시 비공개하거나 제한할 수 있고 작성자에게 소명 기회를 제공합니다."] },
  { t: '제11조 배우자 연결', l: ["배우자 연결은 상대방의 명시적 수락으로 성립합니다. 공유 범위는 화면에 표시하며 연결 해제 시 이후 공유를 중단합니다. 각 회원은 본인이 작성한 정보에 대한 권리를 유지합니다."] },
  { t: '제12조 광고와 추천', l: ["회사는 광고·스폰서 영역을 자연 검색·추천과 구분해 표시합니다. 광고비와 제휴 여부는 제보 금액, 후기, 검증 결과 및 비광고 순위에 영향을 주지 않습니다."] },
  { t: '제13조 이벤트와 보상', l: ["이벤트별 기간, 참여조건, 인원, 보상, 예산, 지급절차, 제한사항은 별도 안내합니다.", "보상은 검증과 지급조건 확인 후 지급합니다. 취소·환불·중복·도용이 확인되면 지급을 보류하거나 합리적인 범위에서 회수할 수 있습니다.", "정상적인 마케팅 수신 거부만을 이유로 서비스 이용을 제한하지 않습니다. 이벤트 참여에 별도 개인정보 제공이 필요한 경우 이벤트 화면에서 따로 안내합니다.", "지급 실패 시 재시도하거나 수령정보 확인을 요청할 수 있으며, 장기·반복 지급을 보장하지 않습니다."] },
  { t: '제14조 금지행위', l: ["타인의 계정·자료·개인정보 도용", "이미지·금액·일자·업체 정보의 위조 또는 고의적 왜곡", "동일 자료의 반복 제출, 다계정 악용 또는 보상 목적의 취소 은폐", "서비스의 보안·운영을 방해하는 행위", "타인의 권리, 명예, 영업비밀 또는 저작권을 침해하는 행위", "법령 또는 공서양속에 반하는 행위"] },
  { t: '제15조 이용제한과 이의제기', l: ["회사는 위반의 내용과 정도에 따라 경고, 해당 콘텐츠·통계 반영 보류, 기능 제한, 일시정지 또는 계약 해지를 할 수 있습니다. 긴급한 개인정보 노출이나 보안사고를 제외하고 가능한 범위에서 사유와 기간을 알리고 소명·이의제기 방법을 제공합니다. 자동화된 탐지 결과만으로 영구 정지하지 않습니다."] },
  { t: '제16조 업체의 정정·이의제기', l: ["업체는 정보 오류, 오매칭, 권리침해 또는 통계 오류를 신고할 수 있습니다. 회사는 제휴 여부와 무관하게 접수하고 필요한 경우 임시 비공개한 뒤 제출 자료와 검증 이력을 검토합니다. 단순 삭제 요청을 자동 기각하지 않으며 유지·수정·통계 제외·비공개 결과와 사유를 기록합니다."] },
  { t: '제17조 서비스 변경·중단', l: ["회사는 운영·보안·기술·법령상 필요에 따라 서비스 일부를 변경하거나 중단할 수 있습니다. 회원에게 중대한 영향이 있으면 사전에 알리며, 긴급 장애·보안사고 등 사전 고지가 어려운 경우 사후에 알릴 수 있습니다."] },
  { t: '제18조 회원탈퇴', l: ["회원은 서비스 내 탈퇴 기능을 이용할 수 있으며 탈퇴하면 계정과 개인화 정보는 삭제되고 되돌릴 수 없습니다.", "후기와 실 제보는 작성자 정보와 분리해 유지될 수 있습니다. 화면에는 해당 항목과 개수를 구체적으로 표시합니다.", "법령상 보관이 필요한 정보는 해당 기간 동안 다른 정보와 분리해 보관하고 목적이 끝나면 삭제합니다.", "연결된 소셜 계정은 제공자 정책에 따른 연결 해제 또는 토큰 폐기 절차를 수행합니다."] },
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
      ['서비스 운영·호스팅', '서비스 서버 운영', 'Render Services, Inc. · 위탁계약 종료 또는 서비스 종료 시까지'],
      ['정보 저장소 운영', '서비스 정보의 저장과 조회', 'Neon, Inc. · 위탁계약 종료 또는 서비스 종료 시까지'],
      ['클라우드·객체 저장', '서비스 정보 및 업로드 원본의 시한부 저장', '네이버클라우드 주식회사 · 이 처리방침이 정한 보유기간까지'],
      ['문자인식·영상 분석', '업로드한 자료에서 필요한 항목 추출·가림·검증', 'Anthropic PBC · 이전 목적 달성 시까지'],
      ['인증', '카카오 소셜 인증', '주식회사 카카오 · 각 제공자의 개인정보처리방침 및 이용자 선택에 따름'],
      ['알림 발송', '앱 푸시 알림 발송', 'Expo(650 Industries, Inc.) · 발송 목적 달성 시까지'],
      ['보상 발송', '이벤트 보상 지급과 실패 처리', '수탁자가 정해지는 경우 서비스 내 처리방침에 공개'],
    ],
    lead: '회사는 수탁자와 문서로 위탁계약을 체결하고 목적 외 처리 금지, 안전조치, 재위탁, 사고 통지 및 삭제 여부를 관리·감독합니다.',
  },
  {
    t: '5. 개인정보의 국외 이전',
    table: true,
    cols: [{ label: '이전받는 자', w: '190px' }, { label: '국가·목적', w: '200px' }, { label: '항목·시기·방법·보유기간', w: 'auto' }],
    rows: [
      [
        'Anthropic PBC',
        '미국 · 업로드한 자료에서 금액·업체명 등 필요한 항목을 읽어내기 위해',
        '이용자가 올린 자료의 이미지 또는 PDF 파일 전체(업체명, 금액, 예식일, 이름, 연락처가 함께 적혀 있을 수 있습니다). 이용자가 자료를 올려 분석이 시작되는 시점에, 암호화된 통신구간을 통해 사업자의 응용프로그램 인터페이스로 전송합니다. 이전 목적 달성 시까지 보유합니다.',
      ],
      [
        'Render Services, Inc.',
        '미국 · 서비스 서버 운영',
        '이 처리방침 제1항이 정한 모든 항목. 서비스를 이용하는 시점에 네트워크를 통해 전송합니다. 위탁계약 종료 또는 서비스 종료 시까지 보유합니다.',
      ],
      [
        'Neon, Inc.',
        '미국 · 서비스 정보를 저장하는 정보 저장소 운영',
        '이 처리방침 제1항이 정한 모든 항목. 서비스를 이용하는 시점에 암호화된 통신구간을 통해 전송합니다. 위탁계약 종료 또는 서비스 종료 시까지 보유합니다.',
      ],
      [
        'Expo(650 Industries, Inc.)',
        '미국 · 앱 푸시 알림 발송',
        '기기 푸시 토큰과 알림 제목·본문. 알림을 보내는 시점에 암호화된 통신구간을 통해 전송합니다. 발송 목적 달성 시까지 보유합니다.',
      ],
    ],
    lead: '이용자는 국외 이전을 거부할 수 있습니다. 다만 위 이전은 해당 기능을 제공하기 위해 반드시 필요하므로, 거부하면 그 기능(자료 분석, 푸시 알림)을 이용할 수 없고 서비스 전체 이용이 어려울 수 있습니다. 거부는 앱 설정의 동의 철회 또는 고객센터를 통해 요청할 수 있습니다. 위 목록에 없는 국외 이전이 새로 생기면 시행 전에 이 항목을 갱신하고 알립니다.',
  },
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
