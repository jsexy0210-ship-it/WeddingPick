import { canRegisterPaymentProof, type PaymentProofField } from '@weddingpick/domain';

import { createPool, withTransaction } from './db';
import { loadConfig } from './config';
import { newEventId, recordDecision, requireOperator } from './decisions';

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
 * **검수 대기와는 다른 목록이다.** 이 목록은 읽기가 끝났는데 업체만 못 고른 것이고,
 * 검수 대기(`--pending`)는 사진에서 금액·날짜를 읽지 못한 것이다. 둘을 한 목록에
 * 세우면 "업체를 고르면 되는 것"과 "값이 아예 없는 것"이 섞여, 고를 수 없는 줄을
 * 붙들고 있게 된다.
 *
 *   npm run payment-proofs --workspace @weddingpick/api -- --list
 *   npm run payment-proofs --workspace @weddingpick/api -- --show <id>
 *   npm run payment-proofs --workspace @weddingpick/api -- --link <id> --vendor <vendor-id> --by <user-id>
 */

type Options = {
  list: boolean;
  pending: boolean;
  show?: string;
  link?: string;
  vendor?: string;
  resolve?: string;
  merchant?: string;
  amount?: string;
  paidAt?: string;
  reason?: string;
  by?: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { list: false, pending: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--list') options.list = true;
    else if (arg === '--pending') options.pending = true;
    else if (arg === '--show') options.show = argv[++i];
    else if (arg === '--link') options.link = argv[++i];
    else if (arg === '--vendor') options.vendor = argv[++i];
    else if (arg === '--resolve') options.resolve = argv[++i];
    else if (arg === '--merchant') options.merchant = argv[++i];
    else if (arg === '--amount') options.amount = argv[++i];
    else if (arg === '--paid-at') options.paidAt = argv[++i];
    else if (arg === '--reason') options.reason = argv[++i];
    else if (arg === '--by') options.by = argv[++i];
  }

  return options;
}

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');
const won = (amount: string): string => `${Number(amount).toLocaleString('ko-KR')}원`;

export type UnmatchedProof = {
  id: string;
  merchantName: string;
  paidAmount: string;
  paidAt: Date;
  candidates: number;
};

/** 업체 없이 남은 결제인증 전부. 조회라 `requireOperator`를 부르지 않는다. */
export async function list(pool: ReturnType<typeof createPool>): Promise<UnmatchedProof[]> {
  const { rows } = await pool.query<{
    id: string;
    merchant_name: string;
    paid_amount: string;
    paid_at: Date;
    candidates: string;
  }>(
    `SELECT
       p.id, p.merchant_name, p.paid_amount, p.paid_at,
       (SELECT count(*) FROM structured.vendors v
         WHERE v.normalized_name = structured.normalize_vendor_name(p.merchant_name)) AS candidates
     FROM structured.payment_proofs p
     WHERE p.vendor_id IS NULL
       AND p.review_state = 'accepted'
     ORDER BY p.created_at DESC`
  );

  return rows.map((row) => ({
    id: row.id,
    merchantName: row.merchant_name,
    paidAmount: row.paid_amount,
    paidAt: row.paid_at,
    // pg는 count(*)를 문자열로 돌려준다 — number로 선언해두면
    // `candidates === 0` 비교가 "0" === 0이 되어 항상 거짓이 된다.
    candidates: Number(row.candidates),
  }));
}

export type ProofDetail = {
  /** 검수를 기다리는 줄은 못 읽은 칸이 비어 있다. 지어내지 않는다. */
  merchantName: string | null;
  paidAmount: string | null;
  paidAt: Date | null;
  method: string;
  vendorId: string | null;
  reviewState: string;
  candidates: { id: string; name: string; category: string; region: string }[];
};

export async function show(pool: ReturnType<typeof createPool>, id: string): Promise<ProofDetail | null> {
  const proof = await pool.query<{
    merchant_name: string | null;
    paid_amount: string | null;
    paid_at: Date | null;
    method: string;
    vendor_id: string | null;
    review_state: string;
  }>(
    `SELECT merchant_name, paid_amount, paid_at, method, vendor_id, review_state
     FROM structured.payment_proofs WHERE id = $1`,
    [id]
  );

  const found = proof.rows[0];

  if (!found) return null;

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
    // 이름을 못 읽었으면 견줄 것이 없다. 빈 문자열은 어느 업체와도 맞지 않는다.
    [found.merchant_name ?? '']
  );

  return {
    merchantName: found.merchant_name,
    paidAmount: found.paid_amount,
    paidAt: found.paid_at,
    method: found.method,
    vendorId: found.vendor_id,
    reviewState: found.review_state,
    candidates: candidates.rows,
  };
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

/**
 * 검수를 기다리는 결제인증. 0150의 `pending_review`.
 *
 * 사진에서 금액·날짜·가맹점명을 읽지 못했거나 확신이 낮아 보류된 줄이다. **접수는
 * 성립했다** — 사용자는 올렸고, 우리가 아직 못 읽었을 뿐이다. 그 사이 이 줄은 어떤
 * 통계·Unlock·지출에도 들어가지 않는다.
 *
 * 원본은 24시간 뒤에 지워진다(스펙 8.3). 그 시간 안에 보지 못한 것은 사용자에게
 * 다시 올려달라고 하는 수밖에 없다 — 카드번호가 찍힌 이미지를 검수 편의 때문에
 * 더 들고 있지 않는다.
 */
export type PendingProof = {
  id: string;
  merchantName: string | null;
  paidAmount: string | null;
  paidAt: Date | null;
  pendingFields: PaymentProofField[];
  reviewNote: string | null;
  createdAt: Date;
  /** 원본이 아직 남아 있는가. 없으면 사람이 볼 것이 없다. */
  hasOriginal: boolean;
};

export async function pending(pool: ReturnType<typeof createPool>): Promise<PendingProof[]> {
  const { rows } = await pool.query<{
    id: string;
    merchant_name: string | null;
    paid_amount: string | null;
    paid_at: Date | null;
    pending_fields: PaymentProofField[];
    review_note: string | null;
    created_at: Date;
    has_original: boolean;
  }>(
    `SELECT p.id, p.merchant_name, p.paid_amount, p.paid_at,
            p.pending_fields, p.review_note, p.created_at,
            EXISTS (
              SELECT 1 FROM originals.raw_documents d
              WHERE d.id = p.raw_document_id AND d.deleted_at IS NULL
            ) AS has_original
     FROM structured.payment_proofs p
     WHERE p.review_state = 'pending_review'
     ORDER BY p.created_at`
  );

  return rows.map((row) => ({
    id: row.id,
    merchantName: row.merchant_name,
    paidAmount: row.paid_amount,
    paidAt: row.paid_at,
    pendingFields: row.pending_fields,
    reviewNote: row.review_note,
    createdAt: row.created_at,
    hasOriginal: row.has_original,
  }));
}

export type ResolveInput = {
  merchantName: string;
  paidAmount: number;
  /** ISO 8601 */
  paidAt: string;
  /** 왜 이 값으로 정했는가. 세는 코드다 — 사람이 읽는 문장이 아니다. */
  reasonCode: string;
};

/**
 * 보류를 풀어 쓸 수 있게 만든다.
 *
 * **되돌릴 수 없는 조작이라 사유를 받고 기록을 남긴다.** 이 한 번으로 그 금액이
 * 업체의 금액 구간과 그 사람의 지출에 들어간다 — 되돌리려면 지우는 수밖에 없고,
 * 지운 뒤에는 무엇이 왜 들어갔었는지 아무도 모른다.
 *
 * 값은 **사람이 원본을 보고 적는다.** 서버가 다시 읽어 채우지 않는다 — 한 번 못 읽은
 * 것을 같은 방법으로 다시 읽으면 같은 답이 나오고, 다르게 나오면 그건 더 나쁘다.
 */
export async function resolve(
  pool: ReturnType<typeof createPool>,
  proofId: string,
  input: ResolveInput,
  by: string
): Promise<void> {
  await requireOperator(pool, by);

  const check = canRegisterPaymentProof({
    merchantName: input.merchantName,
    paidAmount: input.paidAmount,
    paidAt: input.paidAt,
  });

  if (!check.ok) {
    throw new Error(check.reason);
  }

  await withTransaction(pool, async (client) => {
    const { rowCount } = await client.query(
      `UPDATE structured.payment_proofs
          SET merchant_name = $2,
              paid_amount = $3,
              paid_at = $4,
              review_state = 'accepted',
              pending_fields = '{}',
              review_note = NULL,
              reviewed_at = now(),
              reviewed_by = $5
        WHERE id = $1 AND review_state = 'pending_review'`,
      [proofId, input.merchantName.trim(), input.paidAmount, input.paidAt, by]
    );

    if (rowCount === 0) {
      throw new Error('없는 결제인증이거나 이미 검수가 끝났다.');
    }

    /*
     * 기록은 같은 트랜잭션에 둔다. 따로 남기면 값은 들어갔는데 누가 왜 넣었는지가
     * 빠진 줄이 생기고, 그건 기록이 없는 것보다 나쁘다.
     *
     * **값을 적지 않는다.** 근거는 가리키기만 한다(0033의 evidence_refs 제약) —
     * 가맹점명도 금액도 이 로그에 복사되지 않는다.
     */
    await recordDecision(client, {
      eventId: newEventId(),
      workflow: 'payment_proof_review',
      step: 'resolve',
      subjectKind: 'payment_proof',
      subjectId: proofId,
      decider: { kind: 'human', userId: by },
      decision: 'accepted',
      reasonCode: input.reasonCode,
      evidence: [{ kind: 'payment_proof', id: proofId }],
    });
  });

  console.log('검수를 마쳤다. 이제 이 업체의 금액 구간과 그 사람의 지출에 들어간다.');
}

export async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (options.list) {
      const rows = await list(pool);

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
          `  ${row.id}  ${row.merchantName}  ${won(row.paidAmount)}  ${when(row.paidAt)}  (${situation})`
        );
      }
      return;
    }

    if (options.pending) {
      const rows = await pending(pool);

      if (rows.length === 0) {
        console.log('검수를 기다리는 결제인증이 없다.');
        return;
      }

      console.log(`검수를 기다리는 결제인증 ${rows.length}건:`);
      for (const row of rows) {
        const fields = row.pendingFields.length > 0 ? row.pendingFields.join(',') : '-';
        const original = row.hasOriginal ? '원본 있음' : '원본 지워짐';
        console.log(
          `  ${row.id}  접수 ${when(row.createdAt)}  못 읽은 칸: ${fields}  (${original})`
        );
        if (row.reviewNote) console.log(`      ${row.reviewNote}`);
      }
      return;
    }

    if (options.resolve) {
      const missing = (
        [
          ['--merchant <가맹점명>', options.merchant],
          ['--amount <원>', options.amount],
          ['--paid-at <ISO 8601>', options.paidAt],
          ['--reason <사유 코드>', options.reason],
          ['--by <user-id>', options.by],
        ] as const
      ).filter(([, value]) => !value);

      if (missing.length > 0) {
        console.error(`검수에는 ${missing.map(([flag]) => flag).join(' · ')}가 필요하다.`);
        process.exitCode = 1;
        return;
      }

      await resolve(
        pool,
        options.resolve,
        {
          merchantName: options.merchant!,
          paidAmount: Number(options.amount),
          paidAt: options.paidAt!,
          reasonCode: options.reason!,
        },
        options.by!
      );
      return;
    }

    if (options.show) {
      const found = await show(pool, options.show);

      if (!found) {
        console.log('없는 결제인증이다.');
        return;
      }

      console.log(`가맹점명: ${found.merchantName ?? '못 읽음'}`);
      console.log(
        `금액: ${found.paidAmount === null ? '못 읽음' : won(found.paidAmount)}` +
          `  일시: ${found.paidAt === null ? '못 읽음' : when(found.paidAt)}` +
          `  수단: ${found.method}`
      );
      console.log(`연결된 업체: ${found.vendorId ?? '없음'}  접수 상태: ${found.reviewState}`);

      if (found.candidates.length === 0) {
        console.log('이름이 겹치는 업체가 없다. 업체가 아직 등록되지 않았을 수 있다.');
        return;
      }

      console.log(`후보:`);
      for (const c of found.candidates) {
        console.log(`  ${c.id}  ${c.name}  ${c.category}  ${c.region}`);
      }
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
