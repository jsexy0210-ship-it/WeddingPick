import { VENDOR_CATEGORIES, VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import type { PoolClient } from 'pg';

import { loadConfig } from './config';
import { createPool, withTransaction } from './db';

/**
 * 업종별 샘플 업체 100곳씩 — 화면 검수용(2026-09-08 오더).
 *
 *   npm run seed:samples --workspace @weddingpick/api -- --yes
 *   npm run seed:samples --workspace @weddingpick/api -- --remove --yes
 *
 * **지어낸 업체다.** 실제 사업자와 이름이 겹쳐도 우연이다. 진짜 자료와 섞이지
 * 않게 `vendor_source_records(source_key='sample')`로 전부 표시해 두고, `--remove`가
 * 그 표시를 따라 한 번에 걷어낸다. 두 번 돌려도 같은 이름을 만든다(고정 시드
 * 난수) — (정규화 이름, 지역) 유일 제약에 걸려 두 번 들어가지 않는다.
 *
 * 이미지는 구글 검색 결과를 긁지 않는다 — 약관 위반이고 업체 사진은 저작권이
 * 있다. Flickr CC 사진을 키워드로 돌려주는 loremflickr 주소를 쓴다(cc_by).
 * 실제 업체 사진은 «권리 확보 후 교체» 항목 그대로다(핸드오프 보류 목록).
 *
 * 확인된 정보(결제인증) 건수는 0~2 · 3~4 · 5~9 · 10+ 네 단계가 다 보이게 흩는다
 * (CLAUDE.md §3 «확인된 정보 4단계») — 한 단계만 있으면 화면이 그 경계를
 * 맞게 그리는지 볼 수 없다.
 */

const SOURCE_KEY = 'sample';
const PER_CATEGORY = 20;
const REPORTER_COUNT = 40;
/** display_name은 5자까지(users_display_name_check). 진짜 계정과는 identities가 없다는 것으로 가른다. */
const REPORTER_NAME = (n: number) => `표본${n}`;

function argv(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** mulberry32 — 고정 시드. 돌릴 때마다 같은 업체가 나와야 중복이 안 쌓인다. */
function rng(seed: number) {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Region = { name: string; lat: number; lng: number; weight: number };

const REGIONS: Region[] = [
  { name: '서울 강남구', lat: 37.5172, lng: 127.0473, weight: 6 },
  { name: '서울 서초구', lat: 37.4837, lng: 127.0324, weight: 4 },
  { name: '서울 송파구', lat: 37.5145, lng: 127.1059, weight: 3 },
  { name: '서울 마포구', lat: 37.5663, lng: 126.9014, weight: 3 },
  { name: '서울 용산구', lat: 37.5326, lng: 126.9905, weight: 2 },
  { name: '서울 영등포구', lat: 37.5264, lng: 126.8963, weight: 2 },
  { name: '서울 중구', lat: 37.5641, lng: 126.9979, weight: 2 },
  { name: '서울 종로구', lat: 37.5735, lng: 126.979, weight: 1 },
  { name: '서울 성동구', lat: 37.5634, lng: 127.0369, weight: 1 },
  { name: '서울 광진구', lat: 37.5385, lng: 127.0823, weight: 1 },
  { name: '경기 성남시', lat: 37.42, lng: 127.1265, weight: 3 },
  { name: '경기 수원시', lat: 37.2636, lng: 127.0286, weight: 3 },
  { name: '경기 고양시', lat: 37.6584, lng: 126.832, weight: 2 },
  { name: '경기 용인시', lat: 37.2411, lng: 127.1776, weight: 2 },
  { name: '경기 안양시', lat: 37.3943, lng: 126.9568, weight: 1 },
  { name: '인천 연수구', lat: 37.4102, lng: 126.6784, weight: 2 },
  { name: '인천 남동구', lat: 37.4474, lng: 126.7313, weight: 1 },
  { name: '부산 해운대구', lat: 35.1631, lng: 129.1636, weight: 2 },
  { name: '부산 부산진구', lat: 35.1631, lng: 129.0532, weight: 1 },
  { name: '대구 수성구', lat: 35.8582, lng: 128.6306, weight: 1 },
  { name: '대전 서구', lat: 36.3553, lng: 127.3838, weight: 1 },
  { name: '광주 서구', lat: 35.152, lng: 126.8902, weight: 1 },
];

type Recipe = {
  prefixes: string[];
  suffixes: string[];
  /** loremflickr 키워드. 쉼표로 AND. */
  keywords: string;
  /** 결제 금액 범위(원). */
  amount: [number, number];
};

const RECIPES: Record<VendorCategory, Recipe> = {
  hall: {
    prefixes: ['더채플', '라비돌', '아펠', '그랜드', '루체', '빌라드', '더컨벤션', '파티오', '헤리티지', '노블', '메종', '베르사유', '비체', '오네스타', '드마리스', '플로렌스', '라온', '아모리스', '루이비스', '엘리에나', '더링크', '세인트', '카이저', '더파티', '글로리', '보테가', '까사', '팔레스', '샤르망', '에벤에셀'],
    suffixes: ['웨딩홀', '컨벤션', '호텔웨딩', '채플', '가든', '스퀘어', '팰리스', '하우스'],
    keywords: 'wedding,hall,banquet',
    amount: [15_000_000, 45_000_000],
  },
  sdm: {
    prefixes: ['별빛', '하늘', '고운', '온유', '모던', '블랑', '뮤즈', '아뜰리에', '리안', '소예', '라포레', '에스더', '제이', '루나', '베르', '메이', '헤르츠', '오드', '피오니', '샤이닝', '로즈', '아르페', '클로에', '이든', '유니크', '더블유', '벨라', '클래식', '그레이스', '노아'],
    suffixes: ['스튜디오', '드레스', '메이크업', '스드메', '브라이덜', '살롱'],
    keywords: 'wedding,dress,studio',
    amount: [2_200_000, 5_500_000],
  },
  snap: {
    prefixes: ['온', '필름', '데이', '모먼트', '기록', '봄날', '순간', '라이트', '포에', '아침', '둘', '오늘', '노을', '숲', '바다', '별', '달', '윤슬', '결', '틈', '여름', '가을', '겨울', '새벽', '해질녘', '밤', '햇살', '바람', '이야기', '너와'],
    suffixes: ['스냅', '영상', '필름', '포토', '스튜디오', '픽처스'],
    keywords: 'wedding,photography',
    amount: [800_000, 2_500_000],
  },
  goods: {
    prefixes: ['골든', '루미에르', '다이아', '브릴리언트', '로얄', '클래식', '에떼', '벨르', '아모르', '보석', '주얼', '티파', '펄', '오로', '샤인', '라뜰', '피네', '리츠', '로만', '실버', '한복', '규방', '예단', '진주', '금은', '옥', '수정', '온새미', '단아', '고운'],
    suffixes: ['주얼리', '예물', '예단', '한복', '골드', '컬렉션'],
    keywords: 'wedding,ring,jewelry',
    amount: [3_000_000, 15_000_000],
  },
  honeymoon: {
    prefixes: ['블루', '오션', '허니', '아일랜드', '파라다이스', '트래블', '투어', '리조트', '선셋', '팜', '몰디브', '발리', '칸쿤', '하와이', '산토리니', '보라카이', '세부', '푸켓', '코타', '괌', '사이판', '타히티', '피지', '모리셔스', '두바이', '로마', '파리', '프라하', '스위스', '홋카이도'],
    suffixes: ['허니문', '트래블', '투어', '여행사', '홀리데이'],
    keywords: 'honeymoon,beach,resort',
    amount: [4_000_000, 12_000_000],
  },
  wedding_info_company: {
    prefixes: ['듀오', '가연', '노블', '레드힐', '선우', '바로', '천생', '인연', '커플', '연리지', '결', '만남', '하나', '온리', '베스트', '프리미엄', '로얄', '엘리트', '퍼스트', '스마트', '행복', '좋은', '참', '진', '설렘', '두근', '정담', '연분', '동행', '평생'],
    suffixes: ['결혼정보', '매칭', '커플매니저', '결정사', '메리지'],
    keywords: 'couple,wedding',
    amount: [1_500_000, 6_000_000],
  },
  etc: {
    prefixes: ['플라워', '블룸', '페탈', '데코', '아트', '뮤직', '사회자', '축가', '캘리', '청첩', '카드', '답례', '떡', '케이크', '샴페인', '버스', '리무진', '웨딩카', '주례', '통역', '헬퍼', '이모님', '한복대여', '부케', '리본', '조명', '무대', '음향', '영상편지', '방명록'],
    suffixes: ['웨딩', '스튜디오', '컴퍼니', '하우스', '랩', '팀'],
    keywords: 'wedding,flowers',
    amount: [300_000, 3_000_000],
  },
};

const ACTIVE_USER = `INSERT INTO structured.users
     (display_name, age_gate, age_checked_at, age_verified, age_verified_at, activated_at)
   VALUES ($1, 'passed', now(), true, now(), now()) RETURNING id`;

function pickWeighted(random: () => number): Region {
  const total = REGIONS.reduce((sum, r) => sum + r.weight, 0);
  let roll = random() * total;

  for (const region of REGIONS) {
    roll -= region.weight;
    if (roll <= 0) return region;
  }

  return REGIONS[0]!;
}

/** 0~2 · 3~4 · 5~9 · 10+ — 네 단계가 다 나오게. */
function proofCount(random: () => number): number {
  const roll = random();

  if (roll < 0.3) return Math.floor(random() * 3);
  if (roll < 0.5) return 3 + Math.floor(random() * 2);
  if (roll < 0.75) return 5 + Math.floor(random() * 5);

  return 10 + Math.floor(random() * 9);
}

function slug(category: string, index: number): string {
  return `${category}-${String(index + 1).padStart(3, '0')}`;
}

async function seedReporters(client: PoolClient): Promise<string[]> {
  const ids: string[] = [];

  for (let n = 1; n <= REPORTER_COUNT; n += 1) {
    const existing = await client.query<{ id: string }>(
      `SELECT u.id FROM structured.users u
       WHERE u.display_name = $1 AND u.display_name_user_set = false
         AND NOT EXISTS (SELECT 1 FROM identity.identities i WHERE i.user_id = u.id)
       LIMIT 1`,
      [REPORTER_NAME(n)]
    );

    if (existing.rows[0]) {
      ids.push(existing.rows[0].id);
      continue;
    }

    const { rows } = await client.query<{ id: string }>(ACTIVE_USER, [REPORTER_NAME(n)]);

    ids.push(rows[0]!.id);
  }

  return ids;
}

type Sample = {
  key: string;
  name: string;
  region: Region;
  lat: number;
  lng: number;
  lock: number;
  proofs: { amount: number; daysAgo: number; reporter: number }[];
};

/**
 * 업종 하나의 표본 100개를 **먼저 전부 뽑는다.** 난수를 DB 결과와 무관하게 같은
 * 순서로 쓰기 위해서다 — 이미 있는 업체를 건너뛰면서 난수를 덜 쓰면 그 뒤의
 * 이름이 전부 달라져 두 번째 실행이 새 업체를 또 만든다(처음에 그랬다).
 */
function drawSamples(category: VendorCategory): Sample[] {
  const recipe = RECIPES[category];
  const random = rng(category.split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 7));
  const used = new Set<string>();
  const samples: Sample[] = [];

  for (let index = 0; index < PER_CATEGORY; index += 1) {
    let name = '';
    let region = REGIONS[0]!;

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const prefix = recipe.prefixes[Math.floor(random() * recipe.prefixes.length)]!;
      const suffix = recipe.suffixes[Math.floor(random() * recipe.suffixes.length)]!;

      region = pickWeighted(random);
      name = `${prefix}${suffix}`;

      if (!used.has(`${name}|${region.name}`)) break;
    }

    used.add(`${name}|${region.name}`);

    const lat = region.lat + (random() - 0.5) * 0.04;
    const lng = region.lng + (random() - 0.5) * 0.05;
    const count = proofCount(random);
    const [low, high] = recipe.amount;
    const proofs: Sample['proofs'] = [];

    for (let n = 0; n < count; n += 1) {
      proofs.push({
        amount: Math.round((low + random() * (high - low)) / 10_000) * 10_000,
        daysAgo: 5 + Math.floor(random() * 340),
        reporter: (index * 7 + n) % REPORTER_COUNT,
      });
    }

    samples.push({
      key: slug(category, index),
      name,
      region,
      lat,
      lng,
      lock: 1000 + VENDOR_CATEGORIES.indexOf(category) * PER_CATEGORY + index,
      proofs,
    });
  }

  return samples;
}

async function seedCategory(client: PoolClient, category: VendorCategory, reporters: string[]) {
  const recipe = RECIPES[category];
  const samples = drawSamples(category);

  /*
   * 한 업종을 질의 네 번으로 넣는다(업체 · 출처 표시 · 이미지 · 결제인증). 한 행씩
   * 넣으면 5,700번 왕복이라 원격 DB에서는 20분 제한을 넘겼다(2026-09-08 run 1).
   * UNNEST로 배열을 행으로 펼쳐 한 번에 넣고, 유일 제약에 걸린 업체는
   * RETURNING에 안 나오므로 그 뒤 것들도 자연히 빠진다.
   */
  const { rows } = await client.query<{ id: string; name: string; region: string }>(
    `INSERT INTO structured.vendors (category, name, region, source, lat, lng, collection_status)
     SELECT $1::vendor_category, name, region, 'vendor_official', lat, lng, 'operating'
     FROM UNNEST($2::text[], $3::text[], $4::float8[], $5::float8[]) AS t(name, region, lat, lng)
     ON CONFLICT (normalized_name, region) DO NOTHING
     RETURNING id, name, region`,
    [
      category,
      samples.map((sample) => sample.name),
      samples.map((sample) => sample.region.name),
      samples.map((sample) => sample.lat),
      samples.map((sample) => sample.lng),
    ]
  );

  const idOf = new Map(rows.map((row) => [`${row.name}|${row.region}`, row.id]));
  const inserted = samples.filter((sample) => idOf.has(`${sample.name}|${sample.region.name}`));
  const skipped = samples.length - inserted.length;

  if (inserted.length === 0) return { inserted: 0, skipped };

  const vendorId = (sample: Sample) => idOf.get(`${sample.name}|${sample.region.name}`)!;

  await client.query(
    `INSERT INTO structured.vendor_source_records
       (source_key, record_key, vendor_id, source_url, collected_at, content_hash)
     SELECT $1, key, vendor_id::uuid, 'sample://weddingpick/' || key, now(), 'sample'
     FROM UNNEST($2::text[], $3::text[]) AS t(key, vendor_id)
     ON CONFLICT (source_key, record_key) DO NOTHING`,
    [SOURCE_KEY, inserted.map((sample) => sample.key), inserted.map(vendorId)]
  );

  /* 대표 이미지 한 장씩. lock 값이 같으면 같은 사진이 돌아온다 — 새로고침마다 바뀌지 않는다. */
  await client.query(
    `INSERT INTO structured.vendor_images
       (vendor_id, source_url, copyright_basis, copyright_note, match_confidence,
        width_px, height_px, status, is_representative, verified_at)
     SELECT vendor_id::uuid, url, 'cc_by', $3, 0, 800, 500, 'approved', true, now()
     FROM UNNEST($1::text[], $2::text[]) AS t(vendor_id, url)`,
    [
      inserted.map(vendorId),
      inserted.map((sample) => `https://loremflickr.com/800/500/${recipe.keywords}?lock=${sample.lock}`),
      '샘플 이미지 · Flickr CC BY(loremflickr). 실제 업체 사진이 아니다.',
    ]
  );

  /* 확인된 정보 — 최근 12개월 안의 결제인증. 업종당 한 번에. */
  const proofs = inserted.flatMap((sample) =>
    sample.proofs.map((proof) => ({
      reporter: reporters[proof.reporter]!,
      vendorId: vendorId(sample),
      merchant: sample.name,
      amount: proof.amount,
      daysAgo: proof.daysAgo,
    }))
  );

  if (proofs.length > 0) {
    await client.query(
      `INSERT INTO structured.payment_proofs
         (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at, method, analyzed_at)
       SELECT reporter::uuid, vendor_id::uuid, merchant, amount, now() - (days || ' days')::interval, 'card', now()
       FROM UNNEST($1::text[], $2::text[], $3::text[], $4::bigint[], $5::text[])
         AS t(reporter, vendor_id, merchant, amount, days)
       ON CONFLICT DO NOTHING`,
      [
        proofs.map((proof) => proof.reporter),
        proofs.map((proof) => proof.vendorId),
        proofs.map((proof) => proof.merchant),
        proofs.map((proof) => proof.amount),
        proofs.map((proof) => String(proof.daysAgo)),
      ]
    );
  }

  return { inserted: inserted.length, skipped };
}

async function remove(client: PoolClient) {
  const vendors = await client.query<{ vendor_id: string }>(
    'SELECT vendor_id FROM structured.vendor_source_records WHERE source_key = $1',
    [SOURCE_KEY]
  );
  const ids = vendors.rows.map((row) => row.vendor_id);

  await client.query('DELETE FROM structured.vendor_source_records WHERE source_key = $1', [SOURCE_KEY]);
  /* 결제인증은 업체·제보자가 지워져도 SET NULL로 남는다(탈퇴 정책) — 샘플은 흔적 없이 걷는다. */
  await client.query('DELETE FROM structured.payment_proofs WHERE vendor_id = ANY($1::uuid[])', [ids]);
  await client.query('DELETE FROM structured.vendors WHERE id = ANY($1::uuid[])', [ids]);
  await client.query(
    `DELETE FROM structured.users u
     WHERE u.display_name_user_set = false AND u.display_name ~ '^표본[0-9]+$'
       AND NOT EXISTS (SELECT 1 FROM identity.identities i WHERE i.user_id = u.id)`
  );

  return ids.length;
}

async function main(): Promise<void> {
  if (!argv('yes')) {
    console.error(
      '지어낸 업체를 넣는다. 정말 넣으려면 --yes를 붙일 것.\n' +
        '  npm run seed:samples --workspace @weddingpick/api -- --yes\n' +
        '  npm run seed:samples --workspace @weddingpick/api -- --remove --yes'
    );
    process.exitCode = 1;
    return;
  }

  const pool = createPool(loadConfig().databaseUrl);

  try {
    await withTransaction(pool, async (client) => {
      if (argv('remove')) {
        const removed = await remove(client);

        console.log(`샘플 업체 ${removed}곳과 샘플 제보자를 지웠다.`);
        return;
      }

      const reporters = await seedReporters(client);

      for (const category of VENDOR_CATEGORIES) {
        const result = await seedCategory(client, category, reporters);

        console.log(
          `${VENDOR_CATEGORY_LABEL[category]}: ${result.inserted}곳 넣음, ${result.skipped}곳 이미 있음`
        );
      }
    });
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
