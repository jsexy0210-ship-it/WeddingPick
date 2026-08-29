import {
  REWARD_LABEL,
  REWARD_STATUS_LABEL,
  type RewardKind,
  type RewardStatus,
} from '@weddingpick/domain';

import { loadConfig } from './config';
import { newEventId, recordDecision } from './decisions';
import { createPool, withTransaction } from './db';
import { notify } from './notify';

/**
 * 보상 지급 도구. 최종통합정책 v2.0 I장.
 *
 * **돈을 보내는 것은 이 도구가 아니다.** 사람이 NPay로 보내고, 보냈다는 사실을
 * 여기에 적는다. 판정은 이미 자동으로 끝나 있다(I-3의 조건확인~한도확인) —
 * 남은 것은 실제 송금뿐이고, 그것을 자동으로 할 수단이 아직 없다.
 *
 *   npm run rewards --workspace @weddingpick/api -- --list
 *   npm run rewards --workspace @weddingpick/api -- --held
 *   npm run rewards --workspace @weddingpick/api -- --paid <id> --by <user-id> \
 *     --note "NPay 송금 완료"
 *   npm run rewards --workspace @weddingpick/api -- --block <id> --by <user-id> \
 *     --note "중복 계정으로 확인됨"
 *
 * `--list`는 지급하면 되는 것만 보여준다. 한도를 넘었거나 어뷰징이 의심되는 건은
 * `--held`로 따로 본다 — 섞어두면 매번 걸러내야 하고, 그러다 한 건이 새어 나간다.
 */

type Options = {
  list: boolean;
  held: boolean;
  paid?: string;
  block?: string;
  by?: string;
  note?: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { list: false, held: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--list') options.list = true;
    else if (arg === '--held') options.held = true;
    else if (arg === '--paid') options.paid = argv[++i];
    else if (arg === '--block') options.block = argv[++i];
    else if (arg === '--by') options.by = argv[++i];
    else if (arg === '--note') options.note = argv[++i];
  }

  return options;
}

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');
const won = (amount: number): string => `${amount.toLocaleString('ko-KR')}원`;

async function decide(
  pool: ReturnType<typeof createPool>,
  id: string,
  to: Extract<RewardStatus, 'paid' | 'blocked'>,
  by: string,
  note: string
): Promise<void> {
  await withTransaction(pool, async (client) => {
    const { rows } = await client.query<{
      status: RewardStatus;
      user_id: string;
      kind: RewardKind;
      amount_krw: number;
    }>(
      `SELECT status, user_id, kind, amount_krw
       FROM structured.reward_grants WHERE id = $1 FOR UPDATE`,
      [id]
    );

    const found = rows[0];

    if (!found) throw new Error('없는 보상이다.');

    if (found.status === 'paid' || found.status === 'blocked') {
      throw new Error(`이미 ${REWARD_STATUS_LABEL[found.status]} 상태다.`);
    }

    if (found.user_id === by) {
      // 반론·인증 심사와 같은 규칙이다. 자기 보상을 자기가 지급할 수는 없다.
      throw new Error('받는 본인은 지급할 수 없다.');
    }

    await client.query(
      `UPDATE structured.reward_grants
       SET status = $2::reward_status, decided_at = now(), decided_by = $3::uuid,
           decision_note = $4, updated_at = now()
       WHERE id = $1::uuid`,
      [id, to, by, note]
    );

    /*
     * held로 올라와 사람을 기다리던 줄이 있으면 닫는다. 안 그러면 정말 손이
     * 필요한 것과 끝난 것이 `open_decisions`에서 섞인다.
     */
    await client.query(
      `UPDATE structured.decisions
       SET execution_status = 'succeeded', updated_at = now()
       WHERE subject_kind = 'reward_grant' AND subject_id = $1::uuid
         AND execution_status = 'pending'`,
      [id]
    );

    await recordDecision(client, {
      eventId: newEventId(),
      workflow: 'reward',
      step: 'pay',
      subjectKind: 'reward_grant',
      subjectId: id,
      decider: { kind: 'human', userId: by },
      decision: to,
      reasonCode: to === 'paid' ? 'paid_out' : 'not_paid',
      // 가리키기만 한다. 금액도 계정도 이 로그에 복사되지 않는다.
      evidence: [{ kind: 'reward_grant', id }],
    });

    await notify(client, {
      userId: found.user_id,
      kind: 'notice',
      title:
        to === 'paid'
          ? `${REWARD_LABEL[found.kind]} ${won(found.amount_krw)}을 보내드렸어요`
          : `${REWARD_LABEL[found.kind]} 보상을 지급하지 않기로 했어요`,
      body: note,
      targetId: id,
    });
  });

  console.log(
    to === 'paid'
      ? '지급으로 적었다. 받는 사람에게 알림이 갔다.'
      : '지급하지 않기로 적었다. 사유는 받는 사람에게 보인다.'
  );
}

async function list(
  pool: ReturnType<typeof createPool>,
  status: Extract<RewardStatus, 'earned' | 'held'>
): Promise<void> {
  const { rows } = await pool.query<{
    id: string;
    kind: RewardKind;
    amount_krw: number;
    reason_code: string;
    created_at: Date;
    url: string | null;
  }>(
    `SELECT g.id, g.kind, g.amount_krw, g.reason_code, g.created_at, p.url
     FROM structured.reward_grants g
     LEFT JOIN structured.promotion_submissions p ON p.id = g.promotion_id
     WHERE g.status = $1::reward_status
     ORDER BY g.created_at`,
    [status]
  );

  if (rows.length === 0) {
    console.log(status === 'earned' ? '지급할 보상이 없다.' : '확인할 보상이 없다.');
    return;
  }

  const total = rows.reduce((sum, row) => sum + row.amount_krw, 0);

  console.log(
    status === 'earned'
      ? `지급 대기 ${rows.length}건 · 합계 ${won(total)}:`
      : `확인 대기 ${rows.length}건 · 합계 ${won(total)}:`
  );

  for (const row of rows) {
    console.log(
      `  ${row.id}  ${REWARD_LABEL[row.kind]}  ${won(row.amount_krw)}  ` +
        `${row.reason_code}  ${when(row.created_at)}`
    );
    // 홍보인증은 사람이 글을 열어봐야 한다. 주소를 함께 적는다.
    if (row.url) console.log(`    글: ${row.url}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (options.list) {
      await list(pool, 'earned');
      return;
    }

    if (options.held) {
      await list(pool, 'held');
      return;
    }

    if (!options.by) {
      console.error('적는 사람(--by <user-id>)이 필요하다. 돈이 오간 기록에는 사람이 남아야 한다.');
      process.exitCode = 1;
      return;
    }

    if (!options.note) {
      console.error(
        '무엇을 했는지(--note)가 필요하다. 지급했으면 어떻게 보냈는지, ' +
          '지급하지 않았으면 그 사유를 적는다. 받는 사람이 이걸 읽는다.'
      );
      process.exitCode = 1;
      return;
    }

    if (options.paid) {
      await decide(pool, options.paid, 'paid', options.by, options.note);
      return;
    }

    if (options.block) {
      await decide(pool, options.block, 'blocked', options.by, options.note);
      return;
    }

    console.error('무엇을 할지 정해라: --list | --held | --paid | --block');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
