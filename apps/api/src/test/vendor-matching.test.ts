import { backfillVendorMatches, matchVendor } from '../analysis/vendor-matching';
import { loadQuote } from '../quote-view';
import { runOnce } from '../analysis/worker';
import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

async function createVendor(name: string, region = '서울 강남구', source = 'vendor_official') {
  const { rows } = await test.pool.query<{ id: string }>(
    `INSERT INTO structured.vendors (category, name, region, source)
     VALUES ('hall', $1, $2, $3) RETURNING id`,
    [name, region, source]
  );

  return rows[0]!.id;
}

async function createWedding() {
  const user = await test.pool.query<{ id: string }>(
    'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
  );
  const wedding = await test.pool.query<{ id: string }>(
    'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
    [user.rows[0]!.id]
  );

  return wedding.rows[0]!.id;
}

async function match(name: string | null) {
  const client = await test.pool.connect();

  try {
    return await matchVendor(client, name);
  } finally {
    client.release();
  }
}

describeWithDb('업체 매칭', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('표기가 달라도 같은 업체로 본다', async () => {
    const vendorId = await createVendor('더채플앳청담');

    expect(await match('더 채플 앳 청담')).toBe(vendorId);
    expect(await match('더채플앳청담 ')).toBe(vendorId);
    expect(await match('더-채플·앳(청담)')).toBe(vendorId);
  });

  it('별칭으로도 찾는다', async () => {
    const vendorId = await createVendor('그랜드 컨벤션');
    await test.pool.query(
      'INSERT INTO structured.vendor_aliases (vendor_id, alias) VALUES ($1, $2)',
      [vendorId, '그랜드홀']
    );

    expect(await match('그랜드홀')).toBe(vendorId);
  });

  it('모르는 이름은 연결하지 않는다', async () => {
    await createVendor('더채플앳청담');

    // 비슷하다고 넘겨짚으면 남의 업체 가격이 내 비교에 섞인다.
    expect(await match('더채플앳삼성')).toBeNull();
    expect(await match(null)).toBeNull();
    expect(await match('   ')).toBeNull();
  });

  it('같은 이름이 여러 지역에 있으면 연결하지 않는다', async () => {
    await createVendor('아펠가모', '서울 강남구');
    await createVendor('아펠가모', '서울 광진구');

    // 어느 쪽인지 알 수 없다. 틀린 연결보다 연결하지 않는 편이 낫다.
    expect(await match('아펠가모')).toBeNull();
  });

  it('업체를 나중에 등록하면 이전 문서들이 연결된다', async () => {
    const weddingId = await createWedding();

    await test.pool.query(
      `INSERT INTO structured.quotes (wedding_id, doc_type, vendor_name_raw, source)
       VALUES ($1, 'contract', '더 채플 앳 청담', 'ai_extraction')`,
      [weddingId]
    );

    const vendorId = await createVendor('더채플앳청담');

    const client = await test.pool.connect();
    try {
      expect(await backfillVendorMatches(client, vendorId)).toBe(1);
    } finally {
      client.release();
    }

    const { rows } = await test.pool.query<{ vendor_id: string }>(
      'SELECT vendor_id FROM structured.quotes'
    );
    expect(rows[0]!.vendor_id).toBe(vendorId);
  });

  it('공공데이터에서 온 업체는 출처를 밝힌다', async () => {
    // 공공누리는 유형과 무관하게 출처 표시를 요구한다.
    const weddingId = await createWedding();
    const vendorId = await createVendor('아펠가모 공덕', '서울 마포구', 'public_data');

    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.quotes (wedding_id, doc_type, vendor_id, source)
       VALUES ($1, 'contract', $2, 'ai_extraction') RETURNING id`,
      [weddingId, vendorId]
    );

    const quote = await loadQuote(test.pool, rows[0]!.id);

    expect(quote.vendor?.sourceNote).toBe(
      '행정안전부 지방행정 인허가 데이터 (2026-09-01 확인)'
    );
  });

  it('사용자 문서에서만 온 업체에는 바깥 출처를 붙이지 않는다', async () => {
    const weddingId = await createWedding();
    const vendorId = await createVendor('더채플앳청담');

    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.quotes (wedding_id, doc_type, vendor_id, source)
       VALUES ($1, 'contract', $2, 'ai_extraction') RETURNING id`,
      [weddingId, vendorId]
    );

    const quote = await loadQuote(test.pool, rows[0]!.id);

    expect(quote.vendor?.sourceNote).toBeNull();
  });

  it('연결되지 않은 이름은 빈도와 함께 남는다', async () => {
    const weddingId = await createWedding();

    for (const name of ['라움', '라 움', '노블발렌티']) {
      await test.pool.query(
        `INSERT INTO structured.quotes (wedding_id, doc_type, vendor_name_raw, source)
         VALUES ($1, 'contract', $2, 'ai_extraction')`,
        [weddingId, name]
      );
    }

    const { rows } = await test.pool.query<{ sample_name: string; quote_count: string }>(
      'SELECT sample_name, quote_count FROM structured.unmatched_vendor_names'
    );

    // 등록 우선순위를 보여준다 — 자주 나오는 업체부터.
    expect(rows[0]).toMatchObject({ quote_count: '2' });
    expect(rows).toHaveLength(2);
  });
});
