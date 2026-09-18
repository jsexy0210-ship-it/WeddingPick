import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';

import { loadConfig } from './config';
import { createPool } from './db';

/**
 * 샘플 업체의 사진을 카카오(다음) 이미지 검색 결과로 바꾼다 — 검수용, 출시 전
 * 교체(2026-09-08 오더 «실제 웨딩업체 이미지 그대로»).
 *
 *   KAKAO_APP_KEY=… npm run seed:sample-images --workspace @weddingpick/api -- --yes
 *
 * 카카오 개발자센터 «다음 검색» API(이미지). 로그인에 쓰는 앱의 REST API 키를
 * 그대로 쓴다 — 별도 등록도 검수도 없다. 하루 30,000회, 우리는 업체 수만큼.
 *
 * 저작권 근거는 `unknown`으로 적고 메모에 출처를 남긴다 — 이 상태는 정식 운영에서
 * 노출하지 않기로 한 값이다(0050). 검수용 스테이징에서만 쓰고, 출시 전에 아래
 * `--remove`로 사진만 걷어낸다.
 *
 * **`--remove`는 `seed:samples --remove`와 다르다.** 저쪽은 업체(vendors)째
 * 지운다 — 업체 목록 자체가 검수 대상이면 쓸 수 없다. 여기 `--remove`는
 * `vendor_images` 중 이 스크립트가 넣은 줄(`copyright_basis='unknown'` +
 * `copyright_note`가 「카카오(다음) 이미지 검색」으로 시작하는 것)만 지운다 —
 * 업체는 남고 사진만 빠져 기본 이미지로 떨어진다(`packages/ui/src/default-image.tsx`).
 *
 *   npm run seed:sample-images --workspace @weddingpick/api -- --remove --dry-run
 *   npm run seed:sample-images --workspace @weddingpick/api -- --remove --yes
 *
 * 되돌릴 수 없는 삭제라 `--dry-run`으로 몇 건 · 몇 업체인지 먼저 세어 본 뒤에만
 * `--yes`를 붙인다.
 */

const SOURCE_KEY = 'sample';
const PER_VENDOR = 3;
/** `--remove`가 지울 줄을 고르는 조건 — 이 스크립트가 넣은 줄만 잡는다. */
const REMOVE_NOTE_PREFIX = '카카오(다음) 이미지 검색';

function argv(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** 검색어 — 업종 이름 + 시도. 같은 검색어의 결과를 업체마다 다른 자리(start)에서 잘라 겹치지 않게 한다. */
const QUERY: Record<VendorCategory, string> = {
  wedding_info_company: '결혼정보회사',
  hall: '웨딩홀',
  studio: '웨딩 스튜디오 촬영',
  dress: '웨딩드레스 샵',
  makeup: '웨딩 메이크업',
  hair: '웨딩 헤어 변형',
  snap: '본식 스냅',
  bouquet: '웨딩 부케',
  goods: '예물 반지',
  dowry: '혼수 가전',
  honeymoon: '허니문 리조트',
  invitation: '청첩장 디자인',
  etc: '웨딩 플라워 데코',
};

type KakaoImage = { image_url: string; thumbnail_url: string; width: number; height: number; display_sitename: string };

async function searchImages(appKey: string, query: string, page: number, size: number): Promise<KakaoImage[]> {
  const url = new URL('https://dapi.kakao.com/v2/search/image');

  url.searchParams.set('query', query);
  url.searchParams.set('sort', 'accuracy');
  url.searchParams.set('page', String(page));
  url.searchParams.set('size', String(size));

  const response = await fetch(url, { headers: { Authorization: `KakaoAK ${appKey}` } });

  if (!response.ok) {
    throw new Error(`카카오 이미지 검색 실패 (HTTP ${response.status}) ${(await response.text()).slice(0, 200)}`);
  }

  const body = (await response.json()) as { documents?: KakaoImage[] };

  return body.documents ?? [];
}

/** `--remove` 대상 건수 · 업체 수를 센다. 지우기 전에도, `--dry-run`에서도 같은 카운트를 쓴다. */
async function countRemovable(pool: ReturnType<typeof createPool>): Promise<{ rows: number; vendors: number }> {
  const { rows } = await pool.query<{ rows: string; vendors: string }>(
    `SELECT count(*)::text AS rows, count(DISTINCT vendor_id)::text AS vendors
     FROM structured.vendor_images
     WHERE copyright_basis = 'unknown' AND copyright_note LIKE $1`,
    [`${REMOVE_NOTE_PREFIX}%`]
  );

  return { rows: Number(rows[0]?.rows ?? 0), vendors: Number(rows[0]?.vendors ?? 0) };
}

async function removeKakaoImages(): Promise<void> {
  const dryRun = argv('dry-run');

  if (!dryRun && !argv('yes')) {
    console.error(
      '카카오 검색으로 넣은 업체 사진을 지운다 — 되돌릴 수 없다.\n' +
        '  먼저 세어 본다: npm run seed:sample-images --workspace @weddingpick/api -- --remove --dry-run\n' +
        '  정말 지우려면: npm run seed:sample-images --workspace @weddingpick/api -- --remove --yes'
    );
    process.exitCode = 1;
    return;
  }

  const pool = createPool(loadConfig().databaseUrl);

  try {
    const before = await countRemovable(pool);

    if (dryRun) {
      console.log(`[dry-run] 카카오 검색 사진 ${before.rows}건 · 업체 ${before.vendors}곳이 지워질 것이다. 지우지 않았다.`);
      return;
    }

    await pool.query(`DELETE FROM structured.vendor_images WHERE copyright_basis = 'unknown' AND copyright_note LIKE $1`, [
      `${REMOVE_NOTE_PREFIX}%`,
    ]);

    console.log(`카카오 검색 사진 ${before.rows}건 · 업체 ${before.vendors}곳의 사진을 지웠다. 업체 자체는 남아 있다.`);
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  if (argv('remove')) {
    await removeKakaoImages();
    return;
  }

  if (!argv('yes')) {
    console.error('샘플 업체 사진을 카카오 이미지 검색 결과로 바꾼다. 정말이면 --yes를 붙일 것.');
    process.exitCode = 1;
    return;
  }

  const appKey = process.env.KAKAO_APP_KEY;

  if (!appKey) {
    console.error('KAKAO_APP_KEY(카카오 REST API 키)가 필요하다 — GitHub Secret에 저장한 값.');
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
    const position: Partial<Record<string, number>> = {};

    for (const vendor of vendors) {
      const city = vendor.region.split(' ')[0] ?? '';
      const query = `${city} ${QUERY[vendor.category] ?? VENDOR_CATEGORY_LABEL[vendor.category]}`;
      /* 같은 검색어를 쓰는 업체끼리 결과가 겹치지 않게 쪽을 넘긴다(쪽당 PER_VENDOR장). */
      const page = position[query] ?? 1;

      position[query] = page + 1;

      let images: KakaoImage[] = [];

      try {
        images = await searchImages(appKey, query, page, PER_VENDOR);
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
          `카카오(다음) 이미지 검색 «${query}» 결과 · 검수용. 출시 전 교체한다.`,
          images.map((image) => image.image_url),
          images.map((image) => image.width || 0),
          images.map((image) => image.height || 0),
          images.map((_, index) => index + 1),
        ]
      );

      replaced += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
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
