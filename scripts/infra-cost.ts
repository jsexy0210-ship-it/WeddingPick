/**
 * 인프라 요금을 하루 한 번 받아 적는다.
 *
 * 2026-09-10 사용자 결정 — 「A. 하루 한 번 수집」. 지금까지는 Render · Neon ·
 * Object Storage 요금을 각 콘솔에 들어가야 알 수 있었고, 세 곳을 따로 열어보는 동안
 * 「이번 달에 얼마 나가고 있나」에 아무도 답하지 못했다.
 *
 * **받은 금액을 그대로 적는다.** 통화를 환산하지 않고, 없는 값을 0으로 채우지 않는다 —
 * 「0원」과 「모른다」는 다른 말이고, 비용 화면에서 그 둘을 섞으면 안 나가는 돈을 안
 * 나간다고 믿게 된다.
 *
 * **키가 없는 공급자는 건너뛴다.** 하나가 없다고 나머지를 못 받을 이유가 없다. 무엇을
 * 건너뛰었는지는 마지막에 적는다 — 조용히 빠지면 그 공급자 요금이 0인 줄 안다.
 *
 *   확인만:  npx tsx scripts/infra-cost.ts
 *   적는다:  npx tsx scripts/infra-cost.ts --write
 */
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
const WRITE = process.argv.includes('--write');
const TIMEOUT_MS = 20_000;

if (!url) {
  console.error('::error::DATABASE_URL이 없다.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
});

/** 표에 넣을 한 줄. 금액이 없으면 만들지 않는다. */
type CostRow = {
  provider: string;
  resource: string | null;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  metrics: Record<string, unknown> | null;
};

/** 건너뛴 공급자와 그 이유. 비어 있어야 전부 받은 것이다. */
const skipped: string[] = [];

function thisMonth(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
}

async function getJson(target: string, headers: Record<string, string>): Promise<unknown | null> {
  try {
    const response = await fetch(target, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });

    if (!response.ok) {
      /* 주소는 찍되 키는 헤더에만 있어 로그에 남지 않는다. */
      console.warn(`  응답 ${response.status} — ${new URL(target).host}${new URL(target).pathname}`);

      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn(`  못 불렀다 — ${(error as Error).message.split('\n')[0]}`);

    return null;
  }
}

/**
 * Render — 서비스별 요금.
 *
 * 키는 배포 상태를 보는 데 이미 쓰고 있다(`scripts/render-deploy-status.py`). 새로
 * 발급할 것이 없다.
 */
async function render(): Promise<CostRow[]> {
  const key = process.env.RENDER_API_KEY;

  if (!key) {
    skipped.push('Render — RENDER_API_KEY 없음');

    return [];
  }

  const { start, end } = thisMonth();
  const headers = { Authorization: `Bearer ${key}`, accept: 'application/json' };
  const body = await getJson(
    `https://api.render.com/v1/billing/costs?startDate=${start}&endDate=${end}&groupBy=service`,
    headers,
  );

  if (body === null) {
    skipped.push('Render — 요금 조회 실패');

    return [];
  }

  /*
   * 응답 모양이 한 가지가 아니다. 공공데이터에서 겪은 것과 같은 문제라 같은 방식으로
   * 푼다 — 봉투 이름을 추측하지 말고 기대하는 필드를 가진 배열을 찾는다.
   */
  const rows = findRecords(body, 'amount');

  if (rows.length === 0) {
    skipped.push('Render — 응답에서 금액을 찾지 못함');

    return [];
  }

  return rows.map((row) => ({
    provider: 'render',
    resource: str(row.serviceId ?? row.service ?? row.name) ?? null,
    periodStart: start,
    periodEnd: end,
    /* Render는 센트로 준다. 1/100 해서 달러로 적는다. */
    amount: Number(row.amount) / 100,
    currency: 'USD',
    metrics: null,
  }));
}

/**
 * Neon — 프로젝트 사용량.
 *
 * 키가 아직 없다. 발급하면 `NEON_API_KEY`로 넣는다 — 없으면 건너뛰고 그 사실을 적는다.
 */
async function neon(): Promise<CostRow[]> {
  const key = process.env.NEON_API_KEY;

  if (!key) {
    skipped.push('Neon — NEON_API_KEY 없음 (콘솔 → Account settings → API keys)');

    return [];
  }

  const { start, end } = thisMonth();
  const body = await getJson('https://console.neon.tech/api/v2/consumption_history/account?granularity=monthly', {
    Authorization: `Bearer ${key}`,
    accept: 'application/json',
  });

  if (body === null) {
    skipped.push('Neon — 사용량 조회 실패');

    return [];
  }

  /*
   * Neon은 금액이 아니라 **사용량**을 준다(compute 시간 · 저장 용량). 금액으로 바꾸려면
   * 요금제를 알아야 하는데, 요금제가 바뀌면 조용히 틀린 값이 남는다. 그래서 금액은
   * 0으로 두고 사용량만 metrics에 적는다 — 「모른다」를 숫자로 지어내지 않는다.
   */
  const periods = findRecords(body, 'consumption');

  return periods.length === 0
    ? []
    : [
        {
          provider: 'neon',
          resource: null,
          periodStart: start,
          periodEnd: end,
          amount: 0,
          currency: 'USD',
          metrics: { note: '사용량만 받는다 — 금액은 요금제를 알아야 한다', periods },
        },
      ];
}

/** 봉투 어디에 있든 기대하는 필드를 가진 첫 객체 배열을 찾는다. */
function findRecords(payload: unknown, requiredField: string): Record<string, unknown>[] {
  const queue: unknown[] = [payload];

  while (queue.length) {
    const node = queue.shift();

    if (Array.isArray(node)) {
      const rows = node.filter(
        (row): row is Record<string, unknown> => !!row && typeof row === 'object' && requiredField in row,
      );

      if (rows.length) return rows;
      queue.push(...node);
    } else if (node && typeof node === 'object') {
      queue.push(...Object.values(node));
    }
  }

  return [];
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

async function main(): Promise<void> {
  console.log(`인프라 요금 — ${WRITE ? '받아서 적는다' : '받아만 본다'}\n`);

  const rows = [...(await render()), ...(await neon())];

  console.log(`\n받은 줄 ${rows.length}개`);
  for (const row of rows) {
    const where = row.resource ? ` · ${row.resource}` : '';

    console.log(`  ${row.provider}${where}  ${row.amount} ${row.currency}  (${row.periodStart}~${row.periodEnd})`);
  }

  if (skipped.length) {
    console.log('\n건너뛴 것 — 이 공급자의 요금은 0이 아니라 «모름»이다');
    for (const reason of skipped) console.log(`  ${reason}`);
  }

  if (!WRITE) {
    console.log('\n적지 않았다. 실제로 적으려면 --write를 붙인다.');
    await pool.end();

    return;
  }

  for (const row of rows) {
    await pool.query(
      `INSERT INTO structured.infra_costs
         (provider, resource, period_start, period_end, amount, currency, metrics)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (provider, coalesce(resource, ''), period_start, period_end)
       DO UPDATE SET amount = EXCLUDED.amount,
                     metrics = EXCLUDED.metrics,
                     collected_at = now()`,
      [row.provider, row.resource, row.periodStart, row.periodEnd, row.amount, row.currency, row.metrics],
    );
  }

  console.log(`\n적었다: ${rows.length}줄.`);

  await pool.end();
}

main().catch((error: Error) => {
  console.error(`::error::실패: ${error.message.split('\n')[0]}`);
  process.exit(1);
});
