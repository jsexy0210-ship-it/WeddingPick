/**
 * WP-WEB-003 업체 상세.
 *
 * **자리의 순서를 이 파일이 정하지 않는다.** `VENDOR_DETAIL_SECTIONS`(통합정책
 * §8)가 앱·웹·IA가 함께 보는 목록이고, 화면은 그것을 그대로 훑는다. 순서를 화면
 * 코드에 두면 앱을 고칠 때 웹이 남고, 어느 쪽이 맞는지 물어볼 곳이 없어진다.
 *
 * 자료가 아직 없는 자리는 **목록에서 지우지 않고 왜 비었는지 적는다.** 회색 자리를
 * 뚫어두는 것은 정책이 막았고, 지워버리면 자료가 생기는 날 어디에 넣을지 다시
 * 정해야 한다.
 */

import {
  NOT_ENOUGH_DATA,
  TERMS,
  VENDOR_CATEGORY_LABEL,
  VENDOR_DETAIL_SECTIONS,
  manwon,
  rangeLabel,
} from '@weddingpick/domain';
import type { VendorDetail } from '@weddingpick/api-contract';

import { escapeHtml } from './page';
import { APP_HANDOFF, CORRECTION_NOTE, SITE } from './site-content';
import { siteDocument } from './site-chrome';

/** 본문 기둥에 그리는 자리. 나머지는 우측 기둥이나 창구 안내가 맡는다. */
const MAIN_COLUMN_KEYS = [
  'hero_image',
  'name',
  'key_conditions',
  'recommend_reason',
  'vendor_notice',
  'benefits',
  'experience',
  'reviews',
] as const;

type Section = (typeof VENDOR_DETAIL_SECTIONS)[number];
type SectionKey = Section['key'];

/**
 * 자리마다 붙은 «왜 아직 없는지».
 *
 * **`ready`인 자리의 `note`는 화면에 내지 않는다.** 그건 우리끼리 적어둔 말이고
 * (`주차·식대·보증인원 같은 항목은 vendor-fact.ts가 목록을 갖는다`), 그대로
 * 내보내면 시스템이 자기 사정을 사용자에게 설명하는 꼴이 된다.
 */
function sectionNote(section: Section): string | undefined {
  if (section.ready) return undefined;

  return 'note' in section ? section.note : undefined;
}

/**
 * 웹에 내려오지 않는 자리.
 *
 * 자료 자체가 없는 자리(`ready:false`)는 도메인이 적어둔 말을 그대로 쓰고, 자료는
 * 있지만 웹의 응답에 실리지 않는 자리는 어디서 볼 수 있는지 적는다. 둘을 한
 * 문장으로 뭉치지 않는다 — «아직 없다»와 «여기서는 안 보인다»는 다른 말이다.
 */
const ON_APP_ONLY = '앱에서 볼 수 있어요';

function pending(label: string, note: string | undefined): string {
  return `<div class="block">
      <h3>${escapeHtml(label)}</h3>
      <p class="pending">${escapeHtml(note ?? `${label}는 ${ON_APP_ONLY}.`)}</p>
    </div>`;
}

/** 업체명 자리. 이름과 함께 업종·지역까지가 «무엇을 보고 있는지»다. */
function nameBlock(vendor: VendorDetail): string {
  const where = [VENDOR_CATEGORY_LABEL[vendor.category], vendor.region]
    .filter(Boolean)
    .join(' · ');

  return `<div class="detail-head">
      <h1>${escapeHtml(vendor.name)}</h1>
      <p class="lead">${escapeHtml(where)}</p>
    </div>`;
}

/**
 * 이용한 사람들의 경험.
 *
 * 확인된 후기만 들어간다. 모자라면 점수를 만들지 않는다 — 표가 모자란 100%는
 * 정보가 아니다.
 */
function experienceBlock(vendor: VendorDetail): string {
  const score = vendor.usageScore;

  if (!score.available) {
    return `<div class="block">
        <h3>${escapeHtml(TERMS.experience)}</h3>
        <p class="pending">${escapeHtml(score.reason)}</p>
      </div>`;
  }

  const aspects = score.aspects
    .map(
      (aspect) =>
        `<div><dt>${escapeHtml(aspect.label)}</dt><dd>${aspect.average.toFixed(1)}</dd></div>`
    )
    .join('');

  return `<div class="block">
      <h3>${escapeHtml(TERMS.experience)}</h3>
      <b class="amount">${score.average.toFixed(1)}</b>
      <p class="caption">${escapeHtml(`${TERMS.review} ${score.count}건`)}</p>
      ${aspects ? `<dl class="rows">${aspects}</dl>` : ''}
    </div>`;
}

/**
 * 계약 중앙값이 나온 상품들.
 *
 * 기준에 못 미치는 상품은 API가 아예 내려보내지 않는다 — 중앙값 없는 상품 이름만
 * 늘어놓으면 화면이 그것을 가격으로 그릴 여지가 생긴다.
 */
function productsBlock(vendor: VendorDetail): string {
  const products = vendor.prices.products;

  if (products.length === 0) return '';

  const rows = products
    .map(
      (product) => `<div>
        <dt>${escapeHtml(product.productLabel)}</dt>
        <dd>${escapeHtml(manwon(product.stat.median))}</dd>
      </div>`
    )
    .join('');

  return `<div class="block">
      <h3>${escapeHtml(`확인된 계약 ${TERMS.baseAmount}`)}</h3>
      <dl class="rows">${rows}</dl>
      <p class="note">${escapeHtml(
        `사람이 확인한 계약에서 나온 ${TERMS.baseAmount}이에요. 결제내역에서 읽은 ${TERMS.verifiedData}와는 다른 숫자예요.`
      )}</p>
    </div>`;
}

function mainSection(key: SectionKey, label: string, note: string | undefined, vendor: VendorDetail): string {
  switch (key) {
    case 'hero_image':
      /* 자리를 남기고 왜 비었는지 적는다. 카테고리 기본 이미지도 만들지 않았다. */
      return `<div class="shot shot-hero">${escapeHtml(note ?? NOT_ENOUGH_DATA)}</div>`;

    case 'name':
      return nameBlock(vendor);

    case 'key_conditions':
      /*
       * 항목 목록은 `vendor-fact.ts`가 갖고 있지만 웹의 업체 응답에는 실리지
       * 않는다. 웹에서 목록을 다시 적으면 앱과 갈라지므로 어디서 보는지만 적는다.
       */
      return `<div class="block">
          <h3>${escapeHtml(label)}</h3>
          <p class="pending">${escapeHtml(
            `주차 · 식대 · 보증인원 같은 조건은 ${ON_APP_ONLY}.`
          )}</p>
        </div>`;

    case 'experience':
      return experienceBlock(vendor);

    case 'reviews':
      return `<div class="block">
          <h3>${escapeHtml(TERMS.review)}</h3>
          <p class="pending">${escapeHtml(
            `${TERMS.review}와 업체 반론은 앱에서 볼 수 있어요.`
          )}</p>
        </div>`;

    default:
      return pending(label, note);
  }
}

/**
 * 우측 기둥의 실 제보 카드.
 *
 * 금액 옆에는 **늘 캡션이 함께 간다** — 몇 건이고 어느 기간인지. 숫자만 떼어놓으면
 * 그것이 어디서 왔는지 모르는 채로 읽히고, 그때부터 우리가 정한 값처럼 보인다.
 * 캡션은 도메인이 만들어 API가 내려준 것을 그대로 쓴다.
 */
function verifiedCard(vendor: VendorDetail): string {
  const paid = vendor.prices.paidPrice;

  const amount =
    paid.stage === 'collecting'
      ? `<b class="amount none">${escapeHtml(NOT_ENOUGH_DATA)}</b>`
      : `<b class="amount">${escapeHtml(rangeLabel(paid.low, paid.high))}</b>`;

  return `<div class="card-outline">
      <h2>${escapeHtml(TERMS.verifiedData)}</h2>
      ${amount}
      <p class="caption">${escapeHtml(paid.caption)}</p>
      <div class="rule"></div>
      <!--
        화면당 Primary CTA 하나. Pick이 가장 중요한 행동이고 비교는 보조다.
        둘 다 앱으로 이어진다 — 웹에서 눌러 끝낼 수 있는 것처럼 보이지 않게 한다.
      -->
      <a class="btn btn-primary btn-full" href="#app">${escapeHtml(APP_HANDOFF.pick)}</a>
      <a class="btn btn-ghost btn-full" href="#app">${escapeHtml(APP_HANDOFF.compare)}</a>
      <p class="note">${escapeHtml(APP_HANDOFF.note)}</p>
    </div>`;
}

/**
 * 공식정보.
 *
 * **아는 것만 적는다.** 연락처와 영업상태는 우리에게 내려오는 값이 아니라서 줄을
 * 만들지 않는다 — 빈 줄을 만들어두면 언젠가 누가 채우고, 그게 확인하지 않은
 * 정보가 된다. 출처가 있으면 밝힌다(공공누리는 유형과 무관하게 출처 표시를
 * 요구한다).
 */
function officialCard(vendor: VendorDetail): string {
  const verified = new Date(vendor.lastVerifiedAt);

  const facts = [
    { label: '업종', value: VENDOR_CATEGORY_LABEL[vendor.category] },
    { label: '지역', value: vendor.region },
    {
      label: '마지막 확인',
      value: `${verified.getFullYear()}년 ${verified.getMonth() + 1}월 ${verified.getDate()}일`,
    },
  ]
    .map(
      (fact) =>
        `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`
    )
    .join('');

  return `<div class="card-plain">
      <h2>공식정보</h2>
      <dl class="facts">${facts}</dl>
      ${vendor.sourceNote ? `<p class="note">${escapeHtml(vendor.sourceNote)}</p>` : ''}
      <p class="note">${escapeHtml(CORRECTION_NOTE)}</p>
    </div>`;
}

export function renderVendorPage(vendor: VendorDetail): string {
  const main = VENDOR_DETAIL_SECTIONS.filter((section) =>
    (MAIN_COLUMN_KEYS as readonly string[]).includes(section.key)
  )
    .map((section) => mainSection(section.key, section.label, sectionNote(section), vendor))
    .join('');

  const body = `<section class="detail">
      <div class="wrap">
        <div class="detail-main">
          ${main}
          ${productsBlock(vendor)}
        </div>
        <div class="aside">
          ${verifiedCard(vendor)}
          ${officialCard(vendor)}
        </div>
      </div>
    </section>`;

  const where = [VENDOR_CATEGORY_LABEL[vendor.category], vendor.region].join(' · ');

  return siteDocument({
    path: `/v/${encodeURIComponent(vendor.id)}.html`,
    title: `${vendor.name} — ${SITE.name}`,
    description: `${vendor.name} · ${where}. ${vendor.prices.paidPrice.caption}`,
    current: null,
    body,
  });
}
