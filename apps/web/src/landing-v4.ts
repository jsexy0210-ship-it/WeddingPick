import { socialMeta, SHARE_TITLE, SHARE_DESCRIPTION } from './social-meta';
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

/**
 * 랜딩이 보여주는 업체 정보. **고정값이고 API에서 받지 않는다.**
 *
 * 랜딩은 검색으로 처음 들어온 사람이 보는 화면이라, 서버가 자거나 빌드 때
 * `WEDDINGPICK_API_URL`이 비어 있어도 «정보를 모으는 중»이 되면 안 된다. 실제
 * 업체 정보를 쓰는 화면은 `search.html`과 업체 상세(`/v/*.html`)이고, 그쪽은
 * `site-data.ts`가 API에서 받아온다 — 두 경로를 섞지 않는다.
 *
 * 값은 디자인 핸드오프 `19-landing.dc.html`의 목업 그대로다. 금액 줄만 CLAUDE.md
 * §3 "금액 표기 (고정)"을 따른다(«확인된 정보 N건 · 최근 12개월 · 기준금액 …»).
 */
const LANDING_VENDORS = {
  /** 기능 1 — 오늘의 Pick 카드. */
  today: {
    label: '오늘의 Pick',
    name: '강남 A 스튜디오',
    range: '152~184만원',
    meta: '확인된 정보 12건 · 최근 12개월 · 기준금액 168만원',
    reasons: ['고른 사진이랑 가장 비슷해요', '원하는 날에 가능해요', '생각한 예산 안에 들어와요'],
    cta: 'Pick하기',
  },
  /** 기능 2 — 3곳 비교. 항목마다 어느 곳이 나은지 표시한다. */
  compare: {
    title: '스튜디오 3곳 비교',
    lead: '보정 장수가 가장 크게 갈려요',
    names: ['스튜디오-A', '스튜디오-B', '스튜디오-C'],
    blocks: [
      { label: '확인된 금액', values: [['152~184만', true], ['138~171만', true], ['165~203만', true]] },
      { label: '보정 장수', values: [['20장', true], ['15장', false], ['25장', true]] },
      { label: '5월 주말', values: [['가능', true], ['가능', true], ['대기', false]] },
    ],
  },
  /** 기능 3 — 둘이 함께 고른 Pick. */
  picks: {
    title: '스튜디오 Pick',
    lead: '3곳 중 2곳은 준호님도 골랐어요',
    cards: [
      { name: '강남 A 스튜디오', price: '152~184만원', both: true },
      { name: '서촌 B 스튜디오', price: '138~171만원', both: true },
      { name: '청담 C 스튜디오', price: '165~203만원', both: false },
    ],
    memoBy: '준호님 메모',
    memo: '여기 사진 느낌이 제일 좋은듯?',
    cta: '2곳 비교하기',
  },
} as const;

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
  return `<header class="lv-gnb">
  <a href="/" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit;flex-shrink:0">
    <span style="color:${esc(C)};display:flex;line-height:0">${pickMark(22, C)}</span>
    <span style="font-size:19px;font-weight:700;color:${esc(INK)}">웨딩픽</span>
  </a>
  <input type="checkbox" id="lv-cb" class="lv-ham-cb" aria-hidden="true">
  <nav class="lv-gnb-nav">
    <a href="/intro.html" style="font-size:16px;line-height:22px;color:${esc(SEC)};text-decoration:none;white-space:nowrap">서비스 소개</a>
    <a href="/faq.html" style="font-size:16px;line-height:22px;color:${esc(SEC)};text-decoration:none;white-space:nowrap">자주 묻는 질문</a>
    <a href="/support.html" style="font-size:16px;line-height:22px;color:${esc(SEC)};text-decoration:none;white-space:nowrap">고객지원</a>
  </nav>
  <a href="#download" class="lv-cta-btn" style="border-radius:999px;background:${esc(C)};color:#fff;display:inline-flex;align-items:center;font-size:15px;font-weight:700;text-decoration:none;white-space:nowrap">앱 다운로드</a>
  <label for="lv-cb" class="lv-ham-btn" aria-label="메뉴 열기">
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M3 6h16M3 11h16M3 16h16" stroke="${esc(INK)}" stroke-width="1.8" stroke-linecap="round"/></svg>
  </label>
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

  return `<section class="lv-hero">
  <!-- 궤도 링 (태블릿 이하 숨김) -->
  <span class="lv-orbit" style="position:absolute;left:50%;top:352px;width:760px;height:760px;margin-left:-380px;margin-top:-380px;border-radius:999px;border:1px solid rgba(58,47,48,.07)"></span>
  <span class="lv-orbit" style="position:absolute;left:50%;top:352px;width:1040px;height:1040px;margin-left:-520px;margin-top:-520px;border-radius:999px;border:1px solid rgba(58,47,48,.05)"></span>
  <span class="lv-orbit" style="position:absolute;left:50%;top:352px;width:470px;height:470px;margin-left:-235px;margin-top:-235px;border-radius:999px;background:radial-gradient(circle,rgba(255,111,97,.09),rgba(255,111,97,0) 68%)"></span>
  <!-- GNB -->
  ${gnb()}
  <!-- 플로팅 타일 (태블릿 이하 숨김) -->
  <div class="lv-tiles">
    ${markTile}
    ${priceTile}
    ${compareTile}
    ${coupleTile}
  </div>
  <!-- 영웅 본문 -->
  <div class="lv-hero-inner">
    <h1 class="lv-hero-h1">확인하고,<br>비교해서 골라요</h1>
    <p style="font-size:18px;line-height:28px;color:#6B5F60;margin:0">예식일과 예산만 설정하면 끝. 당신을 위한 맞춤 플랫폼, 웨딩픽</p>
    <div style="display:flex;gap:10px;padding-top:14px;flex-wrap:wrap;justify-content:center">
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
  const text = `<div class="lv-feat-text">
    <span style="display:block;width:26px;height:4px;border-radius:2px;background:${esc(C)}"></span>
    <span style="font-size:17px;line-height:24px;color:#6B5F60">${esc(opts.eyebrow)}</span>
    <h2 class="lv-feat-h2">${opts.title.replace(/\n/g, '<br>')}</h2>
    <p style="font-size:15px;line-height:26px;color:${esc(TER)};margin:0;max-width:400px">${esc(opts.body)}</p>
  </div>`;

  const mockup = `<div class="lv-feat-mockup">
    <div style="width:100%;max-width:290px;height:540px;border-radius:32px;background:${esc(opts.mockupBg)};box-shadow:0 20px 52px rgba(58,47,48,.16);overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto">
      ${opts.mockupContent}
    </div>
  </div>`;

  const [left, right] = opts.reversed ? [mockup, text] : [text, mockup];

  return `<section class="lv-feat${opts.reversed ? ' lv-feat-rev' : ''}" style="background:${esc(opts.bg)}">
  ${left}
  ${right}
</section>`;
}

/** 기능 1 — 가격 확인 */
function feature1(): string {
  const v = LANDING_VENDORS.today;
  const reasons = v.reasons
    .map(
      (reason) => `
      <span style="display:flex;align-items:center;gap:7px">
        <span style="width:15px;height:15px;flex:0 0 15px;border-radius:999px;background:${esc(C)};color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center">✓</span>
        <span style="font-size:12px;line-height:17px;color:${esc(SEC)}">${esc(reason)}</span>
      </span>`
    )
    .join('');

  const mockupContent = `<div style="width:100%;padding:20px 18px;display:flex;flex-direction:column;gap:12px">
    <span style="font-size:11px;font-weight:700;color:${esc(C)};letter-spacing:.5px">${esc(v.label)}</span>
    <div style="background:#fff;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:inset 0 0 0 1px #EAEBEE">
      <span style="font-size:15px;font-weight:700;color:${esc(INK)}">${esc(v.name)}</span>
      <span style="font-size:24px;font-weight:700;color:${esc(INK)};font-variant-numeric:tabular-nums">${esc(v.range)}</span>
      <span style="font-size:11px;line-height:16px;color:${esc(TER)};font-variant-numeric:tabular-nums">${esc(v.meta)}</span>
      <span style="display:block;height:1px;background:${esc(BAND)}"></span>
      <span style="display:flex;flex-direction:column;gap:6px">${reasons}</span>
      <span style="margin-top:2px;height:34px;border-radius:8px;background:${esc(C)};color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px">
        <span style="display:flex;line-height:0">${pickMark(15, '#fff')}</span>${esc(v.cta)}
      </span>
    </div>
  </div>`;

  return featureSection({
    eyebrow: '가격, 일일이 찾지 마세요',
    title: '얼마에 했는지\n먼저 보여드려요',
    body: '직접 제보해 주신 금액 정보를 기반으로 구간과 기준금액을 보여드려요. 업체에 물어보지 않아도 금액 범위를 먼저 알 수 있어요.',
    bg: '#fff',
    mockupBg: '#F7F8FA',
    mockupContent,
  });
}

/** 기능 2 — 비교 */
function feature2(): string {
  const cmp = LANDING_VENDORS.compare;
  const blocks = cmp.blocks
    .map(
      (block) => `
      <div style="background:#F7F8FA;border-radius:10px;padding:11px 12px;display:flex;flex-direction:column;gap:7px">
        <span style="font-size:11px;font-weight:700;color:${esc(TER)}">${esc(block.label)}</span>
        ${block.values
          .map(
            ([value, best], index) => `
          <span style="display:flex;align-items:center;gap:7px">
            <span style="width:15px;height:15px;flex:0 0 15px;border-radius:999px;background:${best ? esc(C) : '#DCDEE3'};color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center">${best ? '✓' : ''}</span>
            <span style="flex:1;min-width:0;font-size:12px;color:${esc(SEC)};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cmp.names[index] ?? '')}</span>
            <span style="font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;color:${best ? esc(INK) : esc(TER)}">${esc(String(value))}</span>
          </span>`
          )
          .join('')}
      </div>`
    )
    .join('');

  const mockupContent = `<div style="width:100%;padding:16px 14px;display:flex;flex-direction:column;gap:9px">
    <span style="font-size:13px;font-weight:700;color:${esc(INK)}">${esc(cmp.title)}</span>
    <span style="font-size:11px;color:${esc(C)};font-weight:700">${esc(cmp.lead)}</span>
    ${blocks}
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
  const picks = LANDING_VENDORS.picks;
  const cards = picks.cards
    .map(
      (card) => `
      <div style="border-radius:9px;padding:10px;display:flex;align-items:center;gap:8px;background:#fff;box-shadow:inset 0 0 0 ${card.both ? `1.4px ${esc(C)}` : '1px #EAEBEE'}">
        <span style="width:18px;height:18px;flex:0 0 18px;border-radius:5px;display:flex;align-items:center;justify-content:center;${card.both ? `background:${esc(C)}` : 'box-shadow:inset 0 0 0 1.2px #DCDEE3'}">${card.both ? `<span style="display:flex;line-height:0">${pickMark(12, '#fff')}</span>` : ''}</span>
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
          <span style="font-size:10px;line-height:14px;font-weight:700;padding:1px 5px;border-radius:3px;align-self:flex-start;${card.both ? `background:#FFE9E6;color:${esc(C)}` : 'background:#F2F3F6;color:#868B94'}">${card.both ? '둘 다 고른 곳' : '나만 고른 곳'}</span>
          <span style="font-size:13px;font-weight:700;color:${esc(INK)};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(card.name)}</span>
          <span style="font-size:11px;color:${esc(TER)};font-variant-numeric:tabular-nums">${esc(card.price)}</span>
        </span>
      </div>`
    )
    .join('');

  const mockupContent = `<div style="width:100%;padding:16px 14px;display:flex;flex-direction:column;gap:9px">
    <span style="font-size:13px;font-weight:700;color:${esc(INK)}">${esc(picks.title)}</span>
    <span style="font-size:11px;font-weight:700;color:${esc(C)}">${esc(picks.lead)}</span>
    ${cards}
    <div style="background:#F7F8FA;border-radius:9px;padding:9px 10px;display:flex;flex-direction:column;gap:3px">
      <span style="font-size:10px;font-weight:700;color:${esc(TER)}">${esc(picks.memoBy)}</span>
      <span style="font-size:12px;line-height:17px;color:${esc(SEC)}">${esc(picks.memo)}</span>
    </div>
    <span style="height:32px;border-radius:8px;background:${esc(INK)};color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center">${esc(picks.cta)}</span>
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
  return `<section id="download" class="lv-dl" style="background:${esc(HERO_TINT)}">
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

  return `<footer class="lv-foot" style="background:${esc(FOOT_INK)}">
  <div class="lv-foot-top">
    <a href="/" style="display:flex;align-items:center;gap:8px;text-decoration:none;flex-shrink:0">
      <span style="color:${esc(C)};display:flex;line-height:0">${pickMark(20, C)}</span>
      <span style="font-size:17px;font-weight:700;color:#fff">웨딩픽</span>
    </a>
    <nav class="lv-foot-nav">
      <a href="/intro.html" style="font-size:14px;color:rgba(255,255,255,.6);text-decoration:none;white-space:nowrap">서비스 소개</a>
      <a href="/faq.html" style="font-size:14px;color:rgba(255,255,255,.6);text-decoration:none;white-space:nowrap">자주 묻는 질문</a>
      <a href="/support.html" style="font-size:14px;color:rgba(255,255,255,.6);text-decoration:none;white-space:nowrap">고객지원</a>
    </nav>
    ${email}
  </div>
  <div class="lv-foot-bot">
    <span style="font-size:13px;color:rgba(255,255,255,.4)">© 2026 웨딩픽. All rights reserved.</span>
    <nav class="lv-foot-policy">
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
<title>${SHARE_TITLE}</title>
<meta name="description" content="${SHARE_DESCRIPTION}">
${socialMeta()}
${faviconTags()}
<style>
*,::before,::after{box-sizing:border-box}
html{font-family:${FONT_STACK};font-size:16px;-webkit-text-size-adjust:100%}
body{margin:0;background:#f7f8fa;color:${INK}}
a{color:inherit}
/* 풀 와이드. 1280 카드로 가운데 세우면 넓은 화면에서 양옆이 남아 비율이 어긋나 보인다. */
.page{width:100%;margin:0;background:#fff;display:flex;flex-direction:column;overflow-x:hidden}

/* GNB */
.lv-gnb{position:relative;height:76px;flex:0 0 76px;display:flex;align-items:center;justify-content:space-between;padding:0 64px;z-index:10;gap:32px}
.lv-gnb-nav{display:flex;align-items:center;gap:32px;flex:1;justify-content:center}
.lv-ham-cb{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.lv-ham-btn{display:none;background:none;border:none;padding:8px;cursor:pointer;line-height:0;flex-shrink:0}
.lv-cta-btn{height:38px;padding:0 18px;flex-shrink:0}

/* Hero */
.lv-hero{position:relative;height:640px;overflow:hidden;display:flex;flex-direction:column;background:${HERO_TINT}}
.lv-tiles{position:absolute;inset:0;pointer-events:none}
.lv-orbit{position:absolute}
.lv-hero-inner{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:20px;padding:0 64px 48px;z-index:3}
.lv-hero-h1{font-size:58px;line-height:80px;font-weight:700;color:${INK};letter-spacing:-2px;margin:0}

/* Feature sections */
.lv-feat{padding:104px 64px;display:flex;align-items:center;gap:80px}
.lv-feat-rev{flex-direction:row-reverse}
.lv-feat-text{display:flex;flex-direction:column;gap:20px;flex:1;min-width:0}
.lv-feat-h2{font-size:38px;line-height:54px;font-weight:700;color:${INK};letter-spacing:-1.2px;margin:0}
.lv-feat-mockup{flex:0 0 290px;width:290px}

/* Download */
.lv-dl{padding:104px 64px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:32px}

/* Footer */
.lv-foot{padding:0 64px}
.lv-foot-top{display:flex;align-items:center;justify-content:space-between;height:76px;border-bottom:1px solid rgba(255,255,255,.12);gap:24px}
.lv-foot-nav{display:flex;align-items:center;gap:24px;flex:1;justify-content:center}
.lv-foot-bot{display:flex;align-items:center;justify-content:space-between;height:60px;gap:16px}
.lv-foot-policy{display:flex;align-items:center;gap:16px}

/* Tablet (≤1023px) */
@media(max-width:1023px){
  .lv-gnb{padding:0 32px}
  .lv-hero{height:auto;min-height:480px}
  .lv-tiles,.lv-orbit{display:none}
  .lv-hero-inner{padding:48px 32px}
  .lv-hero-h1{font-size:46px;line-height:64px;letter-spacing:-1.5px}
  .lv-feat{padding:80px 32px;gap:48px}
  .lv-feat-h2{font-size:32px;line-height:46px}
  .lv-dl{padding:80px 32px}
  .lv-foot{padding:0 32px}
}

/* Mobile (≤767px) */
@media(max-width:767px){
  .lv-gnb{padding:0 24px;height:64px;flex:0 0 64px;gap:0}
  .lv-gnb-nav{
    display:none;position:absolute;top:64px;left:0;right:0;
    flex-direction:column;align-items:flex-start;gap:0;flex:none;
    background:#fff;border-top:1px solid #EAEBEE;
    box-shadow:0 8px 24px rgba(58,47,48,.12);z-index:99
  }
  .lv-gnb-nav a{display:block;padding:16px 24px;width:100%;font-size:16px !important;border-bottom:1px solid #f0f1f3}
  .lv-ham-cb:checked~.lv-gnb-nav{display:flex}
  .lv-ham-btn{display:flex;margin-left:auto;margin-right:8px}
  .lv-cta-btn{font-size:14px !important;height:36px;padding:0 14px}
  .lv-hero{min-height:320px}
  .lv-hero-inner{padding:40px 24px}
  .lv-hero-h1{font-size:34px;line-height:48px;letter-spacing:-1px}
  .lv-feat{padding:56px 24px;flex-direction:column;gap:36px}
  .lv-feat-rev{flex-direction:column}
  .lv-feat-mockup{flex:none;width:100%}
  .lv-feat-h2{font-size:28px;line-height:40px}
  .lv-dl{padding:56px 24px}
  .lv-foot{padding:0 24px}
  .lv-foot-top{height:auto;padding:20px 0;flex-direction:column;align-items:flex-start;gap:12px}
  .lv-foot-nav{flex-direction:column;align-items:flex-start;gap:8px;flex:none;justify-content:flex-start}
  .lv-foot-bot{height:auto;padding:16px 0;flex-direction:column;align-items:flex-start;gap:8px}
}

/* Small mobile (≤479px) */
@media(max-width:479px){
  .lv-hero-h1{font-size:28px;line-height:40px}
  .lv-feat-h2{font-size:24px;line-height:34px}
}
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
