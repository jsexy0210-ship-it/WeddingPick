/**
 * 업체 공식 홈페이지에서 대표 이미지를 찾아 붙인다.
 *
 * 2026-09-10 사용자 오더 — 「우선 업체 공식 홈페이지의 대표 이미지를 사용한다 ·
 * 업체 정보는 지우지 말고 홈페이지 이미지를 활용해 최대한 매칭 시킨다」.
 *
 * 왜 이 방식인가. 지금 운영에 들어 있는 사진 720장은 「서울 웨딩홀」 같은 업종
 * 검색 결과를 업체마다 세 장씩 잘라 붙인 것이다 — 검색어에 업체 이름이 없어서
 * 그 업체 사진이라는 근거가 없다(match_confidence 0). 업체가 **자기 홈페이지에
 * 대표 이미지로 올려 둔 것**은 그 근거가 있다. 남의 사진을 그 업체 것으로
 * 보여주는 일을 먼저 막는다.
 *
 * 절차는 네 단계이고 각 단계에서 확신이 없으면 **넣지 않고 넘어간다**.
 *
 *   1) 홈페이지 찾기   업체명 + 지역으로 웹문서를 찾고, 포털·블로그·SNS·모아보기
 *                      사이트를 뺀 나머지에서 첫 후보를 고른다
 *   2) 확인            그 페이지를 열어 업체 이름이 제목·사이트 이름·본문에
 *                      나오는지 본다. 어디에도 없으면 버린다
 *   3) 대표 이미지     og:image → twitter:image → link[rel=image_src] 순으로 읽는다
 *   4) 신뢰도          이름이 어디에 나왔는지로 정한다. 0.5 미만은 화면에 나가지
 *                      않는다(packages/domain/src/vendor-image.ts)
 *
 * 확인만:  npx tsx scripts/vendor-homepage-images.ts
 * 실제로:  npx tsx scripts/vendor-homepage-images.ts --yes
 */
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
const APPLY = process.argv.includes('--yes');
/** 한 번에 볼 업체 수. 카카오 검색은 하루 30,000회라 나눠 돌린다. */
const LIMIT = Number(process.env.LIMIT ?? 300);
/** 한 페이지에 이만큼 넘게 기다리지 않는다. */
const TIMEOUT_MS = 10_000;

if (!url) {
  console.error('::error::DATABASE_URL이 없다.');
  process.exit(1);
}

const kakaoKey = process.env.KAKAO_APP_KEY;

if (!kakaoKey) {
  console.error('::error::KAKAO_APP_KEY(카카오 REST API 키)가 없다 — infra/render-env.yml과 같은 이름이다.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
});

/**
 * 업체 홈페이지가 아닌 곳. 여기 걸리면 후보에서 뺀다.
 *
 * 블로그 · 카페 · SNS · 뉴스 · 지도 · 모아보기 사이트는 그 업체가 만든 곳이
 * 아니다. 거기 실린 사진은 업체가 대표로 내건 것이 아니라 남이 찍어 올린 것이라
 * 「공식 홈페이지의 대표 이미지」가 되지 않는다.
 */
const NOT_A_HOMEPAGE =
  /(^|\.)(blog|cafe|post|m|search|news|map|place|shopping|tv|kin|book|dict)\.(naver|daum|kakao)\.|tistory\.com|blogspot\.|wordpress\.com|instagram\.com|facebook\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|pinterest\.|linkedin\.com|band\.us|brunch\.co\.kr|wikipedia\.org|namu\.wiki|google\.|bing\.com|yelp\.|tripadvisor\.|coupang\.com|11st\.co\.kr|gmarket\.co\.kr|auction\.co\.kr|interpark\.com|wadiz\.kr|jobkorea\.co\.kr|saramin\.co\.kr|catch\.co\.kr|work\.go\.kr|nts\.go\.kr|\.go\.kr$|\.or\.kr$/i;

type WebDocument = { url: string; title: string; contents: string };

/** 카카오 웹문서 검색. 업체명 + 지역으로 후보 주소를 받는다. */
async function searchWeb(query: string): Promise<WebDocument[]> {
  const endpoint = new URL('https://dapi.kakao.com/v2/search/web');

  endpoint.searchParams.set('query', query);
  endpoint.searchParams.set('size', '10');

  const response = await fetch(endpoint, {
    headers: { Authorization: `KakaoAK ${kakaoKey}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (response.status === 429) throw new Error('카카오 검색 한도를 넘겼다 — 오늘은 여기까지다.');
  if (!response.ok) return [];

  const body = (await response.json()) as { documents?: WebDocument[] };

  return body.documents ?? [];
}

/** 태그를 걷어낸 맨 글자. 검색 결과 제목에는 <b> 강조가 섞여 온다. */
function plain(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
}

/** 이름 비교용. 띄어쓰기와 기호를 지운다 — 「더채플 앳 청담」과 「더채플앳청담」은 같다. */
function squash(value: string): string {
  return value.toLowerCase().replace(/[\s()[\]{}·・,.\-_/'"]/g, '');
}

type Page = { html: string; finalUrl: string };

async function get(target: string): Promise<Page | null> {
  try {
    const response = await fetch(target, {
      headers: { accept: 'text/html,*/*', 'user-agent': 'WeddingpickBot/1.0 (+대표 이미지 확인)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const type = response.headers.get('content-type') ?? '';

    if (!type.includes('html')) return null;

    /* 첫 200 KB면 <head>는 다 들어온다. 그 뒤는 읽지 않는다. */
    const html = (await response.text()).slice(0, 200 * 1024);

    return { html, finalUrl: response.url || target };
  } catch {
    return null;
  }
}

function meta(html: string, property: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`,
    'i',
  );
  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${property}["']`,
    'i',
  );

  return pattern.exec(html)?.[1] ?? reversed.exec(html)?.[1] ?? null;
}

function title(html: string): string {
  return plain(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html)?.[1] ?? '');
}

/** 대표 이미지 자리를 순서대로 본다. 상대 주소는 페이지 주소로 절대 주소를 만든다. */
function representativeImage(page: Page): string | null {
  const found =
    meta(page.html, 'og:image') ??
    meta(page.html, 'twitter:image') ??
    /<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i.exec(page.html)?.[1] ??
    null;

  if (!found) return null;

  try {
    const absolute = new URL(found, page.finalUrl);

    return absolute.protocol === 'https:' || absolute.protocol === 'http:' ? absolute.href : null;
  } catch {
    return null;
  }
}

/**
 * 이 페이지가 그 업체의 것인지 얼마나 확신하는가.
 *
 * 0.5 미만은 화면에 나가지 않는다(MIN_IMAGE_MATCH_CONFIDENCE). 그래서 이름이
 * 어디에도 없으면 아예 넣지 않고, 본문에만 있으면 문턱 바로 위에 둔다 — 나가긴
 * 하되 업체가 직접 준 것(1.0)과 같은 값을 주지 않는다.
 */
function confidence(vendorName: string, page: Page): number {
  const name = squash(vendorName);

  if (name.length < 2) return 0;

  const host = squash(new URL(page.finalUrl).host);
  const siteName = squash(plain(meta(page.html, 'og:site_name') ?? ''));
  const pageTitle = squash(title(page.html));
  const body = squash(plain(page.html.replace(/<script[\s\S]*?<\/script>/gi, '')));

  if (siteName.includes(name) || host.includes(name)) return 0.9;
  if (pageTitle.includes(name)) return 0.8;
  if (body.includes(name)) return 0.6;

  return 0;
}

type Vendor = { id: string; name: string; region: string };

/**
 * 왜 못 붙였는가.
 *
 * **한 이름으로 묶지 않는다.** 처음에는 후보가 하나도 안 남은 것과 페이지를 못 읽은
 * 것과 이름이 안 맞은 것을 전부 「이름 확인 실패」로 셌다. 100곳이 전부 그 하나로
 * 나왔는데, 어디서 떨어지는지 알 수 없어 무엇을 고쳐야 할지도 알 수 없었다.
 *
 *   검색 결과 없음     묻는 말이 틀렸다
 *   전부 포털·블로그    거르는 목록이 너무 넓거나, 그 업체에 공식 홈페이지가 없다
 *   페이지 못 읽음      막혔거나 죽은 주소다
 *   이름 확인 실패      찾긴 했는데 그 업체 페이지가 아니다
 *   대표 이미지 없음    맞는 페이지인데 og:image가 없다
 */
type Outcome =
  | '붙임'
  | '검색 결과 없음'
  | '전부 포털·블로그'
  | '페이지 못 읽음'
  | '이름 확인 실패'
  | '대표 이미지 없음';

async function forVendor(vendor: Vendor): Promise<{ outcome: Outcome; homepage: string | null }> {
  /* 지역을 함께 넣는다 — 같은 이름의 다른 지역 업체를 잡지 않기 위해서다. */
  const documents = await searchWeb(`${vendor.name} ${vendor.region.split(' ')[0] ?? ''}`.trim());

  /* 어디서 떨어졌는지 세어 둔다. 마지막에 가장 멀리 간 이유를 결과로 쓴다. */
  let candidates = 0;
  let fetched = 0;

  for (const document of documents) {
    let host: string;

    try {
      host = new URL(document.url).host;
    } catch {
      continue;
    }
    if (NOT_A_HOMEPAGE.test(host)) continue;

    candidates += 1;

    const page = await get(document.url);

    if (!page) continue;

    fetched += 1;

    const matched = confidence(vendor.name, page);

    if (matched < 0.5) continue;

    const image = representativeImage(page);

    if (!image) return { outcome: '대표 이미지 없음', homepage: page.finalUrl };

    if (APPLY) {
      /*
       * 대표 이미지는 업체마다 하나다(0050 vendor_images_representative_idx).
       * 이미 있으면 대표로 세우지 않고 한 장 더 붙인다 — 먼저 있던 것을
       * 끌어내리지 않는다.
       */
      const { rows } = await pool.query<{ 있다: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM structured.vendor_images
            WHERE vendor_id = $1 AND is_representative AND status = 'approved') AS 있다`,
        [vendor.id],
      );

      await pool.query(
        `INSERT INTO structured.vendor_images
           (vendor_id, source_url, copyright_basis, copyright_note,
            match_confidence, status, is_representative, verified_at)
         VALUES ($1, $2, 'vendor_homepage', $3, $4, 'approved', $5, now())`,
        [vendor.id, image, `업체 공식 홈페이지 대표 이미지 · ${host}`, matched, !rows[0]?.있다],
      );

      await pool.query(
        'UPDATE structured.vendors SET homepage_url = $2, homepage_checked_at = now() WHERE id = $1',
        [vendor.id, page.finalUrl],
      );
    }

    return { outcome: '붙임', homepage: page.finalUrl };
  }

  if (APPLY) {
    /* 못 찾았어도 본 시각을 적는다 — 같은 업체를 매번 다시 찾지 않기 위해서다. */
    await pool.query(
      'UPDATE structured.vendors SET homepage_checked_at = now() WHERE id = $1',
      [vendor.id],
    );
  }

  /* 가장 멀리 간 곳을 이유로 삼는다 — 「검색은 됐는데 전부 포털」과 「아예 안 나왔다」는 다른 말이다. */
  if (documents.length === 0) return { outcome: '검색 결과 없음', homepage: null };
  if (candidates === 0) return { outcome: '전부 포털·블로그', homepage: null };
  if (fetched === 0) return { outcome: '페이지 못 읽음', homepage: null };

  return { outcome: '이름 확인 실패', homepage: null };
}

async function main(): Promise<void> {
  /*
   * 화면에 내보낼 사진이 하나도 없는 업체부터 본다. 이미 나가는 사진이 있는
   * 곳은 급하지 않다. 한 번 찾아본 업체는 건너뛴다.
   */
  const { rows: vendors } = await pool.query<Vendor>(
    `SELECT v.id, v.name, v.region
       FROM structured.vendors v
      WHERE v.homepage_checked_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM structured.vendor_images i
           WHERE i.vendor_id = v.id
             AND i.status = 'approved'
             AND i.copyright_basis <> 'unknown'
             AND i.match_confidence >= 0.5)
      ORDER BY v.name
      LIMIT $1`,
    [LIMIT],
  );

  console.log(`${APPLY ? '붙인다' : '확인만 한다'} — 대상 업체 ${vendors.length}곳\n`);

  const tally = new Map<Outcome, number>();

  for (const vendor of vendors) {
    const { outcome, homepage } = await forVendor(vendor);

    tally.set(outcome, (tally.get(outcome) ?? 0) + 1);

    /* 업체 이름과 결과만 찍는다. 이미지 주소 전체는 로그에 남기지 않는다. */
    if (outcome === '붙임') console.log(`  ${vendor.name}  ←  ${homepage ? new URL(homepage).host : ''}`);
  }

  console.log('\n결과');
  for (const [outcome, count] of [...tally].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${outcome.padEnd(16)} ${count}`);
  }

  if (!APPLY) console.log('\n확인만 했다. 실제로 붙이려면 --yes를 붙인다.');

  await pool.end();
}

main().catch((error: Error) => {
  console.error(`::error::실패: ${error.message.split('\n')[0]}`);
  process.exit(1);
});
