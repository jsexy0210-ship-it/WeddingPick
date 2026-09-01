import { OBJECTION_HOLD_MAX_DAYS } from '@weddingpick/domain';
import type { Pool } from 'pg';

import { loadConfig } from './config';
import { createPool } from './db';
import { holdReview, resolveObjection } from './objection-decide';

/**
 * 후기 이의 처리 도구. 서비스정책서 6번 · 정보통신망법 제44조의2.
 *
 * 업체가 이의를 제기하면 사람이 확인하는 동안 내려두고, 확인이 끝나면 다시 올리거나
 * 내린다. **지금까지 이 일을 할 도구가 없어 DB를 직접 손대야 했고**, 손으로 하면
 * 결정 기록도 작성자 알림도 남지 않는다.
 *
 *   npm run objections --workspace @weddingpick/api -- --list
 *   npm run objections --workspace @weddingpick/api -- --hold <review-id> --by <user-id> \
 *     --note "업체가 사실과 다르다고 이의 제기, 계약서 확인 예정"
 *   npm run objections --workspace @weddingpick/api -- --restore <review-id> --by <user-id> \
 *     --note "계약 사실 확인됨, 후기 내용과 다르지 않음"
 *   npm run objections --workspace @weddingpick/api -- --remove <review-id> --by <user-id> \
 *     --note "..."
 *
 * `--days`로 기간을 줄일 수 있고 늘릴 수는 없다. 상한은 우리가 정한 값이 아니라
 * 법이 정한 값이다.
 *
 * **기간이 지나면 저절로 다시 보인다**(0047). 이 도구가 멈춰 있어도 그렇다 — 사람의
 * 손을 기다리는 임시조치는 기한이 없는 것과 같고, 그건 반론권이 아니라 검열이 된다.
 */

type Options = {
  list: boolean;
  hold?: string;
  restore?: string;
  remove?: string;
  by?: string;
  note?: string;
  days?: number;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { list: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--list') options.list = true;
    else if (arg === '--hold') options.hold = argv[++i];
    else if (arg === '--restore') options.restore = argv[++i];
    else if (arg === '--remove') options.remove = argv[++i];
    else if (arg === '--by') options.by = argv[++i];
    else if (arg === '--note') options.note = argv[++i];
    else if (arg === '--days') options.days = Number(argv[++i]);
  }

  return options;
}

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

async function list(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{
    id: string;
    vendor_name: string;
    title: string;
    objection_hold_until: Date;
    expired: boolean;
  }>(
    `SELECT r.id, v.name AS vendor_name, r.title, r.objection_hold_until,
            r.objection_hold_until <= now() AS expired
     FROM structured.reviews r
     JOIN structured.vendors v ON v.id = r.vendor_id
     WHERE r.status = 'under_objection'
     ORDER BY r.objection_hold_until`
  );

  if (rows.length === 0) {
    console.log('확인 중인 이의가 없다.');
    return;
  }

  console.log(`확인 중 ${rows.length}건:`);
  for (const row of rows) {
    /*
     * 기간이 지난 것은 이미 다시 보인다. 그래도 목록에 세우는 이유는 **결론이
     * 나지 않은 채 기간만 지난 건**이기 때문이다 — 그건 처리한 것이 아니다.
     */
    const mark = row.expired ? '기간 지남 · 이미 다시 보임' : `~${when(row.objection_hold_until)}`;
    console.log(`  ${row.id}  ${row.vendor_name}  ${row.title}  (${mark})`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (options.list) {
      await list(pool);
      return;
    }

    const target = options.hold ?? options.restore ?? options.remove;

    if (!target) {
      console.error('무엇을 할지 정해라: --list | --hold | --restore | --remove');
      process.exitCode = 1;
      return;
    }

    if (!options.by) {
      console.error('결정한 사람(--by <user-id>)이 필요하다. 결론에는 사람이 남아야 한다.');
      process.exitCode = 1;
      return;
    }

    if (!options.note) {
      console.error(
        '왜 그렇게 결정했는지(--note)가 필요하다. 내려둘 때는 무엇을 확인할 것인지, ' +
          '결론을 낼 때는 무엇을 확인했는지 적는다.'
      );
      process.exitCode = 1;
      return;
    }

    if (options.hold) {
      await holdReview(pool, {
        reviewId: options.hold,
        by: options.by,
        note: options.note,
        days: options.days,
      });
      console.log(
        `내려뒀다. 최대 ${options.days ?? OBJECTION_HOLD_MAX_DAYS}일이고, 그 뒤에는 저절로 다시 보인다.`
      );
      return;
    }

    const to = options.restore ? 'restore' : 'remove';

    await resolveObjection(pool, {
      reviewId: target,
      to,
      by: options.by,
      note: options.note,
    });

    console.log(to === 'restore' ? '다시 올렸다.' : '내렸다. 작성자에게 알림이 갔다.');
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
