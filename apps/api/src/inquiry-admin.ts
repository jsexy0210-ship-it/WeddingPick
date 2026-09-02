import {
  INQUIRY_CATEGORY_RULES,
  INQUIRY_STATUS_LABEL,
  PLANNER_LISTING_REQUEST_SOURCE,
} from '@weddingpick/domain';
import type { InquiryCategory, InquiryStatus } from '@weddingpick/domain';
import type { PoolClient } from 'pg';

import { loadConfig } from './config';
import { createPool, withTransaction } from './db';
import { requireOperator } from './decisions';
import { notify } from './notify';

/**
 * 문의 처리 도구.
 *
 * 접수만 받아두고 처리할 방법이 없으면 창구가 아니라 우편함이다. 사람이 이 명령으로
 * 읽고 결론을 낸다 — 서비스정책서 6번의 "증빙 재검토"는 자동으로 일어나지 않는다.
 *
 *   npm run inquiries --workspace @weddingpick/api -- --list
 *   npm run inquiries --workspace @weddingpick/api -- --show <id>
 *   npm run inquiries --workspace @weddingpick/api -- --review <id> --by <user-id>
 *   npm run inquiries --workspace @weddingpick/api -- --answer <id> --by <user-id> \
 *     --resolution "..." [--withdraw-planner | --list-planner]
 *
 * `--by`는 처리한 사람의 사용자 id다. 스키마가 결론에 사람을 요구한다.
 */

type Options = {
  list: boolean;
  show?: string;
  review?: string;
  answer?: string;
  by?: string;
  resolution?: string;
  withdrawPlanner: boolean;
  listPlanner: boolean;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { list: false, withdrawPlanner: false, listPlanner: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--list') options.list = true;
    else if (arg === '--withdraw-planner') options.withdrawPlanner = true;
    else if (arg === '--list-planner') options.listPlanner = true;
    else if (arg === '--show') options.show = argv[++i];
    else if (arg === '--review') options.review = argv[++i];
    else if (arg === '--answer') options.answer = argv[++i];
    else if (arg === '--by') options.by = argv[++i];
    else if (arg === '--resolution') options.resolution = argv[++i];
  }

  return options;
}

function describe(row: {
  id: string;
  category: InquiryCategory;
  status: InquiryStatus;
  received_at: Date;
  subject_kind: string | null;
  subject_id: string | null;
}): string {
  const subject = row.subject_kind ? ` · ${row.subject_kind}:${row.subject_id}` : '';

  return `${row.id}  ${INQUIRY_STATUS_LABEL[row.status]}  ${
    INQUIRY_CATEGORY_RULES[row.category].label
  }${subject}  ${row.received_at.toISOString().slice(0, 16).replace('T', ' ')}`;
}

/**
 * 노출 중단 요청을 실제로 반영한다.
 *
 * 스키마가 되돌리기를 막으므로(0008) 이건 되돌릴 수 없는 조작이다. 그래서 결론을 낼 때만,
 * 명시적으로 `--withdraw-planner`를 붙였을 때만 한다.
 */
async function withdrawPlanner(client: PoolClient, plannerId: string): Promise<void> {
  const { rowCount } = await client.query(
    `UPDATE structured.planners
     SET listing_status = 'withdrawn', withdrawn_at = now(), listing_source = NULL, listed_at = NULL
     WHERE id = $1 AND listing_status <> 'withdrawn'`,
    [plannerId]
  );

  console.log(
    rowCount === 0 ? '  (이미 내려가 있거나 없는 플래너다)' : '  플래너를 검색에서 내렸다.'
  );
}

/**
 * 등록 요청을 받아들여 검색에 올린다.
 *
 * 노출 중단의 반대편이지만 대칭이 아니다. 내리는 것은 요청만으로 되고 되돌릴 수
 * 없다. 올리는 것은 근거를 사람이 확인해야 하고, 언제든 다시 내릴 수 있다.
 * 개인 이름을 싣는 일이라 그 방향으로 기울여 둔다.
 *
 * 한 번 내려간(withdrawn) 플래너는 다시 올라가지 않는다 — 0008의 트리거가 막는다.
 * 여기서 굳이 확인하지 않는 것은, 확인을 두 곳에 두면 한 곳이 늦게 바뀌기 때문이다.
 */
async function listPlanner(client: PoolClient, plannerId: string): Promise<void> {
  const { rowCount } = await client.query(
    `UPDATE structured.planners
     SET listing_status = 'public', listing_source = $2::source_type, listed_at = now()
     WHERE id = $1 AND listing_status = 'private'`,
    [plannerId, PLANNER_LISTING_REQUEST_SOURCE]
  );

  console.log(
    rowCount === 0
      ? '  (이미 공개되어 있거나, 내려달라고 한 적이 있거나, 없는 플래너다)'
      : '  플래너를 검색에 올렸다. 왜 나오는지가 검색 결과에 함께 표시된다.'
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (options.list) {
      const { rows } = await pool.query(
        `SELECT id, category, status, received_at, subject_kind, subject_id
         FROM structured.inquiries
         WHERE status IN ('received', 'in_review')
         ORDER BY received_at`
      );

      if (rows.length === 0) {
        console.log('처리할 문의가 없다.');
        return;
      }

      console.log(`처리 대기 ${rows.length}건:`);
      for (const row of rows) console.log(`  ${describe(row)}`);
      return;
    }

    if (options.show) {
      const { rows } = await pool.query(
        `SELECT id, category, status, body, contact, received_at, subject_kind, subject_id,
                decided_at, resolution
         FROM structured.inquiries WHERE id = $1`,
        [options.show]
      );

      const found = rows[0];

      if (!found) {
        console.error('없는 문의다.');
        process.exitCode = 1;
        return;
      }

      console.log(describe(found));
      console.log(`  회신처: ${found.contact ?? '(앱으로 답한다)'}`);
      console.log(`  내용: ${found.body}`);
      if (found.resolution) console.log(`  처리: ${found.resolution}`);

      const events = await pool.query(
        `SELECT from_status, to_status, note, created_at
         FROM structured.inquiry_events WHERE inquiry_id = $1 ORDER BY created_at`,
        [options.show]
      );

      // 서비스정책서 6-5: 처리 이력은 내부 로그로 보관한다.
      console.log('  이력:');
      for (const event of events.rows) {
        console.log(
          `    ${event.created_at.toISOString().slice(0, 16).replace('T', ' ')} ` +
            `${event.from_status ?? '접수'} → ${event.to_status}${event.note ? ` (${event.note})` : ''}`
        );
      }

      return;
    }

    if (!options.by) {
      console.error('처리한 사람(--by <user-id>)이 필요하다. 결론에는 사람이 남아야 한다.');
      process.exitCode = 1;
      return;
    }

    if (options.review) {
      await moveStatus(pool, options.review, 'in_review', options.by, null, false, null);
      return;
    }

    if (options.answer) {
      if (!options.resolution) {
        console.error('어떻게 처리했는지(--resolution)가 필요하다. 보낸 사람이 이걸 읽는다.');
        process.exitCode = 1;
        return;
      }

      await moveStatus(
        pool,
        options.answer,
        'answered',
        options.by,
        options.resolution,
        options.withdrawPlanner,
        null,
        options.listPlanner
      );
      return;
    }

    console.log('--list, --show, --review, --answer 중 하나가 필요하다.');
  } finally {
    await pool.end();
  }
}

export async function moveStatus(
  pool: ReturnType<typeof createPool>,
  inquiryId: string,
  to: InquiryStatus,
  by: string,
  resolution: string | null,
  alsoWithdrawPlanner: boolean,
  note: string | null,
  alsoListPlanner = false
): Promise<void> {
  await withTransaction(pool, async (client) => {
    await requireOperator(client, by);

    const { rows } = await client.query<{
      status: InquiryStatus;
      category: InquiryCategory;
      subject_kind: string | null;
      subject_id: string | null;
      requester_user_id: string | null;
    }>(
      `SELECT status, category, subject_kind, subject_id, requester_user_id
       FROM structured.inquiries WHERE id = $1 FOR UPDATE`,
      [inquiryId]
    );

    const found = rows[0];

    if (!found) {
      throw new Error('없는 문의다.');
    }

    await client.query(
      // $2를 두 자리에서 쓰므로 타입을 못 박는다. 안 그러면 추론이 갈린다.
      `UPDATE structured.inquiries
       SET status = $2::inquiry_status,
           decided_at = CASE WHEN $2::inquiry_status IN ('answered', 'closed')
                             THEN now() ELSE decided_at END,
           decided_by = CASE WHEN $2::inquiry_status IN ('answered', 'closed')
                             THEN $3::uuid ELSE decided_by END,
           resolution = coalesce($4::text, resolution)
       WHERE id = $1::uuid`,
      [inquiryId, to, by, resolution]
    );

    await client.query(
      `INSERT INTO structured.inquiry_events (inquiry_id, from_status, to_status, actor_user_id, note)
       VALUES ($1::uuid, $2::inquiry_status, $3::inquiry_status, $4::uuid, $5::text)`,
      [inquiryId, found.status, to, by, note]
    );

    /*
     * 답을 냈으면 보낸 사람에게 알린다.
     *
     * 로그인하지 않고 보낸 문의(requester_user_id가 비어 있는 것)는 앱으로 알릴
     * 곳이 없다 — 그 사람에게는 적어준 회신처로 사람이 답한다. 여기서 조용히
     * 넘어가는 것은 그래서다.
     */
    if (to === 'answered' && found.requester_user_id) {
      await notify(client, {
        userId: found.requester_user_id,
        kind: 'inquiry',
        title: '문의에 답변이 등록됐어요',
        body: resolution ?? '문의하신 내용에 대한 처리 결과를 확인해주세요',
        targetId: inquiryId,
      });
    }

    console.log(`${inquiryId}: ${INQUIRY_STATUS_LABEL[found.status]} → ${INQUIRY_STATUS_LABEL[to]}`);

    if (alsoWithdrawPlanner && alsoListPlanner) {
      throw new Error('내리면서 동시에 올릴 수는 없다.');
    }

    if (alsoWithdrawPlanner) {
      if (found.subject_kind !== 'planner' || !found.subject_id) {
        throw new Error('플래너를 가리키지 않는 문의다. 내릴 대상이 없다.');
      }

      await withdrawPlanner(client, found.subject_id);
    }

    if (alsoListPlanner) {
      if (found.subject_kind !== 'planner' || !found.subject_id) {
        throw new Error('플래너를 가리키지 않는 문의다. 올릴 대상이 없다.');
      }

      if (found.category !== 'planner_listing') {
        // 다른 문의를 처리하다가 실수로 개인 이름을 검색에 올리는 일이 없게 한다.
        throw new Error('등록 요청이 아닌 문의로는 플래너를 올릴 수 없다.');
      }

      await listPlanner(client, found.subject_id);
    }
  });
}

/*
 * CLI로 직접 실행했을 때만 돈다. 테스트가 이 파일에서 함수를 가져오면(require)
 * `require.main`이 테스트 러너를 가리키므로 여기 걸리지 않는다 — 안 걸리면
 * 테스트마다 실제 커넥션 풀을 만들고 빈 인자로 main()이 돌며 exitCode를
 * 조용히 오염시킨다.
 */
if (require.main === module) {
  void main().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
