import { createPool } from './db';
import { loadConfig } from './config';
import { requireOperator } from './decisions';

/**
 * 가맹점 이름이 여러 업체에 걸린 결제인증을 잇는다. 05번 명세 20번.
 *
 * `matchVendor`(routes/payment-proofs.ts)는 **여러 곳이 걸리면 고르지 않는다.**
 * 가맹점 이름은 짧고 겹치기 쉬워서, 아무거나 고르면 남의 업체 분포에 내 결제가
 * 들어간다. `vendor_id`가 NULL인 채로 남고, `usable_payment_proofs`가 그 조건을
 * 보므로 잇지 않으면 **영원히 어느 업체의 결제 구간에도 반영되지 않는다.**
 *
 * **심사가 아니라 잇기다.** 14번의 인증 심사와 다르다 — 등급을 올리지 않고,
 * 시장 대표가격에도 들어가지 않는다(20번). 무엇이 맞는 연결인지 사람이 정할
 * 뿐이고, 그 정함으로 이 결제인증 하나만 움직인다.
 *
 * **잇는다고 별칭으로 남기지 않는다.** 같은 가맹점명이 지역마다 다른 업체를
 * 가리킬 수 있다 — 이번 건이 A업체였다고 다음 건도 A업체라는 뜻은 아니다.
 * 매번 다시 본다.
 *
 *   npm run payment-proofs --workspace @weddingpick/api -- --list
 *   npm run payment-proofs --workspace @weddingpick/api -- --show <id>
 *   npm run payment-proofs --workspace @weddingpick/api -- --link <id> --vendor <vendor-id> --by <user-id>
 */

type Options = {
  list: boolean;
  show?: string;
  link?: string;
  vendor?: string;
  by?: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { list: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--list') options.list = true;
    else if (arg === '--show') options.show = argv[++i];
    else if (arg === '--link') options.link = argv[++i];
    else if (arg === '--vendor') options.vendor = argv[++i];
    else if (arg === '--by') options.by = argv[++i];
  }

  return options;
}

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');
const won = (amount: string): string => `${Number(amount).toLocaleString('ko-KR')}원`;

async function list(pool: ReturnType<typeof createPool>): Promise<void> {
  const { rows } = await pool.query<{
    id: string;
    merchant_name: string;
    paid_amount: string;
    paid_at: Date;
    candidates: number;
  }>(
    `SELECT
       p.id, p.merchant_name, p.paid_amount, p.paid_at,
       (SELECT count(*) FROM structured.vendors v
         WHERE v.normalized_name = structured.normalize_vendor_name(p.merchant_name)) AS candidates
     FROM structured.payment_proofs p
     WHERE p.vendor_id IS NULL
     ORDER BY p.created_at DESC`
  );

  if (rows.length === 0) {
    console.log('이어붙일 결제인증이 없다.');
    return;
  }

  console.log(`업체 없이 남은 결제인증 ${rows.length}건:`);
  for (const row of rows) {
    /*
     * 후보가 0곳이면 업체 자체가 없는 것이고, 이 도구가 아니라 업체 등록이
     * 먼저다. 후보가 둘 이상이면 그중 하나를 고르는 것이 이 도구가 할 일이다.
     */
    const situation = row.candidates === 0 ? '등록된 업체 없음' : `후보 ${row.candidates}곳`;
    console.log(
      `  ${row.id}  ${row.merchant_name}  ${won(row.paid_amount)}  ${when(row.paid_at)}  (${situation})`
    );
  }
}

async function show(pool: ReturnType<typeof createPool>, id: string): Promise<void> {
  const proof = await pool.query<{
    merchant_name: string;
    paid_amount: string;
    paid_at: Date;
    method: string;
    vendor_id: string | null;
  }>(
    `SELECT merchant_name, paid_amount, paid_at, method, vendor_id
     FROM structured.payment_proofs WHERE id = $1`,
    [id]
  );

  const found = proof.rows[0];

  if (!found) {
    console.log('없는 결제인증이다.');
    return;
  }

  console.log(`가맹점명: ${found.merchant_name}`);
  console.log(`금액: ${won(found.paid_amount)}  일시: ${when(found.paid_at)}  수단: ${found.method}`);
  console.log(`연결된 업체: ${found.vendor_id ?? '없음'}`);

  const candidates = await pool.query<{ id: string; name: string; category: string; region: string }>(
    `SELECT v.id, v.name, v.category::text, v.region
     FROM structured.vendors v
     WHERE v.normalized_name = structured.normalize_vendor_name($1)
        OR EXISTS (
             SELECT 1 FROM structured.vendor_aliases a
             WHERE a.vendor_id = v.id
               AND a.normalized_alias = structured.normalize_vendor_name($1)
           )
     ORDER BY v.name`,
    [found.merchant_name]
  );

  if (candidates.rows.length === 0) {
    console.log('이름이 겹치는 업체가 없다. 업체가 아직 등록되지 않았을 수 있다.');
    return;
  }

  console.log(`후보:`);
  for (const c of candidates.rows) {
    console.log(`  ${c.id}  ${c.name}  ${c.category}  ${c.region}`);
  }
}

export async function link(
  pool: ReturnType<typeof createPool>,
  proofId: string,
  vendorId: string,
  by: string
): Promise<void> {
  await requireOperator(pool, by);

  const vendor = await pool.query('SELECT 1 FROM structured.vendors WHERE id = $1', [vendorId]);

  if (vendor.rowCount === 0) {
    throw new Error('없는 업체다.');
  }

  const { rowCount } = await pool.query(
    `UPDATE structured.payment_proofs SET vendor_id = $2 WHERE id = $1 AND vendor_id IS NULL`,
    [proofId, vendorId]
  );

  if (rowCount === 0) {
    throw new Error('없는 결제인증이거나 이미 다른 업체와 연결돼 있다.');
  }

  console.log('이었다. 이제 이 업체의 결제 구간에 반영된다.');
}

export async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (options.list) {
      await list(pool);
      return;
    }

    if (options.show) {
      await show(pool, options.show);
      return;
    }

    if (options.link) {
      if (!options.vendor) {
        console.error('연결할 업체(--vendor <vendor-id>)가 필요하다.');
        process.exitCode = 1;
        return;
      }

      if (!options.by) {
        console.error('이은 사람(--by <user-id>)이 필요하다.');
        process.exitCode = 1;
        return;
      }

      await link(pool, options.link, options.vendor, options.by);
      return;
    }

    console.error('무엇을 할지 정해라: --list | --show | --link');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

/*
 * CLI로 직접 실행했을 때만 돈다. 테스트가 이 파일에서 함수를 가져오면(require)
 * `require.main`이 테스트 러너를 가리키므로 여기 걸리지 않는다.
 */
if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
