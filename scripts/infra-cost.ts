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
import { createHmac } from 'node:crypto';
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
 * Render — 요금.
 *
 * **공개 API에 요금 경로가 없다.** `/v1/billing/costs`로 불렀더니 404가 왔다
 * (2026-09-10 확인 모드). Render API 문서가 내놓는 것은 서비스 · 배포 · 감사 기록이고
 * 요금이나 사용량 경로는 없다.
 *
 * 그래서 부르지 않는다. 없는 주소를 매일 두드리면 로그가 「받는 중인데 실패한다」로
 * 읽히고, 열쇠가 만료돼서 못 받는 진짜 실패와 구분이 안 된다. 경로가 생기면 여기서
 * 부른다 — 키(`RENDER_API_KEY`)는 배포 상태를 보는 데 이미 쓰고 있어 새로 발급할 것이 없다.
 */
async function render(): Promise<CostRow[]> {
  skipped.push('Render — 공개 API에 요금 조회 경로가 없다 (대시보드 → Billing에서 본다)');

  return [];
}

/**
 * Neon — 사용량.
 *
 * **계정 단위 경로는 없다.** `consumption_history/account`로 불렀더니 404가 왔다
 * (2026-09-10 확인 모드). 문서에 있는 것은 프로젝트 단위 v2 경로 하나뿐이고,
 * 프로젝트는 조직 아래에 달리므로 조직을 먼저 묻는다.
 *
 * `from` · `to` · `granularity` · `metrics`가 모두 필수다. 하나라도 빠지면 404가 온다 —
 * 처음 실패한 이유가 그것이었다.
 *
 * **달 경계에 맞춰 묻는다.** granularity가 monthly인데 범위가 달 경계에서 어긋나면
 * 406이 온다. 그래서 이번 달 1일부터 다음 달 1일까지로 자른다.
 *
 * 이 경로는 Launch 이상에서만 열린다. Free면 권한 오류가 오고, 그때는 사용량을
 * 지어내지 않고 건너뛴 이유로 적는다.
 */
const NEON_METRICS = [
  'compute_unit_seconds',
  'root_branch_bytes_month',
  'child_branch_bytes_month',
  'instant_restore_bytes_month',
  'public_network_transfer_bytes',
  'private_network_transfer_bytes',
].join(',');

async function neon(): Promise<CostRow[]> {
  const key = process.env.NEON_API_KEY;

  if (!key) {
    skipped.push('Neon — NEON_API_KEY 없음 (콘솔 → Account settings → API keys)');

    return [];
  }

  const headers = { Authorization: `Bearer ${key}`, accept: 'application/json' };
  const orgs = await getJson('https://console.neon.tech/api/v2/users/me/organizations', headers);
  const orgId = orgs === null ? undefined : str(findRecords(orgs, 'id')[0]?.id);

  if (!orgId) {
    skipped.push('Neon — 조직을 찾지 못했다 (키 권한을 확인한다)');

    return [];
  }

  const { start, end } = thisMonth();
  const monthStart = `${start}T00:00:00Z`;
  const nextMonth = new Date(`${start}T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const monthEnd = nextMonth.toISOString().slice(0, 19) + 'Z';

  const body = await getJson(
    'https://console.neon.tech/api/v2/consumption_history/v2/projects' +
      `?from=${monthStart}&to=${monthEnd}&granularity=monthly&org_id=${orgId}&metrics=${NEON_METRICS}`,
    headers,
  );

  if (body === null) {
    skipped.push('Neon — 사용량 조회 실패 (Launch 이상에서만 열리는 경로다)');

    return [];
  }

  /*
   * Neon은 금액이 아니라 **사용량**을 준다(compute 시간 · 저장 용량). 금액으로 바꾸려면
   * 요금제를 알아야 하는데, 요금제가 바뀌면 조용히 틀린 값이 남는다. 그래서 금액은
   * 0으로 두고 사용량만 metrics에 적는다 — 「모른다」를 숫자로 지어내지 않는다.
   */
  const periods = findRecords(body, 'periods');

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
          metrics: { note: '사용량만 받는다 — 금액은 요금제를 알아야 한다', projects: periods },
        },
      ];
}

/**
 * 네이버 클라우드 — 이번 달 요금.
 *
 * **키는 이미 있다.** Object Storage에 쓰는 것과 **같은 한 쌍**이다(마이페이지 →
 * 인증키 관리). NCP는 계정 전체가 인증키 하나를 쓰므로 비용 조회용으로 따로 발급할
 * 것이 없다.
 *
 * 다만 **서명 방식이 다르다.** Object Storage는 S3 호환이라 AWS SDK가 알아서 서명하는데,
 * 비용 API는 NCP 자체 방식(`x-ncp-apigw-signature-v2`)이라 직접 만들어야 한다. 같은
 * 키로 다른 서명을 하는 것이라, S3가 된다고 이쪽도 된다는 뜻은 아니다.
 *
 * 서브 계정이면 「비용 조회」 권한이 따로 있어야 한다 — 없으면 403이 오고, 그때는
 * 금액을 지어내지 않고 건너뛴 이유로 적는다.
 */
async function ncp(): Promise<CostRow[]> {
  const accessKey = process.env.NCP_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.NCP_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKey || !secretKey) {
    skipped.push('네이버 클라우드 — 인증키 없음 (마이페이지 → 인증키 관리)');

    return [];
  }

  const now = new Date();
  const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const path =
    `/billing/v1/cost/getDemandCostList?startMonth=${month}&endMonth=${month}&responseFormatType=json`;
  const timestamp = String(Date.now());

  /*
   * 서명 문자열은 «메서드 공백 경로 개행 타임스탬프 개행 액세스키»다. 순서와 공백이
   * 하나라도 어긋나면 401이 온다 — 값을 조립하는 자리를 한 곳에 두는 이유다.
   */
  const message = `GET ${path}\n${timestamp}\n${accessKey}`;
  const signature = createHmac('sha256', secretKey).update(message).digest('base64');

  const body = await getJson(`https://billingapi.apigw.ntruss.com${path}`, {
    'x-ncp-apigw-timestamp': timestamp,
    'x-ncp-iam-access-key': accessKey,
    'x-ncp-apigw-signature-v2': signature,
    accept: 'application/json',
  });

  if (body === null) {
    skipped.push('네이버 클라우드 — 요금 조회 실패 (서브 계정이면 「비용 조회」 권한을 확인한다)');

    return [];
  }

  const rows = findRecords(body, 'useAmount');

  if (rows.length === 0) {
    skipped.push('네이버 클라우드 — 응답에서 금액을 찾지 못함');

    return [];
  }

  const { start, end } = thisMonth();

  return rows.map((row) => ({
    provider: 'ncp',
    resource: str(row.productName ?? row.contractNo) ?? null,
    periodStart: start,
    periodEnd: end,
    amount: Number(row.useAmount ?? 0),
    /* 네이버 클라우드는 원으로 청구한다. 달러로 바꾸지 않는다 — 환산은 보는 쪽에서 한다. */
    currency: 'KRW',
    metrics: null,
  }));
}

/**
 * GitHub — Actions 실행 시간과 저장소 사용량.
 *
 * **기본 토큰으로는 못 읽는다.** 워크플로가 받는 `GITHUB_TOKEN`에는 청구 정보 권한이
 * 없다. 개인 접근 토큰을 `GH_BILLING_TOKEN`으로 따로 넣어야 한다.
 *
 * **세분화 토큰(`github_pat_`)으로는 안 된다.** 청구 경로는 세분화 토큰을 받지 않아
 * 권한을 다 줘도 403이 온다(2026-09-10 확인 모드에서 세 경로 모두 403). 고전
 * 토큰(`ghp_`)에 `user` 범위를 줘야 열린다.
 *
 * 계정 종류에 따라 주는 것이 다르다. 새 청구 체계를 쓰는 계정은 `/settings/billing/usage`가
 * **금액**을 주고, 아닌 계정은 `/settings/billing/actions`가 **분과 용량**만 준다.
 * 금액이 오면 금액으로 적고, 아니면 사용량만 metrics에 적는다 — 분을 돈으로 환산하지
 * 않는다. 요금제마다 포함 분이 다르고, 그 계산을 여기 박아두면 요금제가 바뀔 때
 * 조용히 틀린 값이 남는다.
 */
async function github(): Promise<CostRow[]> {
  const token = process.env.GH_BILLING_TOKEN;
  const account = process.env.GITHUB_REPOSITORY_OWNER ?? process.env.GH_BILLING_ACCOUNT;

  if (!token) {
    skipped.push('GitHub — GH_BILLING_TOKEN 없음 (기본 GITHUB_TOKEN에는 청구 권한이 없다)');

    return [];
  }
  if (!account) {
    skipped.push('GitHub — 계정 이름을 알 수 없다 (GH_BILLING_ACCOUNT)');

    return [];
  }

  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  };
  const { start, end } = thisMonth();

  /* 새 청구 체계 — 금액이 온다. */
  const usage = await getJson(`https://api.github.com/users/${account}/settings/billing/usage`, headers);
  const items = usage === null ? [] : findRecords(usage, 'netAmount');

  if (items.length > 0) {
    return items.map((item) => ({
      provider: 'github',
      resource: str(item.product ?? item.sku) ?? null,
      periodStart: start,
      periodEnd: end,
      amount: Number(item.netAmount ?? 0),
      currency: 'USD',
      metrics: { quantity: item.quantity ?? null, unitType: item.unitType ?? null },
    }));
  }

  /* 옛 체계 — 분과 용량만 온다. 금액을 지어내지 않는다. */
  const actions = await getJson(`https://api.github.com/users/${account}/settings/billing/actions`, headers);
  const storage = await getJson(`https://api.github.com/users/${account}/settings/billing/shared-storage`, headers);

  if (actions === null && storage === null) {
    skipped.push('GitHub — 요금 조회 실패 (고전 토큰 ghp_ + user 범위여야 한다. 세분화 토큰은 403)');

    return [];
  }

  return [
    {
      provider: 'github',
      resource: null,
      periodStart: start,
      periodEnd: end,
      amount: 0,
      currency: 'USD',
      metrics: {
        note: '사용량만 받는다 — 분을 돈으로 환산하지 않는다. 요금제마다 포함 분이 다르다',
        actions,
        storage,
      },
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

  const rows = [...(await render()), ...(await neon()), ...(await ncp()), ...(await github())];

  console.log(`\n받은 줄 ${rows.length}개`);
  for (const row of rows) {
    const where = row.resource ? ` · ${row.resource}` : '';

    console.log(`  ${row.provider}${where}  ${row.amount} ${row.currency}  (${row.periodStart}~${row.periodEnd})`);
  }

  if (skipped.length) {
    /*
     * **로그 줄로만 남기지 않는다.** 매일 도는 작업이라 아무도 로그를 열지 않고,
     * 열쇠가 만료되면 그 공급자 요금이 조용히 빠진 채 초록으로 끝난다 — 화면에는
     * 0으로 보이고 실제로는 「모름」이다. Actions 요약에 경고로 띄워 눈에 걸리게 한다.
     */
    console.log('\n건너뛴 것 — 이 공급자의 요금은 0이 아니라 «모름»이다');
    for (const reason of skipped) console.log(`  ${reason}`);
    console.log(`::warning::인프라 요금 ${skipped.length}곳을 못 받았다 — ${skipped.join(' / ')}`);
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
