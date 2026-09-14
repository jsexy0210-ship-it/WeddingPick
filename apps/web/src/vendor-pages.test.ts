import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { NOT_ENOUGH_DATA, TERMS } from '@weddingpick/domain';
import type { VendorDetail, VendorSummary } from '@weddingpick/api-contract';

import { build } from './build';
import { API_URL_ENV } from './site-data';

/**
 * 공유한 주소에 페이지가 있는가.
 *
 * **여기 있던 어긋남.** 검색 화면은 목록에 실린 업체를 전부 `/v/<id>.html`로
 * 걸었는데, 상세를 만들 id는 `WEDDINGPICK_WEB_VENDOR_IDS` 환경변수에서만 왔다 —
 * 링크를 만드는 출처와 페이지를 만드는 출처가 달랐다. 값이 비면 카드 전부가 없는
 * 페이지를 가리키고, 그 주소를 카카오톡에 붙이면 미리보기가 뜰 자리조차 없다.
 * 404에는 og 태그가 없다.
 *
 * 그래서 **빌드 결과에서 링크와 파일을 맞춰 본다.** 「링크가 있으면 파일도 있다」는
 * 것은 사람 눈으로 확인할 수 없다 — 업체가 늘어날 때마다 다시 봐야 하기 때문이다.
 */
const VENDOR_ID = '22222222-2222-4222-8222-222222222222';

function summary(): VendorSummary {
  return {
    id: VENDOR_ID,
    name: '강남 A 스튜디오',
    category: 'studio',
    region: '서울 강남구',
    coordinates: null,
    sourceNote: null,
    imageUrl: null,
    comparableQuoteCount: 12,
    styleTags: [],
    guidePrice: null,
    paidPrice: {
      stage: 'detailed',
      count: 12,
      caption: `${TERMS.verifiedData} 12건 · ${TERMS.period} · ${TERMS.baseAmount} 168만원`,
      low: 1_520_000,
      high: 1_840_000,
      median: 1_680_000,
    },
  };
}

function detail(): VendorDetail {
  const { paidPrice, ...rest } = summary();

  return {
    ...rest,
    lastVerifiedAt: '2026-09-01T00:00:00.000Z',
    usageScore: { available: false, reason: NOT_ENOUGH_DATA, count: 0 },
    prices: {
      products: [],
      paidPrice,
      reportedPrice: { available: false, reason: NOT_ENOUGH_DATA, count: 0 },
      deepData: false,
      deepDataNote: null,
    },
  };
}

/** 빌드가 읽는 경로만 답한다. 그 밖은 404로 두어 조용히 통과하지 않게 한다. */
function stubApi(): void {
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const body = (value: unknown) =>
      new Response(JSON.stringify(value), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    if (url.includes('/v1/site-meta')) return body({});
    if (url.includes('/v1/vendors/regions')) {
      return body({ regions: [{ name: '서울 강남구', vendorCount: 1 }] });
    }
    if (url.includes(`/v1/vendors/${VENDOR_ID}`)) return body(detail());
    if (url.includes('/v1/vendors?')) {
      return body({ vendors: [summary()], sponsored: [], nextCursor: null, total: 1 });
    }

    return new Response('not found', { status: 404 });
  });
}

test('검색 화면이 건 업체 상세는 환경변수 없이도 만들어진다', async () => {
  const out = join(__dirname, '..', 'dist-vendor-pages-test');

  process.env[API_URL_ENV] = 'https://api.test';
  /* 환경변수를 비워 둔다 — 예전에는 이 상태에서 상세가 한 장도 생기지 않았다. */
  delete process.env['WEDDINGPICK_WEB_VENDOR_IDS'];
  stubApi();

  try {
    await build(out);

    const search = readFileSync(join(out, 'search.html'), 'utf8');
    const linked = [...search.matchAll(/href="\/v\/([^"]+)\.html"/g)].map((match) => match[1]!);

    expect(linked).toContain(VENDOR_ID);

    for (const id of linked) {
      const page = readFileSync(join(out, 'v', `${id}.html`), 'utf8');

      /* 페이지가 있는 것으로 끝나지 않는다. 카드 태그가 함께 나가야 미리보기가 뜬다. */
      expect(page).toContain('property="og:title"');
      expect(page).toContain(`content="https://weddingpick-web.onrender.com/v/${id}.html"`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
    delete process.env[API_URL_ENV];
  }
});
