import { PREPARATION_CATEGORIES, VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import type { PoolClient } from 'pg';

import { loadConfig } from './config';
import { createPool, withTransaction } from './db';

/**
 * 웨딩노트(캘린더 · 상담기록 · 예산현황) · Pick 화면 검수용 샘플 — 2026-09-15 대표 지시
 * 「웨딩노트 3개탭 / Pick — 샘플 데이터 넣어놔라」.
 *
 *   npm run seed:wedding-tabs --workspace @weddingpick/api -- --yes
 *   npm run seed:wedding-tabs --workspace @weddingpick/api -- --remove --yes
 *
 * **이미 있는 웨딩(structured.weddings)에만 채운다.** 온보딩을 마쳐 웨딩이 생긴
 * 계정이라야 이 화면들이 보인다 — 새 계정 · 새 웨딩을 만들지 않는다.
 *
 * **Pick 후보는 이미 있는 업체(structured.vendors)에서만 고른다.** 새 업체를
 * 지어내지 않는다 — `seed:samples`(업체 샘플)가 먼저 돌아 있어야 그 업종에
 * 후보가 생긴다. 없는 업종은 조용히 건너뛴다.
 *
 * **지울 수 있게 표시한다.** 제목 · 항목명 앞에 `[샘플] `을 붙이고(사람이 보고
 * 안다), 상담기록은 `common._seedTag`에, Pick 후보는 `note`에 SEED_TAG를 심는다
 * (기계가 정확히 골라 지운다). `--remove`가 이 표시만 따라 지운다 — 실제 사용자
 * 데이터는 건드리지 않는다.
 *
 * **두 번 돌려도 늘어나지 않는다.** 웨딩마다 이미 `[샘플] ` 제목의 캘린더 일정이
 * 있으면 그 웨딩은 건너뛴다.
 */

const SEED_TAG = 'wedding-tabs-sample-v1';
const TITLE_PREFIX = '[샘플] ';

function argv(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function pickVendor(
  client: PoolClient,
  category: VendorCategory
): Promise<{ id: string; name: string } | null> {
  const { rows } = await client.query<{ id: string; name: string }>(
    `SELECT id, name FROM structured.vendors WHERE category = $1 ORDER BY random() LIMIT 1`,
    [category]
  );
  return rows[0] ?? null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function seedCalendar(client: PoolClient, weddingId: string, categories: readonly VendorCategory[]) {
  const offsets = [7, 14, 21, 30, 45, 60];
  const now = Date.now();

  for (let i = 0; i < offsets.length; i += 1) {
    const category = categories[i % categories.length]!;
    const vendor = await pickVendor(client, category);

    await client.query(
      `INSERT INTO structured.wedding_events
         (wedding_id, title, starts_at, location, vendor_id, vendor_label, notify_enabled, source)
       VALUES ($1, $2, $3, $4, $5, $6, true, 'manual')`,
      [
        weddingId,
        `${TITLE_PREFIX}${VENDOR_CATEGORY_LABEL[category]} 상담`,
        new Date(now + offsets[i]! * DAY_MS),
        '서울',
        vendor?.id ?? null,
        vendor ? null : `${VENDOR_CATEGORY_LABEL[category]} 업체`,
      ]
    );
  }
}

async function seedConsultations(client: PoolClient, weddingId: string, categories: readonly VendorCategory[]) {
  for (let i = 0; i < categories.length; i += 1) {
    const category = categories[i]!;
    const vendor = await pickVendor(client, category);
    const amount = 1_000_000 + i * 1_500_000;
    const confirmed = i % 2 === 0;
    const label = vendor ? `${TITLE_PREFIX}${vendor.name}` : `${TITLE_PREFIX}${VENDOR_CATEGORY_LABEL[category]} 업체`;

    await client.query(
      `INSERT INTO structured.consultation_records
         (wedding_id, vendor_id, vendor_label, status, category, confidence, common, confirmed_at, consent_version)
       VALUES ($1, $2, $3, 'SUPPORTED_WEDDING_CONSULTATION', $4, 0.9, $5::jsonb, $6, 'seed-v1')`,
      [
        weddingId,
        vendor?.id ?? null,
        label,
        VENDOR_CATEGORY_LABEL[category],
        JSON.stringify({ finalAmount: { value: amount }, _seedTag: SEED_TAG }),
        confirmed ? new Date() : null,
      ]
    );
  }
}

const BUDGET_AMOUNT = 35_000_000;

async function seedBudget(client: PoolClient, weddingId: string) {
  await client.query(
    `UPDATE structured.weddings SET budget_amount = COALESCE(budget_amount, $2) WHERE id = $1`,
    [weddingId, BUDGET_AMOUNT]
  );

  const items: Array<{ category: VendorCategory; amount: number }> = [
    { category: 'hall', amount: 12_000_000 },
    { category: 'studio', amount: 2_500_000 },
    { category: 'dress', amount: 1_800_000 },
    { category: 'makeup', amount: 900_000 },
    { category: 'snap', amount: 3_200_000 },
    { category: 'honeymoon', amount: 5_000_000 },
  ];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    await client.query(
      `INSERT INTO structured.expenses (wedding_id, label, amount, category, status, spent_on)
       VALUES ($1, $2, $3, $4::vendor_category, 'paid', $5)`,
      [
        weddingId,
        `${TITLE_PREFIX}${VENDOR_CATEGORY_LABEL[item.category]} 계약금`,
        item.amount,
        item.category,
        new Date(Date.now() - (i + 1) * 7 * DAY_MS),
      ]
    );
  }
}

async function seedPick(client: PoolClient) {
  return async (weddingId: string) => {
    let decided = 0;

    for (const category of PREPARATION_CATEGORIES) {
      const vendor = await pickVendor(client, category);
      if (!vendor) continue;

      await client.query(
        `INSERT INTO structured.vendor_candidates (wedding_id, vendor_id, note)
         VALUES ($1, $2, $3)
         ON CONFLICT (wedding_id, vendor_id) DO NOTHING`,
        [weddingId, vendor.id, SEED_TAG]
      );

      if (decided < 2) {
        await client.query(
          `INSERT INTO structured.category_decisions (wedding_id, category, vendor_id)
           VALUES ($1, $2::vendor_category, $3)
           ON CONFLICT (wedding_id, category) DO NOTHING`,
          [weddingId, category, vendor.id]
        );
        decided += 1;
      }
    }
  };
}

async function seedForWedding(client: PoolClient, weddingId: string): Promise<void> {
  const categories = PREPARATION_CATEGORIES.slice(0, 6);

  await seedCalendar(client, weddingId, categories);
  await seedConsultations(client, weddingId, categories);
  await seedBudget(client, weddingId);
  await (await seedPick(client))(weddingId);
}

/**
 * 박람회(structured.expos)는 웨딩에 매달지 않는 전역 목록이다(업체와 같은 성격).
 * 라운지 «박람회» 탭은 목록을 그 안에서 그리지 않고 `/search/expo`로 보내기만
 * 하지만(WP-EXPO-001, 검색 세션 담당), 그 화면이 읽는 표가 이것이라 같이 채운다 —
 * 화면 코드는 건드리지 않는다.
 */
const EXPOS: Array<{ title: string; region: string; venue: string; daysFromNow: number; benefit: string }> = [
  { title: '서울 웨딩박람회', region: '서울', venue: '코엑스 컨벤션홀', daysFromNow: 20, benefit: '방문 시 스드메 상담권 제공' },
  { title: '경기 웨딩페어', region: '경기', venue: '킨텍스 제2전시장', daysFromNow: 34, benefit: '현장 예약 시 계약금 할인' },
  { title: '인천 웨딩박람회', region: '인천', venue: '송도컨벤시아', daysFromNow: 48, benefit: '방문 선물 증정' },
  { title: '부산 웨딩페어', region: '부산', venue: '벡스코', daysFromNow: 62, benefit: '스튜디오 원본 추가 증정' },
  { title: '대전 웨딩박람회', region: '대전', venue: '대전컨벤션센터', daysFromNow: 76, benefit: '허니문 상담 할인' },
];

async function seedExpos(client: PoolClient): Promise<void> {
  const { rows: already } = await client.query(
    `SELECT 1 FROM structured.expos WHERE source_note = $1 LIMIT 1`,
    [SEED_TAG]
  );
  if (already.length > 0) return;

  const now = Date.now();

  for (const expo of EXPOS) {
    const startsAt = new Date(now + expo.daysFromNow * DAY_MS);
    const endsAt = new Date(now + (expo.daysFromNow + 1) * DAY_MS);

    await client.query(
      `INSERT INTO structured.expos
         (title, organizer, starts_at, ends_at, venue, region, benefits, description, source_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
      [
        `${TITLE_PREFIX}${expo.title}`,
        '웨딩픽 박람회 운영팀',
        startsAt.toISOString().slice(0, 10),
        endsAt.toISOString().slice(0, 10),
        expo.venue,
        expo.region,
        JSON.stringify([expo.benefit]),
        `${expo.venue}에서 열리는 예비부부 대상 박람회예요.`,
        SEED_TAG,
      ]
    );
  }
}

async function remove(pool: ReturnType<typeof createPool>): Promise<void> {
  await withTransaction(pool, async (client) => {
    await client.query(`DELETE FROM structured.wedding_events WHERE title LIKE $1`, [`${TITLE_PREFIX}%`]);
    await client.query(`DELETE FROM structured.consultation_records WHERE common ->> '_seedTag' = $1`, [SEED_TAG]);
    await client.query(`DELETE FROM structured.expenses WHERE label LIKE $1`, [`${TITLE_PREFIX}%`]);
    // category_decisions는 (wedding_id, vendor_id) 복합 FK가 ON DELETE CASCADE라
    // vendor_candidates를 지우면 함께 지워진다(0041).
    await client.query(`DELETE FROM structured.vendor_candidates WHERE note = $1`, [SEED_TAG]);
    await client.query(`DELETE FROM structured.expos WHERE source_note = $1`, [SEED_TAG]);
  });
  console.log('샘플 데이터를 지웠다.');
}

async function main(): Promise<void> {
  if (!argv('yes')) {
    console.error(
      '웨딩노트 · Pick 검수용 샘플을 넣는다. 정말 넣으려면 --yes를 붙일 것.\n' +
        '  npm run seed:wedding-tabs --workspace @weddingpick/api -- --yes\n' +
        '  npm run seed:wedding-tabs --workspace @weddingpick/api -- --remove --yes'
    );
    process.exitCode = 1;
    return;
  }

  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (argv('remove')) {
      await remove(pool);
      return;
    }

    await withTransaction(pool, (client) => seedExpos(client));

    const { rows: weddings } = await pool.query<{ id: string }>('SELECT id FROM structured.weddings');

    if (weddings.length === 0) {
      console.log('structured.weddings가 비어 있다 — 온보딩을 마친 계정이 아직 없다. 박람회만 채우고 끝낸다.');
      return;
    }

    let filled = 0;

    await withTransaction(pool, async (client) => {
      for (const wedding of weddings) {
        const { rows: already } = await client.query(
          `SELECT 1 FROM structured.wedding_events WHERE wedding_id = $1 AND title LIKE $2 LIMIT 1`,
          [wedding.id, `${TITLE_PREFIX}%`]
        );
        if (already.length > 0) continue;

        await seedForWedding(client, wedding.id);
        filled += 1;
      }
    });

    console.log(`웨딩 ${weddings.length}건 중 ${filled}건에 샘플을 채웠다(나머지는 이미 있어 건너뜀).`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
