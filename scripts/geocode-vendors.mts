/**
 * 업체 좌표 지오코딩 백필. 지도 보기(WP-SRCH-007).
 *
 * vendors에는 "서울 마포구" 같은 구 단위 region만 있고 정확한 주소가 없다
 * (packages/db/migrations/0001_init.sql, 0007_vendor_search.sql). 그래서 이
 * 스크립트는 업체 이름 + 지역을 카카오 로컬 "키워드로 장소 검색" API에 그대로
 * 넘긴다 — 구 중심 좌표를 박아 넣는 것보다, 실제 업체명으로 검색되는 결과가
 * 더 정확하다. 검색이 안 되는 업체는 그냥 건너뛴다(좌표 NULL 유지) — 지도에
 * 안 뜰 뿐 목록에는 그대로 남는다. 억지로 아무 좌표나 채우지 않는다.
 *
 * **수동 실행 스크립트다.** CI에 물리지 않는다 — 외부 API 호출량과 요율 제한이
 * 있고, 실패해도 서비스에 영향이 없다(좌표 없는 업체는 지도에서만 빠진다).
 * 새 업체가 쌓이면 운영자가 다시 돌린다. `lat IS NULL`인 업체만 골라 도니
 * 여러 번 돌려도 안전하다.
 *
 * 사용:
 *   DATABASE_URL=... KAKAO_REST_API_KEY=... npx tsx scripts/geocode-vendors.mts
 *
 * 카카오 REST API 키는 https://developers.kakao.com 에서 발급한다(무료 티어
 * 있음). Fly.io에는 KAKAO_REST_API_KEY 시크릿으로 등록해두면 배포 환경에서도
 * 같은 스크립트를 돌릴 수 있다.
 */
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

if (!DATABASE_URL || !KAKAO_REST_API_KEY) {
  console.error('DATABASE_URL, KAKAO_REST_API_KEY 가 필요합니다.');
  process.exit(1);
}

// 카카오 로컬 API 요율 제한(초당 요청 수)을 넘지 않게 호출 사이를 띄운다.
const DELAY_MS = 250;

type KakaoPlace = { x: string; y: string; address_name: string; road_address_name: string };

async function geocode(query: string): Promise<{ lat: number; lng: number; address: string } | null> {
  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  url.searchParams.set('query', query);
  url.searchParams.set('size', '1');

  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
  });

  if (!response.ok) {
    throw new Error(`카카오 API ${response.status}: ${await response.text()}`);
  }

  const body = (await response.json()) as { documents: KakaoPlace[] };
  const place = body.documents[0];

  if (!place) return null;

  return {
    lat: Number(place.y),
    lng: Number(place.x),
    address: place.road_address_name || place.address_name,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const { rows } = await client.query<{ id: string; name: string; region: string }>(
    `SELECT id, name, region FROM structured.vendors WHERE lat IS NULL ORDER BY name`
  );

  console.log(`좌표 없는 업체 ${rows.length}곳. 시작합니다.`);

  let geocoded = 0;
  let skipped = 0;

  for (const vendor of rows) {
    try {
      const result = await geocode(`${vendor.name} ${vendor.region}`);

      if (!result) {
        console.log(`  건너뜀 — 검색 결과 없음: ${vendor.name} (${vendor.region})`);
        skipped += 1;
      } else {
        await client.query(
          'UPDATE structured.vendors SET lat = $2, lng = $3, address = $4 WHERE id = $1',
          [vendor.id, result.lat, result.lng, result.address]
        );
        geocoded += 1;
        console.log(`  좌표 채움: ${vendor.name} → ${result.lat}, ${result.lng}`);
      }
    } catch (error) {
      console.error(`  실패: ${vendor.name} — ${(error as Error).message}`);
      skipped += 1;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n완료: ${geocoded}곳 채움, ${skipped}곳 건너뜀.`);

  await client.end();
}

await main();
