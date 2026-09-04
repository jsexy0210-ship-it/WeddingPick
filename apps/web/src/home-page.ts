/**
 * WP-WEB-001 홈.
 *
 * 첫 화면에서 하는 일은 **우리가 무엇을 가졌는지 보이는 것**이다. 가입 유도를
 * 헤드라인으로 쓰지 않고, 검색을 주인공으로 둔다 — 웹은 검색으로 들어오는 창구다.
 *
 * 숫자는 하나도 이 파일에 없다. 구간은 API가 도메인의 4단계 사다리로 정리해서
 * 내려주고(`paidPrice`), 화면은 그 단계를 그대로 그린다.
 */

import {
  MANY_CONFIRMED,
  NOT_ENOUGH_DATA,
  STILL_COLLECTING,
  TERMS,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  rangeLabel,
} from '@weddingpick/domain';
import type { VendorSummary } from '@weddingpick/api-contract';

import { escapeHtml } from './page';
import { HOW_IT_WORKS, SITE } from './site-content';
import { siteDocument } from './site-chrome';
import type { SiteData } from './site-data';

/** 칩에 세우는 지역 수. 시도를 다 늘어놓으면 칩 줄이 업종을 덮는다. */
const REGION_CHIP_COUNT = 3;

/**
 * 검색칸.
 *
 * GET form이다 — 자바스크립트를 켜지 않아도 넘어간다. `action`이 자기 자리인
 * 것은 아직 검색 결과 화면이 웹에 없기 때문이고, 그래서 눌러도 홈이 다시 열린다.
 * 없는 화면으로 보내는 것보다 낫다.
 */
function search(): string {
  return `<form class="search" role="search" method="get" action="/">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="color:var(--text-3)" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="6.9"></circle>
        <path d="M16.2 16.2 20.8 20.8"></path>
      </svg>
      <label class="skip" for="q">${escapeHtml(`업체 ${TERMS.search}`)}</label>
      <input id="q" name="q" type="search" placeholder="${escapeHtml(SITE.searchPlaceholder)}" maxlength="60">
      <button class="btn btn-primary btn-md" type="submit">${escapeHtml(TERMS.search)}</button>
    </form>`;
}

/**
 * 검색 조건 칩.
 *
 * 업종은 도메인 목록에서, 지역은 **자료에 실제로 있는 시도**에서 온다. 전국
 * 목록을 박아두면 눌러도 아무것도 나오지 않는 칩이 생긴다 —
 * `/v1/vendors/regions`가 있는 것만 내려주는 이유와 같다.
 */
function chips(regions: readonly string[]): string {
  /* `기타`는 칩으로 만들지 않는다 — 무엇을 찾는 것인지 아무에게도 말해주지 않는다. */
  const categories = VENDOR_CATEGORIES.filter((category) => category !== 'etc').map(
    (category) =>
      `<li><a class="chip" href="/?category=${escapeHtml(category)}">${escapeHtml(
        VENDOR_CATEGORY_LABEL[category]
      )}</a></li>`
  );

  const places = regions
    .slice(0, REGION_CHIP_COUNT)
    .map(
      (region) =>
        `<li><a class="chip" href="/?region=${encodeURIComponent(region)}">${escapeHtml(
          region
        )}</a></li>`
    );

  return `<ul class="chips">${[...categories, ...places].join('')}</ul>`;
}

/**
 * 우측 집계 기둥.
 *
 * 셀 수 있는 것이 없으면 판을 비우지 않고 «정보를 모으는 중이에요»를 적는다.
 * 0을 적으면 그건 «없다»가 아니라 «세어봤더니 0»으로 읽힌다.
 */
function stats(data: SiteData): string {
  if (!data.stats) {
    return `<aside class="stat">
        <h2>${escapeHtml(SITE.statTitle)}</h2>
        <p class="note" style="margin-top:8px">${escapeHtml(STILL_COLLECTING)}</p>
      </aside>`;
  }

  const rows = data.stats.rows
    .map(
      (row) =>
        `<div><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`
    )
    .join('');

  return `<aside class="stat">
      <h2>${escapeHtml(data.stats.title)}</h2>
      <b class="total">${escapeHtml(data.stats.total)}</b>
      <dl class="rows">${rows}</dl>
    </aside>`;
}

/**
 * 업체 카드의 금액 한 줄.
 *
 * **구간이 없는 단계에서는 숫자를 그리지 않는다.** `paidPrice`가 판별 유니온인
 * 이유가 여기다 — `collecting`에는 `low`·`high`가 아예 없어서 0원이나 빈 구간을
 * 그릴 수가 없다.
 */
function price(paid: VendorSummary['paidPrice']): string {
  if (paid.stage === 'collecting') {
    return `<span class="price none">${escapeHtml(NOT_ENOUGH_DATA)}</span>`;
  }

  return `<span class="price">${escapeHtml(rangeLabel(paid.low, paid.high))}</span>`;
}

/**
 * 많이 확인된 곳.
 *
 * 이름 그대로 확인된 계약이 많이 모인 순서다(`sort=data`). 별점도 후기 수도
 * 없다 — 우리가 아는 것은 이 업체가 있다는 사실과 몇 건이 모였는지뿐이다.
 */
function vendorCards(vendors: readonly VendorSummary[]): string {
  if (vendors.length === 0) {
    return `<p class="pending">${escapeHtml(STILL_COLLECTING)} 확인된 곳이 모이면 이 자리에 보여드려요.</p>`;
  }

  const cards = vendors
    .map(
      (vendor) => `<li class="vendor-card">
        <!--
          업체 제공·사용동의 이미지가 아직 없다. 회색 판을 뚫어두는 것을 정책이
          막았으므로 왜 비었는지 자리에 적는다.
        -->
        <div class="shot shot-wide">업체 제공 이미지가 아직 없어요</div>
        <a class="name" href="/v/${escapeHtml(vendor.id)}.html">${escapeHtml(vendor.name)}</a>
        ${price(vendor.paidPrice)}
        <span class="meta">${escapeHtml(vendor.paidPrice.caption)}</span>
      </li>`
    )
    .join('');

  return `<ul class="cards">${cards}</ul>`;
}

function howItWorks(): string {
  const steps = HOW_IT_WORKS.map(
    (step, index) => `<li class="step">
      <span class="step-no" aria-hidden="true">${index + 1}</span>
      <h3>${escapeHtml(step.title)}</h3>
      <p>${escapeHtml(step.body)}</p>
    </li>`
  ).join('');

  return `<section class="band">
      <div class="wrap">
        <h2>웨딩픽은 이렇게 일해요</h2>
        <ul class="steps" style="margin-top:24px">${steps}</ul>
      </div>
    </section>`;
}

export function renderHomePage(data: SiteData): string {
  /* 헤드라인만 줄을 지정한다 — 44px 두 줄이 어디서 접히는지가 첫 화면의 인상이다. */
  const headline = SITE.headline
    .split('\n')
    .map((line) => escapeHtml(line))
    .join('<br>');

  const body = `<section class="hero">
      <div class="wrap">
        <div class="hero-main">
          <h1>${headline}</h1>
          <p class="lead">${escapeHtml(SITE.lead)}</p>
          ${search()}
          ${chips(data.regions)}
        </div>
        ${stats(data)}
      </div>
    </section>

    <section>
      <div class="wrap">
        <div class="section-head">
          <h2>${escapeHtml(MANY_CONFIRMED)}</h2>
        </div>
        ${vendorCards(data.vendors)}
      </div>
    </section>

    ${howItWorks()}`;

  return siteDocument({
    path: '/search.html',
    title: `${SITE.name} — ${SITE.lead}`,
    description: SITE.lead,
    current: '/',
    body,
  });
}
