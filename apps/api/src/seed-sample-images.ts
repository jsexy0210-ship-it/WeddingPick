import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';

import { loadConfig } from './config';
import { createPool } from './db';

/**
 * 샘플 업체의 사진을 네이버 이미지 검색 결과로 바꾼다 — 검수용, 출시 전 교체
 * (2026-09-08 오더 «실제 웨딩업체 이미지 그대로»).
 *
 *   NAVER_SEARCH_CLIENT_ID=… NAVER_SEARCH_CLIENT_SECRET=… \
 *   npm run seed:sample-images --workspace @weddingpick/api -- --yes
 *
 * 저작권 근거는 `unknown`으로 적고 메모에 출처를 남긴다 — 이 상태는 정식 운영에서
 * 노출하지 않기로 한 값이다(0050). 검수용 스테이징에서만 쓰고, 출시 전에
 * `seed:samples --remove`로 업체째 걷어낸다.
 */

const SOURCE_KEY = 'sample';
const PER_VENDOR = 3;

function argv(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** 검색어 — 업종 이름 + 시도. 같은 검색어의 결과를 업체마다 다른 자리(start)에서 잘라 겹치지 않게 한다. */
const QUERY: Record<VendorCategory, string> = {
  hall: '웨딩홀',
  sdm: '웨딩 스튜디오 촬영',
  snap: '본식 스냅',
  goods: '예물 반지',
  honeymoon: '허니문 리조트',
  wedding_info_company: '결혼정보회사',
  etc: '웨딩 플라워 데코',
};

type NaverImage = { link: string; thumbnail: string; sizewidth: string; sizeheight: string };

async function searchImages(
  auth: { id: string; secret: string },
  query: string,
  start: number,
  display: number
): Promise<NaverImage[]> {
  const url = new URL('https://openapi.naver.com/v1/search/image');

  url.searchParams.set('query', query);
  url.searchParams.set('display', String(display));
  url.searchParams.set('start', String(start));
  url.searchParams.set('sort', 'sim');
  url.searchParams.set('filter', 'large');

  const response = await fetch(url, {
    headers: { 'X-Naver-Client-Id': auth.id, 'X-Naver-Client-Secret': auth.secret },
  });

  if (!response.ok) {
    throw new Error(`네이버 이미지 검색 실패 (HTTP ${response.status}) ${(await response.text()).slice(0, 200)}`);
  }

  const body = (await response.json()) as { items?: NaverImage[] };

  return body.items ?? [];
}

async function main(): Promise<void> {
  if (!argv('yes')) {
    console.error('샘플 업체 사진을 네이버 이미지 검색 결과로 바꾼다. 정말이면 --yes를 붙일 것.');
    process.exitCode = 1;
    return;
  }

  const id = process.env.NAVER_SEARCH_CLIENT_ID;
  const secret = process.env.NAVER_SEARCH_CLIENT_SECRET;

  if (!id || !secret) {
    console.error('NAVER_SEARCH_CLIENT_ID / NAVER_SEARCH_CLIENT_SECRET이 필요하다(네이버 개발자센터 · 검색 API).');
    process.exitCode = 1;
    return;
  }

  const pool = createPool(loadConfig().databaseUrl);

  try {
    const { rows: vendors } = await pool.query<{
      id: string;
      category: VendorCategory;
      region: string;
      record_key: string;
    }>(
      `SELECT v.id, v.category, v.region, r.record_key
       FROM structured.vendor_source_records r
       JOIN structured.vendors v ON v.id = r.vendor_id
       WHERE r.source_key = $1
       ORDER BY v.category, r.record_key`,
      [SOURCE_KEY]
    );

    let replaced = 0;
    let position: Partial<Record<string, number>> = {};

    for (const vendor of vendors) {
      const city = vendor.region.split(' ')[0] ?? '';
      const query = `${city} ${QUERY[vendor.category] ?? VENDOR_CATEGORY_LABEL[vendor.category]}`;
      const start = position[query] ?? 1;

      position[query] = start + PER_VENDOR;

      let images: NaverImage[] = [];

      try {
        images = await searchImages({ id, secret }, query, start, PER_VENDOR);
      } catch (error) {
        console.error(`${vendor.record_key}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      if (images.length === 0) {
        console.log(`${vendor.record_key}: 검색 결과 없음(${query}) — 그대로 둔다.`);
        continue;
      }

      await pool.query('DELETE FROM structured.vendor_images WHERE vendor_id = $1', [vendor.id]);
      await pool.query(
        `INSERT INTO structured.vendor_images
           (vendor_id, source_url, copyright_basis, copyright_note, match_confidence,
            width_px, height_px, status, is_representative, verified_at)
         SELECT $1::uuid, url, 'unknown', $2, 0,
                NULLIF(w, 0), NULLIF(h, 0), 'approved', ord = 1, now()
         FROM UNNEST($3::text[], $4::int[], $5::int[], $6::int[]) AS t(url, w, h, ord)`,
        [
          vendor.id,
          `네이버 이미지 검색 «${query}» 결과 · 검수용. 출시 전 교체한다.`,
          images.map((image) => image.link),
          images.map((image) => Number(image.sizewidth) || 0),
          images.map((image) => Number(image.sizeheight) || 0),
          images.map((_, index) => index + 1),
        ]
      );

      replaced += 1;
      /* 네이버 검색 API는 초당 10회 제한이다. */
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    console.log(`샘플 업체 ${vendors.length}곳 중 ${replaced}곳의 사진을 바꿨다.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
