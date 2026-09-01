import {
  REVIEWABLE_FIELD_LABEL,
  findPiiHints,
  personalInfoLabel,
  reviewSummary,
  withObject,
} from '@weddingpick/domain';
import type { PiiHint, ReviewableField } from '@weddingpick/domain';
import type { PoolClient } from 'pg';

import { loadConfig } from './config';
import { createPool, withTransaction } from './db';
import { requireOperator } from './decisions';

/**
 * 개인정보 재검토 도구.
 *
 * 서비스정책서 4번의 "사람 재검토 1단계". 문서를 읽는 쪽은 개인정보의 값을
 * 옮기지 않고 종류만 적도록 되어 있지만, 그건 지시일 뿐 보장이 아니다. 특히
 * 계약조건은 원문 그대로 옮기라고 되어 있어 새어 들어올 자리가 분명히 있다.
 *
 *   npm run pii --workspace @weddingpick/api -- --list
 *   npm run pii --workspace @weddingpick/api -- --show <quote-id>
 *   npm run pii --workspace @weddingpick/api -- --clean <quote-id> --by <user-id>
 *   npm run pii --workspace @weddingpick/api -- --redact <quote-id> --by <user-id> \
 *     --field contractTerms --kind phone
 *
 * 검토를 받기 전까지 그 문서의 값은 남들이 보는 면(시장 대표가격, 비교표)으로
 * 가지 않는다. 스키마의 comparable_quotes 뷰가 막는다. 본인이 자기 계약서를 자기
 * 화면에서 보는 것은 막지 않는다 — 그건 유출이 아니다.
 */

type Options = {
  list: boolean;
  show?: string;
  clean?: string;
  redact?: string;
  by?: string;
  field?: string;
  kind?: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { list: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--list') options.list = true;
    else if (arg === '--show') options.show = argv[++i];
    else if (arg === '--clean') options.clean = argv[++i];
    else if (arg === '--redact') options.redact = argv[++i];
    else if (arg === '--by') options.by = argv[++i];
    else if (arg === '--field') options.field = argv[++i];
    else if (arg === '--kind') options.kind = argv[++i];
  }

  return options;
}

type PendingRow = {
  id: string;
  created_at: Date;
  vendor_name_raw: string | null;
  product_name: string | null;
  hall_name: string | null;
  planner_name: string | null;
  personal_info_kinds: string[] | null;
  contract_terms: string;
};

/** 뷰의 컬럼을 도메인이 아는 필드 이름으로 옮긴다. */
function reviewableFields(row: PendingRow): Partial<Record<ReviewableField, string>> {
  return {
    vendorNameRaw: row.vendor_name_raw ?? undefined,
    plannerName: row.planner_name ?? undefined,
    productName: row.product_name ?? undefined,
    hallName: row.hall_name ?? undefined,
    contractTerms: row.contract_terms || undefined,
  };
}

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

function describeHints(hints: readonly PiiHint[]): string[] {
  return hints.map(
    (hint) => `    ${REVIEWABLE_FIELD_LABEL[hint.field]}에서 ${personalInfoLabel(hint.kind)} 꼴이 보임`
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (options.list) {
      const { rows } = await pool.query<PendingRow>(
        'SELECT * FROM structured.pending_pii_reviews'
      );

      if (rows.length === 0) {
        console.log('검토할 문서가 없다.');
        return;
      }

      console.log(`검토 대기 ${rows.length}건:`);
      for (const row of rows) {
        const hints = findPiiHints(reviewableFields(row));

        console.log(
          `  ${row.id}  ${when(row.created_at)}  ` +
            reviewSummary({
              detectedKinds: row.personal_info_kinds ?? [],
              hintCount: hints.length,
            })
        );
      }

      console.log('\n하나씩 보려면: npm run pii -- --show <id>');
      return;
    }

    if (options.show) {
      await show(pool, options.show);
      return;
    }

    if (!options.by) {
      console.error('검토한 사람(--by <user-id>)이 필요하다. 결론에는 사람이 남아야 한다.');
      process.exitCode = 1;
      return;
    }

    if (options.clean) {
      await conclude(pool, options.clean, options.by, 'clean');
      console.log('개인정보가 없다고 확인했다. 이제 이 문서의 값이 가격 비교에 쓰일 수 있다.');
      return;
    }

    if (options.redact) {
      if (!options.field || !options.kind) {
        console.error('무엇을 지웠는지(--field, --kind)가 필요하다.');
        process.exitCode = 1;
        return;
      }

      await redact(pool, options.redact, options.by, options.field, options.kind);
      return;
    }

    console.log('--list, --show, --clean, --redact 중 하나가 필요하다.');
  } finally {
    await pool.end();
  }
}

async function show(pool: ReturnType<typeof createPool>, quoteId: string): Promise<void> {
  const { rows } = await pool.query<PendingRow & { pii_review: string }>(
    `SELECT v.*, q.pii_review
     FROM structured.quotes q
     LEFT JOIN structured.pending_pii_reviews v ON v.id = q.id
     WHERE q.id = $1`,
    [quoteId]
  );

  const found = rows[0];

  if (!found) {
    console.error('없는 문서다.');
    process.exitCode = 1;
    return;
  }

  if (found.pii_review !== 'pending') {
    console.log(`이 문서는 이미 검토를 마쳤다 (${found.pii_review}).`);
    return;
  }

  const fields = reviewableFields(found);
  const hints = findPiiHints(fields);

  console.log(`${found.id}  ${when(found.created_at)}`);
  console.log(
    `  ${reviewSummary({ detectedKinds: found.personal_info_kinds ?? [], hintCount: hints.length })}`
  );
  console.log('\n  문서에서 글자를 그대로 옮겨온 곳:');

  for (const field of Object.keys(REVIEWABLE_FIELD_LABEL) as ReviewableField[]) {
    const text = fields[field];

    console.log(`    ${REVIEWABLE_FIELD_LABEL[field]}: ${text ?? '(없음)'}`);
  }

  if (hints.length > 0) {
    console.log('\n  눈에 띄는 곳 (거들 뿐이다 — 여기 없다고 깨끗한 것은 아니다):');
    for (const line of describeHints(hints)) console.log(line);
  }

  console.log(
    '\n  개인정보가 없으면: npm run pii -- --clean <id> --by <user-id>' +
      '\n  지웠으면:        npm run pii -- --redact <id> --by <user-id> --field <필드> --kind <종류>'
  );
}

/** 검토 결론. 사람과 시각이 함께 남는다. */
export async function conclude(
  pool: ReturnType<typeof createPool>,
  quoteId: string,
  by: string,
  status: 'clean' | 'redacted',
  client?: PoolClient
): Promise<void> {
  const run = client ?? pool;

  await requireOperator(run, by);

  const { rowCount } = await run.query(
    `UPDATE structured.quotes
     SET pii_review = $2::pii_review_status, pii_reviewed_at = now(), pii_reviewed_by = $3::uuid
     WHERE id = $1::uuid AND pii_review = 'pending'`,
    [quoteId, status, by]
  );

  if (rowCount === 0) {
    throw new Error('없는 문서이거나 이미 검토를 마쳤다.');
  }
}

/**
 * 지운 것을 기록하고 검토를 마친다.
 *
 * 실제로 값을 고치는 것은 사람이 DB에서 한다 — 어떤 글자를 남기고 어떤 글자를
 * 지울지는 문맥을 봐야 정해지고, 도구가 대신 판단하면 남겨야 할 계약조건까지
 * 날린다. 여기서는 무엇을 지웠는지를 남기고 검토를 닫는다.
 */
export async function redact(
  pool: ReturnType<typeof createPool>,
  quoteId: string,
  by: string,
  field: string,
  kind: string
): Promise<void> {
  await withTransaction(pool, async (client) => {
    // conclude()가 같은 by를 다시 확인한다. 여기서 중복 검사하지 않는다.
    await client.query(
      `INSERT INTO structured.pii_redactions (quote_id, field, kind, redacted_by)
       VALUES ($1::uuid, $2, $3, $4::uuid)`,
      [quoteId, field, kind, by]
    );

    await conclude(pool, quoteId, by, 'redacted', client);
  });

  // '이름를'이 되지 않도록 조사는 앞말을 보고 고른다.
  console.log(
    `${REVIEWABLE_FIELD_LABEL[field as ReviewableField] ?? field}에서 ` +
      `${withObject(personalInfoLabel(kind))} 지웠다고 기록했다. 검토를 마쳤다.`
  );
}

/*
 * CLI로 직접 실행했을 때만 돈다. 테스트가 이 파일에서 함수를 가져오면(require)
 * `require.main`이 테스트 러너를 가리키므로 여기 걸리지 않는다 — 안 걸리면
 * 테스트마다 실제 커넥션 풀을 만들고 빈 인자로 main()이 돌며 exitCode를
 * 조용히 오염시킨다.
 */
if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
