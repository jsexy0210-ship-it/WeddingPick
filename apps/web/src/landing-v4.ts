/**
 * 웨딩픽 랜딩 v4 — 마케팅 랜딩 페이지.
 *
 * 1280px 고정폭 데스크톱 레이아웃.
 * 프레임워크 없음 · 런타임 JS 없음 · 웹폰트 없음.
 * 디자인 토큰은 CLAUDE.md § 5 색 / § 6 타이포 기준.
 */

import { CONTACT_EMAIL } from './content';

const C = '#FF6F61';
const INK = '#212124';
const SEC = '#4D5159';
const TER = '#868B94';
const FOOT_INK = '#3A2F30';
const HERO_TINT = '#FDF8F7';
const FEAT_TINT = '#FDF6F4';
const DIVIDER = '#EAEBEE';
const BAND = '#F2F3F6';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Pick Mark — 하트 안에 체크. CLAUDE.md § 2 확정 경로. viewBox 24, stroke 1.9. */
function pickMark(size: number, stroke: string): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${esc(stroke)}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z"></path><path d="M8.7 11.9l2.2 2.2 4.4-4.4"></path></svg>`;
}

/** 앱스토어 뱃지 — 아직 출시 전이므로 앵커로만 이어진다. */
function storeBadge(label: string): string {
  return `<a href="#download" style="display:inline-flex;align-items:center;gap:9px;height:44px;padding:0 18px;border-radius:10px;border:1.5px solid ${esc(DIVIDER)};background:#fff;font-size:14px;font-weight:700;color:${esc(INK)};text-decoration:none;white-space:nowrap">${esc(label)}</a>`;
}

/** GNB — 랜딩 전용 (bg 없음, 영웅 배경 위에 띄워 씀). */
function gnb(): string {
  return `<header style="position:relative;height:76px;flex:0 0 76px;display:flex;align-items:center;justify-content:space-between;padding:0 64px;z-index:4">
  <a href="/" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit">
    <span style="color:${esc(C)};display:flex;line-height:0">${pickMark(22, C)}</span>
    <span style="font-size:19px;font-weight:700;color:${esc(INK)}">웨딩픽</span>
  </a>
  <nav style="display:flex;align-items:center;gap:32px">
    <a href="/intro.html" style="font-size:16px;line-height:22px;color:${esc(SEC)};text-decoration:none;white-space:nowrap">서비스 소개</a>
    <a href="/faq.html" style="font-size:16px;line-height:22px;color:${esc(SEC)};text-decoration:none;white-space:nowrap">자주 묻는 질문</a>
    <a href="/support.html" style="font-size:16px;line-height:22px;color:${esc(SEC)};text-decoration:none;white-space:nowrap">고객지원</a>
  </nav>
  <a href="#download" style="height:38px;padding:0 18px;border-radius:999px;background:${esc(C)};color:#fff;display:inline-flex;align-items:center;font-size:15px;font-weight:700;text-decoration:none;white-space:nowrap">앱 다운로드</a>
</header>`;
}

/** 영웅 섹션 — 궤도 링 3개 + 플로팅 타일 4개. */
function hero(): string {
  /* 플로팅 타일 공통 래퍼 스타일 */
  const tile = (
    size: number,
    radius: number,
    pos: string,
    rot: number,
    bg: string,
    shadow: string,
    inner: string,
  ) =>
    `<div style="position:absolute;${pos};width:${size}px;height:${size}px;border-radius:${radius}px;background:${bg};box-shadow:${shadow};transform:rotate(${rot}deg);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">${inner}</div>`;

  /* Pick Mark 타일 */
  const markTile = tile(
    108, 30,
    'left:104px;top:186px',
    -9,
    C,
    '0 18px 40px rgba(255,111,97,.30)',
    `<span style="color:#fff;display:flex;line-height:0">${pickMark(52, '#fff')}</span>`,
  );

  /* 기준금액 타일 */
  const priceTile = tile(
    128, 32,
    'right:96px;top:150px',
    8,
    '#fff',
    '0 18px 40px rgba(58,47,48,.12)',
    `<span style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:0 16px;text-align:center">
      <span style="font-size:12px;line-height:16px;font-weight:700;color:${esc(TER)}">기준금액</span>
      <span style="font-size:26px;line-height:34px;font-weight:700;color:${esc(INK)};font-variant-numeric:tabular-nums;letter-spacing:-.5px">168만원</span>
      <span style="font-size:11px;line-height:15px;color:${esc(TER)}">확인된 정보 12건</span>
    </span>`,
  );

  /* 비교 바 타일 */
  const compareTile = tile(
    86, 24,
    'left:206px;bottom:96px',
    12,
    FOOT_INK,
    '0 14px 32px rgba(58,47,48,.22)',
    `<span style="display:flex;flex-direction:column;gap:6px;padding:0 12px;width:100%">
      <span style="display:flex;align-items:center;gap:6px">
        <span style="width:10px;height:10px;border-radius:3px;background:${esc(C)};flex-shrink:0"></span>
        <span style="flex:1;height:6px;border-radius:3px;background:${esc(C)};opacity:.9"></span>
      </span>
      <span style="display:flex;align-items:center;gap:6px">
        <span style="width:10px;height:10px;border-radius:3px;background:rgba(255,255,255,.3);flex-shrink:0"></span>
        <span style="width:70%;height:6px;border-radius:3px;background:rgba(255,255,255,.3)"></span>
      </span>
      <span style="display:flex;align-items:center;gap:6px">
        <span style="width:10px;height:10px;border-radius:3px;background:rgba(255,255,255,.18);flex-shrink:0"></span>
        <span style="width:50%;height:6px;border-radius:3px;background:rgba(255,255,255,.18)"></span>
      </span>
    </span>`,
  );

  /* 커플 타일 */
  const coupleTile = tile(
    96, 26,
    'right:178px;bottom:74px',
    -7,
    '#FFE9E6',
    '0 14px 32px rgba(255,111,97,.20)',
    `<span style="display:flex;align-items:center;gap:-8px">
      <span style="width:40px;height:40px;border-radius:999px;background:${esc(C)};border:2px solid #fff;display:flex;align-items:center;justify-content:center;z-index:2">
        <span style="color:#fff;display:flex;line-height:0">${pickMark(20, '#fff')}</span>
      </span>
      <span style="width:40px;height:40px;border-radius:999px;background:#FFDAD5;border:2px solid #fff;margin-left:-8px;display:flex;align-items:center;justify-content:center">
        <span style="color:${esc(C)};display:flex;line-height:0">${pickMark(20, C)}</span>
      </span>
    </span>`,
  );

  return `<section style="position:relative;height:640px;overflow:hidden;display:flex;flex-direction:column;background:${esc(HERO_TINT)}">
  <!-- 궤도 링 -->
  <span style="position:absolute;left:50%;top:352px;width:760px;height:760px;margin-left:-380px;margin-top:-380px;border-radius:999px;border:1px solid rgba(58,47,48,.07)"></span>
  <span style="position:absolute;left:50%;top:352px;width:1040px;height:1040px;margin-left:-520px;margin-top:-520px;border-radius:999px;border:1px solid rgba(58,47,48,.05)"></span>
  <span style="position:absolute;left:50%;top:352px;width:470px;height:470px;margin-left:-235px;margin-top:-235px;border-radius:999px;background:radial-gradient(circle,rgba(255,111,97,.09),rgba(255,111,97,0) 68%)"></span>
  <!-- GNB -->
  ${gnb()}
  <!-- 플로팅 타일 -->
  ${markTile}
  ${priceTile}
  ${compareTile}
  ${coupleTile}
  <!-- 영웅 본문 -->
  <div style="position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:20px;padding:0 64px 48px;z-index:3">
    <h1 style="font-size:58px;line-height:80px;font-weight:700;color:${esc(INK)};letter-spacing:-2px;margin:0">확인하고,<br>비교해서 골라요</h1>
    <p style="font-size:18px;line-height:28px;color:#6B5F60;margin:0">예식일과 예산만 설정하면 끝. 당신을 위한 맞춤 플랫폼, 웨딩픽</p>
    <div style="display:flex;gap:10px;padding-top:14px">
      ${storeBadge('App Store')}
      ${storeBadge('Google Play')}
    </div>
  </div>
</section>`;
}

/** 기능 소개 섹션 공통. reversed=true면 텍스트가 오른쪽. */
function featureSection(opts: {
  eyebrow: string;
  title: string;
  body: string;
  bg: string;
  reversed?: boolean;
  mockupBg: string;
  mockupContent: string;
}): string {
  const text = `<div style="display:flex;flex-direction:column;gap:20px;flex:1;min-width:0">
    <span style="display:block;width:26px;height:4px;border-radius:2px;background:${esc(C)}"></span>
    <span style="font-size:17px;line-height:24px;color:#6B5F60">${esc(opts.eyebrow)}</span>
    <h2 style="font-size:38px;line-height:54px;font-weight:700;color:${esc(INK)};letter-spacing:-1.2px;margin:0">${opts.title.replace(/\n/g, '<br>')}</h2>
    <p style="font-size:15px;line-height:26px;color:${esc(TER)};margin:0;max-width:400px">${esc(opts.body)}</p>
  </div>`;

  const mockup = `<div style="flex:0 0 290px;width:290px">
    <div style="width:290px;height:540px;border-radius:32px;background:${esc(opts.mockupBg)};box-shadow:0 20px 52px rgba(58,47,48,.16);overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center">
      ${opts.mockupContent}
    </div>
  </div>`;

  const [left, right] = opts.reversed ? [mockup, text] : [text, mockup];

  return `<section style="padding:104px 64px;background:${esc(opts.bg)};display:flex;align-items:center;gap:80px">
  ${left}
  ${right}
</section>`;
}

/** 기능 1 — 가격 확인 */
function feature1(): string {
  const mockupContent = `<div style="width:100%;padding:20px 18px;display:flex;flex-direction:column;gap:12px">
    <span style="font-size:11px;font-weight:700;color:${esc(TER)};letter-spacing:.5px">확인된 정보 12건 · 최근 12개월</span>
    <div style="background:#F7F8FA;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px">
      <span style="font-size:12px;color:${esc(TER)}">기준금액</span>
      <span style="font-size:24px;font-weight:700;color:${esc(INK)};font-variant-numeric:tabular-nums">168만원</span>
      <div style="height:4px;border-radius:2px;background:${esc(BAND)}">
        <div style="width:60%;height:100%;border-radius:2px;background:${esc(C)}"></div>
      </div>
      <span style="font-size:12px;color:${esc(TER)}">152~184만원</span>
    </div>
    <div style="background:#F7F8FA;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:6px">
      <span style="font-size:12px;color:${esc(TER)}">기준금액</span>
      <span style="font-size:24px;font-weight:700;color:${esc(INK)};font-variant-numeric:tabular-nums">92만원</span>
      <div style="height:4px;border-radius:2px;background:${esc(BAND)}">
        <div style="width:40%;height:100%;border-radius:2px;background:${esc(C)};opacity:.5"></div>
      </div>
      <span style="font-size:12px;color:${esc(TER)}">78~110만원</span>
    </div>
  </div>`;

  return featureSection({
    eyebrow: '가격, 일일이 찾지 마세요',
    title: '얼마에 했는지\n먼저 보여드려요',
    body: '직접 제보해 주신 금액 정보를 기반으로 구간과 기준금액을 보여드려요. 업체에 물어보지 않아도 대략의 범위를 먼저 알 수 있어요.',
    bg: '#fff',
    mockupBg: '#F7F8FA',
    mockupContent,
  });
}

/** 기능 2 — 비교 */
function feature2(): string {
  const mockupContent = `<div style="width:100%;padding:16px 14px;display:flex;flex-direction:column;gap:10px">
    ${[
      ['웨딩홀 A', '168만원', 0.92, true],
      ['웨딩홀 B', '134만원', 0.72, false],
      ['웨딩홀 C', '212만원', 1.0, false],
    ].map(([name, price, ratio, picked]) => `
      <div style="background:${picked ? '#FFF0EE' : '#F7F8FA'};border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px;${picked ? `box-shadow:inset 0 0 0 1.5px ${C}` : ''}">
        <span style="flex:1;min-width:0">
          <span style="display:block;font-size:14px;font-weight:700;color:${INK}">${name}</span>
          <span style="display:block;font-size:13px;color:${TER};font-variant-numeric:tabular-nums">${price}</span>
        </span>
        <span style="display:flex;line-height:0;color:${picked ? C : '#ADB1BA'}">${pickMark(18, picked ? C : '#ADB1BA')}</span>
      </div>`).join('')}
  </div>`;

  return featureSection({
    eyebrow: '뭐가 다른지 바로 비교해요',
    title: '다른 점부터\n보여드려요',
    body: '가격 구간, 포함 항목, 별도 확인이 필요한 비용을 한 화면에서 비교해요. 업체마다 전화해서 알아보지 않아도 돼요.',
    bg: FEAT_TINT,
    reversed: true,
    mockupBg: '#fff',
    mockupContent,
  });
}

/** 기능 3 — 커플 Pick */
function feature3(): string {
  const mockupContent = `<div style="width:100%;padding:16px 14px;display:flex;flex-direction:column;gap:10px">
    ${[
      ['웨딩홀 A', true, true],
      ['웨딩홀 B', true, false],
      ['웨딩홀 C', false, true],
    ].map(([name, me, partner]) => `
      <div style="background:#F7F8FA;border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:8px">
        <span style="flex:1;font-size:14px;font-weight:700;color:${INK}">${name}</span>
        <span style="display:flex;gap:4px">
          <span style="display:flex;line-height:0;color:${me ? C : '#ADB1BA'}">${pickMark(16, me ? C : '#ADB1BA')}</span>
          <span style="display:flex;line-height:0;color:${partner ? '#FFDAD5' : '#ADB1BA'}">${pickMark(16, partner ? '#FFDAD5' : '#ADB1BA')}</span>
        </span>
        ${me && partner ? `<span style="font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;background:${C};color:#fff;white-space:nowrap">둘 다 고른 곳</span>` : ''}
      </div>`).join('')}
  </div>`;

  return featureSection({
    eyebrow: '둘이 같이 고르면 더 빨라요',
    title: '둘 다 고른 곳부터\n볼게요',
    body: '각자 Pick하면 둘 다 고른 업체가 먼저 보여요. 의견을 맞추는 데 걸리는 시간을 줄여드려요.',
    bg: '#fff',
    mockupBg: '#F7F8FA',
    mockupContent,
  });
}

/** 다운로드 섹션 */
function downloadSection(): string {
  return `<section id="download" style="padding:104px 64px;background:${esc(HERO_TINT)};display:flex;flex-direction:column;align-items:center;text-align:center;gap:32px">
  <h2 style="font-size:38px;line-height:54px;font-weight:700;color:${esc(INK)};letter-spacing:-1.2px;margin:0">모르고<br>시작할 필요 없어요</h2>
  <p style="font-size:18px;line-height:28px;color:${esc(SEC)};margin:0">예식일과 예산만 알려주시면 웨딩픽이 먼저 골라드려요.</p>
  <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding-top:8px">
    <div style="width:150px;height:150px;border-radius:16px;background:#fff;box-shadow:0 2px 12px rgba(58,47,48,.10);display:flex;align-items:center;justify-content:center">
      <span style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <span style="color:${esc(C)};display:flex;line-height:0">${pickMark(40, C)}</span>
        <span style="font-size:12px;font-weight:700;color:${esc(TER)}">QR 준비 중</span>
      </span>
    </div>
    <div style="display:flex;gap:8px">
      ${storeBadge('App Store')}
      ${storeBadge('Google Play')}
    </div>
  </div>
</section>`;
}

/** Footer — 다크 배경. */
function footer(contactEmail: string | null): string {
  const email = contactEmail ? `<a href="mailto:${esc(contactEmail)}" style="font-size:14px;color:rgba(255,255,255,.5);text-decoration:none">${esc(contactEmail)}</a>` : '';

  return `<footer style="background:${esc(FOOT_INK)};padding:0 64px">
  <div style="display:flex;align-items:center;justify-content:space-between;height:76px;border-bottom:1px solid rgba(255,255,255,.12)">
    <a href="/" style="display:flex;align-items:center;gap:8px;text-decoration:none">
      <span style="color:${esc(C)};display:flex;line-height:0">${pickMark(20, C)}</span>
      <span style="font-size:17px;font-weight:700;color:#fff">웨딩픽</span>
    </a>
    <nav style="display:flex;align-items:center;gap:24px">
      <a href="/intro.html" style="font-size:14px;color:rgba(255,255,255,.6);text-decoration:none;white-space:nowrap">서비스 소개</a>
      <a href="/faq.html" style="font-size:14px;color:rgba(255,255,255,.6);text-decoration:none;white-space:nowrap">자주 묻는 질문</a>
      <a href="/support.html" style="font-size:14px;color:rgba(255,255,255,.6);text-decoration:none;white-space:nowrap">고객지원</a>
    </nav>
    ${email}
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;height:60px">
    <span style="font-size:13px;color:rgba(255,255,255,.4)">© 2026 웨딩픽. All rights reserved.</span>
    <nav style="display:flex;align-items:center;gap:16px">
      <a href="/terms.html" style="font-size:13px;color:rgba(255,255,255,.5);text-decoration:none;white-space:nowrap">이용약관</a>
      <span style="font-size:13px;color:rgba(255,255,255,.2)">·</span>
      <a href="/privacy.html" style="font-size:13px;color:rgba(255,255,255,.5);text-decoration:none;white-space:nowrap">개인정보처리방침</a>
    </nav>
  </div>
</footer>`;
}

/** favicon/manifest 링크 태그 묶음. */
export function faviconTags(): string {
  return `<link rel="icon" type="image/png" href="/assets/favicon-16.png" sizes="16x16">
<link rel="icon" type="image/png" href="/assets/favicon-32.png" sizes="32x32">
<link rel="icon" type="image/png" href="/assets/favicon-48.png" sizes="48x48">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="manifest" href="/assets/site.webmanifest">
<meta name="theme-color" content="#FF6F61">`;
}

/** 랜딩 v4 전체 페이지. */
export function renderLandingV4(): string {
  const FONT_STACK =
    "-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>웨딩픽 — 확인하고 비교해서 골라요</title>
<meta name="description" content="웨딩픽이 먼저 골라주고 사용자는 비교해서 Pick해요. 확인된 제보 금액으로 예산에 맞는 웨딩업체를 찾아보세요.">
<meta property="og:title" content="웨딩픽 — 확인하고 비교해서 골라요">
<meta property="og:description" content="웨딩픽이 먼저 골라주고 사용자는 비교해서 Pick해요.">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
${faviconTags()}
<style>
*,::before,::after{box-sizing:border-box}
html{font-family:${FONT_STACK};font-size:16px;-webkit-text-size-adjust:100%}
body{margin:0;background:#f7f8fa;color:${INK}}
a{color:inherit}
.page{width:1280px;margin:0 auto;background:#fff;box-shadow:0 10px 40px rgba(58,47,48,.10);display:flex;flex-direction:column}
</style>
</head>
<body>
<div class="page">
  ${hero()}
  ${feature1()}
  ${feature2()}
  ${feature3()}
  ${downloadSection()}
  ${footer(CONTACT_EMAIL)}
</div>
</body>
</html>
`;
}
