import {
  ANALYSIS_DISCLAIMER,
  ANALYSIS_FACTS,
  INQUIRY_CATEGORIES,
  INQUIRY_CATEGORY_RULES,
  HALL_CANCELLATION_STANDARD,
  POLICY_DOCUMENTS,
  PRICING_POLICY,
  VERIFICATION_LEVELS,
  VERIFICATION_LEVEL_RULES,
  formatAttribution,
  inquiryAcknowledgement,
  listDataSources,
} from '@weddingpick/domain';

import { BRAND, CONTACT_EMAIL, LEAD, STEPS } from './content';

/** 본문에 들어가는 모든 값은 이걸 거친다. 도메인에서 온 문자열도 예외가 아니다. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function section(id: string, title: string, body: string): string {
  return `<section id="${id}" class="section">
      <h2>${escapeHtml(title)}</h2>
      ${body}
    </section>`;
}

function cards(items: readonly { title: string; body: string }[]): string {
  return `<div class="cards">${items
    .map(
      (item) => `<article class="card">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
      </article>`
    )
    .join('')}</div>`;
}

/** 확인 단계. 어느 등급부터 시장가격에 반영되는지가 이 표의 요점이다. */
function verificationTable(): string {
  const rows = VERIFICATION_LEVELS.map((level) => {
    const rule = VERIFICATION_LEVEL_RULES[level];

    return `<tr>
        <th scope="row">${escapeHtml(rule.label)}</th>
        <td>${escapeHtml(rule.condition)}</td>
        <td>${rule.affectsMarketPrice ? '가격 비교에 반영' : '반영하지 않음'}</td>
      </tr>`;
  }).join('');

  return `<div class="table-scroll">
      <table>
        <caption>확인 단계와 가격 비교 반영 여부</caption>
        <thead>
          <tr><th scope="col">단계</th><th scope="col">조건</th><th scope="col">가격 비교</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/** 공개된 취소 위약금 기준. 앱이 견적서 조항과 견주는 그 표다. */
function cancellationBand(index: number): string {
  const band = HALL_CANCELLATION_STANDARD[index]!;
  const previous = HALL_CANCELLATION_STANDARD[index - 1];

  if (!previous) {
    return `예식 ${band.minDaysBefore}일 전 이전`;
  }

  if (band.minDaysBefore === 0) {
    return `예식 ${previous.minDaysBefore - 1}일 전 이후`;
  }

  return `예식 ${previous.minDaysBefore - 1}~${band.minDaysBefore}일 전`;
}

function cancellationTable(): string {
  const rows = HALL_CANCELLATION_STANDARD.map(
    (band, index) => `<tr>
        <th scope="row">${escapeHtml(cancellationBand(index))}</th>
        <td>${escapeHtml(band.note)}</td>
      </tr>`
  ).join('');

  return `<div class="table-scroll">
      <table>
        <caption>예식업 취소 위약금 기준 (공정거래위원회 소비자분쟁해결기준)</caption>
        <thead>
          <tr><th scope="col">취소 시점</th><th scope="col">기준 위약금</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function sourceList(): string {
  return `<ul class="sources">${listDataSources()
    .map(
      (source) => `<li>
        <strong>${escapeHtml(formatAttribution(source))}</strong>
        <span>쓰이는 곳: ${escapeHtml(source.usedFor)}</span>
        ${
          source.url
            ? `<a href="${escapeHtml(source.url)}" rel="noreferrer noopener">원문 보기</a>`
            : ''
        }
      </li>`
    )
    .join('')}</ul>`;
}

function policyList(): string {
  return `<ul class="policies">${POLICY_DOCUMENTS.map(
    (policy) => `<li>
        <strong>${escapeHtml(policy.title)}</strong>
        <span class="status">${escapeHtml(policy.status)}</span>
        <span>${escapeHtml(policy.note)}</span>
        ${
          policy.url
            ? `<a href="${escapeHtml(policy.url)}">전문 보기</a>`
            : '<span class="pending">확정본이 없어 아직 게시하지 않았습니다.</span>'
        }
      </li>`
  ).join('')}</ul>`;
}

function contact(): string {
  const inApp = `<p>앱에서 <strong>MY → 문의하기</strong>로 보내실 수 있습니다. 받는 것:</p>
    <ul class="plain">${INQUIRY_CATEGORIES.map(
      (category) =>
        `<li><strong>${escapeHtml(INQUIRY_CATEGORY_RULES[category].label)}</strong> — ${escapeHtml(
          INQUIRY_CATEGORY_RULES[category].description
        )}</li>`
    ).join('')}</ul>
    <p>${escapeHtml(inquiryAcknowledgement())}</p>`;

  if (!CONTACT_EMAIL) {
    /*
     * 지어낸 주소를 붙이면 사람들이 받지 않는 곳으로 편지를 보낸다.
     *
     * 앱 밖에서 연락할 방법이 아직 없다는 것도 그대로 적는다 — 앱을 쓰지 않는 사람,
     * 특히 검색에서 자기 이름을 발견한 플래너에게는 이게 유일한 길이어야 한다.
     */
    return `${inApp}
      <p class="pending">앱을 쓰지 않고 연락할 방법은 아직 마련하지 못했습니다. 주소가 정해지면 여기에 적겠습니다.</p>`;
  }

  return `${inApp}
    <p>앱 밖에서는 <a href="mailto:${escapeHtml(CONTACT_EMAIL)}">${escapeHtml(
      CONTACT_EMAIL
    )}</a>로 보내주세요.</p>`;
}

export function renderLandingPage(styles: string): string {
  const title = `${BRAND.name} — ${BRAND.message}`;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(BRAND.description)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(BRAND.description)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
<style>${styles}</style>
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>

<header class="hero">
  <p class="brand">${escapeHtml(BRAND.name)} <span>${escapeHtml(BRAND.latinName)}</span></p>
  <h1>${escapeHtml(BRAND.message)}</h1>
  <p class="lead">${escapeHtml(LEAD)}</p>
  <p class="note">아직 출시 전입니다. 아래는 웨딩픽이 무엇을 하고 무엇을 하지 않는지에 대한 설명입니다.</p>
</header>

<main id="main">
  ${section('how', '어떻게 동작하나요', cards(STEPS))}

  ${section(
    'comparison',
    '가격은 어떻게 비교하나요',
    `<p>확인된 실제 계약만 모아 중앙값을 냅니다. 표본이 ${
      PRICING_POLICY.minimumSampleCount
    }건에 못 미치면 중앙값을 보여주지 않고, 왜 보여줄 수 없는지 알려드립니다. 가격을 보여드릴 때는 몇 건을 모았고 어느 기간인지 함께 적습니다.</p>
    ${verificationTable()}`
  )}

  ${section(
    'standards',
    '공개된 기준과 견줍니다',
    `<p>견적서의 취소·환불 조건을 공개된 소비자 보호 기준과 나란히 놓고 보여드립니다. 법률 판단이 아니라, 계약 전에 물어볼 거리를 드리는 것입니다.</p>
    ${cancellationTable()}`
  )}

  ${section(
    'analysis-notice',
    '분석 안내',
    `<p>웨딩픽이 견적서를 어떻게 읽고, 무엇을 보장하지 않는지입니다. 앱 안에서도 같은 글을 보여드립니다.</p>
    ${cards(ANALYSIS_FACTS)}`
  )}

  ${section(
    'sources',
    '자료 출처',
    `<p>웨딩픽이 비교와 대조에 쓰는 바깥 자료입니다. 기관이 자료를 고치면 내용도 달라질 수 있어 마지막으로 확인한 날짜를 함께 적습니다.</p>
    ${sourceList()}`
  )}

  ${section(
    'policies',
    '약관 및 정책',
    `<p>서비스 오픈 전까지 확정해야 하는 문서입니다. 확정본이 없는 것은 없다고 적습니다.</p>
    ${policyList()}`
  )}

  ${section('contact', '문의', contact())}
</main>

<footer>
  <p>${escapeHtml(BRAND.name)} (${escapeHtml(BRAND.latinName)})</p>
  <p>${escapeHtml(ANALYSIS_DISCLAIMER)}</p>
</footer>
</body>
</html>
`;
}
