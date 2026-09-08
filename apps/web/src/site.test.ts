import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BUSINESS,
  MANY_CONFIRMED,
  NOT_ENOUGH_DATA,
  POLICY_DOCUMENTS,
  SPONSORED_LABEL,
  STILL_COLLECTING,
  TERMS,
  VENDOR_CATEGORY_LABEL,
  VENDOR_DETAIL_SECTIONS,
  findBannedPhrases,
  findVaguePhrases,
  hasExclamationOrEmoji,
  rangeLabel,
} from '@weddingpick/domain';
import type { VendorDetail, VendorSummary } from '@weddingpick/api-contract';

import { renderHomePage } from './home-page';
import { escapeHtml } from './page';
import {
  APP_HANDOFF,
  CORRECTION_NOTE,
  FOOTER_BOTTOM,
  GNB_MENU,
  HOW_IT_WORKS,
  SITE,
} from './site-content';
import { SITE_STYLES } from './site-styles';
import type { SiteData } from './site-data';
import { renderVendorPage } from './vendor-page';

const ROOT = join(__dirname, '..', '..', '..');

const EMPTY: SiteData = { vendors: [], stats: null, regions: [] };

function summary(paidPrice: VendorSummary['paidPrice']): VendorSummary {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: '모먼트 스튜디오',
    category: 'sdm',
    region: '서울 강남구',
    coordinates: null,
    sourceNote: null,
    comparableQuoteCount: 12,
    paidPrice,
  };
}

function detail(overrides: Partial<VendorDetail> = {}): VendorDetail {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: '모먼트 스튜디오',
    category: 'sdm',
    region: '서울 강남구',
    coordinates: null,
    sourceNote: null,
    comparableQuoteCount: 12,
    lastVerifiedAt: '2026-08-28T00:00:00.000Z',
    usageScore: { available: false, reason: NOT_ENOUGH_DATA, count: 0 },
    prices: {
      products: [],
      paidPrice: {
        stage: 'detailed',
        count: 12,
        caption: `${TERMS.verifiedData} 12건 · ${TERMS.period} · ${TERMS.baseAmount} 168만원`,
        low: 1_520_000,
        high: 1_840_000,
        median: 1_680_000,
      },
      reportedPrice: { available: false, reason: NOT_ENOUGH_DATA, count: 0 },
      deepData: false,
      deepDataNote: null,
    },
    ...overrides,
  };
}

describe('서비스 웹 — 문구', () => {
  /**
   * 화면에 나가는 말을 규칙에 걸어본다.
   *
   * `copy-rules.test.ts`가 소스를 훑지만 그건 주석을 걷어낸 소스다 — 여기서는
   * **실제로 그려진 문서**를 본다. 도메인에서 온 문자열이나 조합된 문장이
   * 규칙을 어기는 자리는 소스 훑기로는 안 잡힌다.
   */
  const rendered = [
    renderHomePage(EMPTY),
    renderHomePage({
      vendors: [
        summary({
          stage: 'normal',
          count: 6,
          caption: `${TERMS.verifiedData} 6건 · ${TERMS.period}`,
          low: 1_520_000,
          high: 1_840_000,
        }),
      ],
      stats: {
        kind: 'vendors',
        title: '검색할 수 있는 업체',
        total: '1,399곳',
        rows: [{ label: VENDOR_CATEGORY_LABEL.hall, value: '412곳' }],
      },
      regions: ['서울'],
    }),
    renderVendorPage(detail()),
  ];

  it('금지어를 쓰지 않는다', () => {
    for (const html of rendered) {
      expect(findBannedPhrases(html)).toEqual([]);
    }
  });

  it('애매모호한 말을 쓰지 않는다', () => {
    for (const text of [
      SITE.headline,
      SITE.lead,
      SITE.statTitle,
      APP_HANDOFF.note,
      CORRECTION_NOTE,
      ...HOW_IT_WORKS.map((step) => step.body),
    ]) {
      expect({ text, vague: findVaguePhrases(text) }).toEqual({ text, vague: [] });
    }
  });

  it('느낌표와 이모지를 쓰지 않는다', () => {
    for (const text of [SITE.headline, SITE.lead, ...HOW_IT_WORKS.map((step) => step.title)]) {
      expect(hasExclamationOrEmoji(text)).toBe(false);
    }
  });

  it('가입 유도를 헤드라인으로 쓰지 않는다', () => {
    // 첫 화면에서 할 일은 우리가 무엇을 가졌는지 보이는 것이다.
    expect(SITE.headline).not.toContain('가입');
    expect(SITE.headline).not.toContain('시작');
    expect(SITE.headline).not.toContain('앱');
  });
});

describe('서비스 웹 — 홈', () => {
  it('용어를 도메인에서 가져온다', () => {
    const html = renderHomePage(EMPTY);

    expect(html).toContain(escapeHtml(MANY_CONFIRMED));
    expect(html).toContain(escapeHtml(TERMS.verifiedData));
    // `탐색`이 아니라 `검색`이다.
    expect(html).not.toContain('탐색');
  });

  it('업종 칩을 도메인 목록에서 만든다', () => {
    const html = renderHomePage(EMPTY);

    for (const [category, label] of Object.entries(VENDOR_CATEGORY_LABEL)) {
      /* `기타`는 칩으로 만들지 않는다 — 무엇을 찾는 것인지 말해주지 않는다. */
      if (category === 'etc') {
        expect(html).not.toContain(`?category=etc`);
        continue;
      }

      expect(html).toContain(escapeHtml(label));
      expect(html).toContain(`?category=${category}`);
    }
  });

  it('자료에 없는 지역을 칩으로 걸지 않는다', () => {
    // 눌러도 아무것도 나오지 않는 칩을 만들지 않는다.
    expect(renderHomePage(EMPTY)).not.toContain('region=');
    expect(renderHomePage({ ...EMPTY, regions: ['서울'] })).toContain('region=%EC%84%9C%EC%9A%B8');
  });

  it('셀 것이 없으면 0을 적지 않고 모으는 중이라고 적는다', () => {
    const html = renderHomePage(EMPTY);

    expect(html).toContain(escapeHtml(STILL_COLLECTING));
    expect(html).not.toContain('0건');
    expect(html).not.toContain('0곳');
  });

  it('구간이 없는 단계에서 금액을 그리지 않는다', () => {
    const html = renderHomePage({
      ...EMPTY,
      vendors: [
        summary({ stage: 'collecting', count: 1, caption: `${TERMS.verifiedData} 1건 · 수집 중` }),
      ],
    });

    expect(html).toContain(escapeHtml(NOT_ENOUGH_DATA));
    expect(html).not.toContain('만원');
  });

  it('금액 옆에 캡션을 함께 적는다', () => {
    const caption = `${TERMS.verifiedData} 6건 · ${TERMS.period}`;
    const html = renderHomePage({
      ...EMPTY,
      vendors: [summary({ stage: 'normal', count: 6, caption, low: 1_520_000, high: 1_840_000 })],
    });

    expect(html).toContain(escapeHtml(rangeLabel(1_520_000, 1_840_000)));
    expect(html).toContain(escapeHtml(caption));
  });

  it('광고 자리를 자연 결과와 섞지 않는다', () => {
    /*
     * `sponsored`는 자연 결과와 다른 배열로 온다(v2.0 E-1). 한 줄로 섞으면 배지를
     * 못 본 사람에게 그건 그냥 검색 결과다. 웹은 그 배열을 아예 싣지 않는다 —
     * 광고 실운영 전환은 오더 대기다.
     */
    const html = renderHomePage({
      ...EMPTY,
      vendors: [
        summary({ stage: 'collecting', count: 0, caption: `${TERMS.verifiedData} 0건 · 수집 중` }),
      ],
    });

    expect(html).not.toContain(`>${SPONSORED_LABEL}<`);
    expect(html).not.toContain('class="chip">광고');
  });
});

describe('서비스 웹 — 업체 상세', () => {
  it('정책이 정한 자리를 빠뜨리지 않는다', () => {
    const html = renderVendorPage(detail());

    /* 자료가 없는 자리도 지우지 않고 왜 비었는지 적는다. */
    for (const section of VENDOR_DETAIL_SECTIONS) {
      if (section.ready || !section.note) continue;

      const shown = html.includes(escapeHtml(section.note));
      const named = html.includes(escapeHtml(section.label));

      expect({ key: section.key, shown: shown || named }).toEqual({ key: section.key, shown: true });
    }
  });

  it('추천 이유를 지어내지 않는다', () => {
    /*
     * `recommend_reason`은 ready:false다 — 추천 목록에서만 만들 수 있다. 상세에
     * 이유를 적으면 무엇과 견줘 고른 것인지 없는 채로 «이래서 좋다»가 된다.
     */
    const reason = VENDOR_DETAIL_SECTIONS.find((s) => s.key === 'recommend_reason');
    const html = renderVendorPage(detail());

    expect(reason?.ready).toBe(false);
    expect(html).toContain(escapeHtml(reason?.note ?? ''));
  });

  it('확인된 정보에 캡션을 함께 적는다', () => {
    const vendor = detail();
    const html = renderVendorPage(vendor);

    expect(html).toContain(escapeHtml(rangeLabel(1_520_000, 1_840_000)));
    expect(html).toContain(escapeHtml(vendor.prices.paidPrice.caption));
  });

  it('구간이 없으면 금액을 그리지 않는다', () => {
    const html = renderVendorPage(
      detail({
        prices: {
          ...detail().prices,
          paidPrice: {
            stage: 'collecting',
            count: 2,
            caption: `${TERMS.verifiedData} 2건 · 수집 중`,
          },
        },
      })
    );

    expect(html).toContain(escapeHtml(NOT_ENOUGH_DATA));
    expect(html).not.toContain('만원');
  });

  it('Pick과 비교가 앱에서 이어지는 것을 밝힌다', () => {
    const html = renderVendorPage(detail());

    expect(html).toContain(escapeHtml(APP_HANDOFF.pick));
    expect(html).toContain(escapeHtml(APP_HANDOFF.note));
  });

  it('확인하지 않은 공식정보를 적지 않는다', () => {
    // 연락처와 영업상태는 우리에게 내려오는 값이 아니다. 빈 줄을 만들어두지 않는다.
    const html = renderVendorPage(detail());

    expect(html).not.toContain('연락처');
    expect(html).not.toContain('영업상태');
  });

  it('출처가 있으면 밝힌다', () => {
    // 공공누리는 유형과 무관하게 출처 표시를 요구한다.
    const note = '출처: 지방행정 인허가 데이터개방';

    expect(renderVendorPage(detail({ sourceNote: note }))).toContain(escapeHtml(note));
  });
});

describe('서비스 웹 — 겉껍데기', () => {
  const html = renderHomePage(EMPTY);

  it('열리지 않는 메뉴를 링크로 걸지 않는다', () => {
    for (const item of GNB_MENU) {
      expect(html).toContain(escapeHtml(item.label));
    }

    const unlinked = GNB_MENU.filter((item) => !item.href);

    expect(unlinked.length).toBeGreaterThan(0);

    for (const item of unlinked) {
      expect(html).toContain(`<span>${escapeHtml(item.label)}</span>`);
    }
  });

  it('약관 링크를 도메인의 게시 상태에서 가져온다', () => {
    for (const policy of POLICY_DOCUMENTS) {
      expect(html).toContain(escapeHtml(policy.title));

      if (!policy.url) {
        /* 확정본이 없는 문서는 링크로 만들지 않고 상태를 적는다. */
        expect(html).toContain(escapeHtml(policy.status));
        continue;
      }

      /*
       * 문서 안을 가리키는 주소(`#analysis-notice`)는 소개 한 장 안에 있다.
       * 그대로 걸면 홈에서 눌러도 아무 데도 가지 않는다.
       */
      const href = policy.url.startsWith('#') ? `/about.html${policy.url}` : policy.url;

      expect(html).toContain(`href="${escapeHtml(href)}"`);
    }
  });

  it('소개 한 장의 자리표가 실제로 그 문서를 가리킨다', () => {
    /* `build.ts`가 소개 한 장을 이 이름으로 쓴다. 둘이 갈라지면 링크가 끊긴다. */
    const build = readFileSync(join(__dirname, 'build.ts'), 'utf8');

    expect(build).toContain("'about.html'");
  });

  it('없는 스토어 주소를 지어내지 않는다', () => {
    expect(html).not.toContain('apps.apple.com');
    expect(html).not.toContain('play.google.com');
  });

  it('사업자 정보를 푸터에 적는다 — 2026-09-08 사업자등록', () => {
    // 값은 @weddingpick/domain BUSINESS 한 곳에서 온다. 자리 표시용 번호가 아니다.
    expect(FOOTER_BOTTOM.join(' ')).not.toContain('000-00-00000');
    expect(html).toContain(`사업자등록번호 ${BUSINESS.registrationNumber}`);
    expect(html).toContain(`상호 ${BUSINESS.name} · 대표 ${BUSINESS.representative}`);
    // 소재지는 운영자 자택이라 게시하지 않는다.
    expect(html).not.toContain('사업장 소재지');
    expect(html).not.toContain('일현로');
  });

  it('업체 · 플래너 문의 창구를 두지 않는다', () => {
    // 2026-09-04 정책 변경 — 플래너 연결 기능 전체 파기(차후 도입 예정).
    // 업체 정보 정정은 앱의 MY → 문의하기로만 받는다.
    expect(html).not.toContain('href="#inquiry"');
    expect(html).not.toContain('id="inquiry"');
  });

  it('한국어 문서로 만든다', () => {
    expect(html).toContain('<html lang="ko">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('name="viewport"');
  });

  it('자바스크립트를 싣지 않는다', () => {
    // 검색으로 들어온 사람에게 스크립트가 도는지는 우리 사정이다.
    expect(html).not.toContain('<script');
  });

  it('검색이 스크립트 없이 넘어간다', () => {
    expect(html).toContain('method="get"');
  });
});

describe('서비스 웹 — 옮겨 적은 값', () => {
  /**
   * 옮겨 적은 값은 갈라진다. 나란히 놓고 보기 전까지 아무도 모른다.
   *
   * `styles.ts`가 theme.ts의 색을 옮겨 적고 `typography.test.ts`가 지키는 것과
   * 같은 규칙이다 — 이 파일들은 번들러 없이 통째로 문서에 실려서 import할 수 없다.
   */
  it('색을 theme.ts와 같이 쓴다', () => {
    const theme = readFileSync(join(ROOT, 'packages/ui/src/theme.ts'), 'utf8');

    /* palette의 이름과 이 스타일시트가 그 색을 담은 역할 이름. */
    const roles: [string, string][] = [
      ['coral500', '--tint'],
      ['coral600', '--tint-strong'],
      ['gray900', '--ink'],
      ['gray800', '--ink-2'],
      ['gray700', '--text-2'],
      ['gray600', '--text-3'],
      ['gray200', '--line'],
      ['gray300', '--border'],
      ['gray00', '--surface'],
      ['gray50', '--surface-1'],
      ['gray100', '--surface-2'],
      ['green500', '--positive'],
      ['green50', '--positive-bg'],
    ];

    for (const [token, role] of roles) {
      const value = theme.match(new RegExp(`${token}: '(#[0-9a-f]{3,8})'`))?.[1];

      expect({ token, value }).toEqual({ token, value: expect.any(String) });
      expect(SITE_STYLES).toContain(`${role}: ${value};`);
    }
  });

  it('심볼 경로를 wedding-mark.tsx와 같이 쓴다', () => {
    /*
     * 마크는 확정본이다 — 하트 윤곽선 안에 체크. 웹이 react-native-svg를 불러올
     * 수 없어 경로를 옮겨 적었고, 두 곳이 갈라지면 같은 서비스가 다른 마크를 쓴다.
     */
    const source = readFileSync(join(ROOT, 'packages/ui/src/wedding-mark.tsx'), 'utf8');
    const chrome = readFileSync(join(__dirname, 'site-chrome.ts'), 'utf8');

    const check = source.match(/MARK_CHECK_PATH =\s*'([^']+)'/)?.[1];

    expect(check).toEqual(expect.any(String));
    expect(chrome).toContain(check as string);

    const heart = source.match(/MARK_HEART_PATH =\s*'([^']+)'/)?.[1];

    expect(heart).toEqual(expect.any(String));
    expect(chrome).toContain(heart as string);

    expect(markStroke(source)).toEqual(markStroke(chrome));
  });

  it('글자 크기를 화면이 직접 적지 않는다', () => {
    /* 토큰을 정의하는 줄(`--fs-body: 16px`)만 숫자를 들고 있어야 한다. */
    const raw = SITE_STYLES.split('\n').filter((line) => /font-size:\s*[\d.]/.test(line));

    expect(raw).toEqual([]);
  });

  it('앱과 겹치는 글자 크기는 같은 수를 쓴다', () => {
    const scale = readFileSync(join(ROOT, 'packages/ui/src/typography.ts'), 'utf8');

    /* 웹만 쓰는 크기(44·40·36·28·24·15)는 앱 스케일에 없다. 겹치는 자리만 지킨다. */
    const shared: [string, string][] = [
      ['t1', '--fs-amount'],
      ['t4', '--fs-title4'],
      ['t5', '--fs-lead'],
      ['t6', '--fs-body'],
      ['t7', '--fs-caption'],
    ];

    for (const [token, property] of shared) {
      const size = scale.match(new RegExp(`${token}: (\\d+)`))?.[1];

      expect({ token, size }).toEqual({ token, size: expect.any(String) });
      expect(SITE_STYLES).toContain(`${property}: ${size}px;`);
    }
  });
});

/** 획 두께. 하트와 체크가 같아야 한 손으로 그린 것처럼 보인다. 확정본은 소수(1.9)다. */
function markStroke(source: string): string | undefined {
  return source.match(/MARK_STROKE = ([\d.]+)/)?.[1];
}
