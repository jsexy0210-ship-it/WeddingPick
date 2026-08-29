import { REBUTTAL_STATUS_LABEL, type RebuttalStatus } from '@weddingpick/domain';

import { loadConfig } from './config';
import { newEventId, recordDecision } from './decisions';
import { createPool, withTransaction } from './db';
import { notify } from './notify';

/**
 * 업체 반론 심사 도구.
 *
 * **자동 게시는 없다.** 반론이 사람 없이 후기 옆에 붙으면, 업체라고 말하기만 하면
 * 누구나 남의 후기 아래에 글을 실을 수 있다. 사람이 이 명령으로 두 가지를 본다 —
 * 낸 사람이 정말 그 업체인지, 그리고 그 글이 반론인지.
 *
 *   npm run rebuttals --workspace @weddingpick/api -- --list
 *   npm run rebuttals --workspace @weddingpick/api -- --show <id>
 *   npm run rebuttals --workspace @weddingpick/api -- --publish <id> --by <user-id> \
 *     --note "사업자등록증으로 소속 확인"
 *   npm run rebuttals --workspace @weddingpick/api -- --reject <id> --by <user-id> \
 *     --note "..."
 *
 * `--by`는 결정한 사람의 사용자 id다. 스키마가 결론에 사람을 요구한다.
 *
 * 소속은 관계자 인증(v2.0 26번)이 확인한다. `--show`가 그 결과를 함께 보여주므로,
 * 인증을 마친 사람의 반론인지 아니면 아직 아무도 확인하지 않은 이름인지 심사하는
 * 사람이 먼저 안다. 인증이 없어도 실을 수는 있다 — 대신 `--note`에 무엇으로
 * 확인했는지 적는다. **적지 않으면 나중에 왜 실었는지 아무도 답할 수 없다.**
 */

type Options = {
  list: boolean;
  show?: string;
  publish?: string;
  reject?: string;
  by?: string;
  note?: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { list: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--list') options.list = true;
    else if (arg === '--show') options.show = argv[++i];
    else if (arg === '--publish') options.publish = argv[++i];
    else if (arg === '--reject') options.reject = argv[++i];
    else if (arg === '--by') options.by = argv[++i];
    else if (arg === '--note') options.note = argv[++i];
  }

  return options;
}

const when = (at: Date): string => at.toISOString().slice(0, 16).replace('T', ' ');

async function decide(
  pool: ReturnType<typeof createPool>,
  id: string,
  to: Exclude<RebuttalStatus, 'pending'>,
  by: string,
  note: string
): Promise<void> {
  await withTransaction(pool, async (client) => {
    const { rows } = await client.query<{
      status: RebuttalStatus;
      submitted_by_user_id: string;
      review_id: string;
    }>(
      `SELECT status, submitted_by_user_id, review_id
       FROM structured.review_rebuttals WHERE id = $1 FOR UPDATE`,
      [id]
    );

    const found = rows[0];

    if (!found) throw new Error('없는 반론이다.');

    if (found.status !== 'pending') {
      throw new Error(`이미 ${REBUTTAL_STATUS_LABEL[found.status]} 상태다.`);
    }

    if (found.submitted_by_user_id === by) {
      // 인증 심사와 같은 규칙이다. 자기 글을 자기가 실을 수는 없다.
      throw new Error('반론을 낸 본인은 심사할 수 없다.');
    }

    await client.query(
      `UPDATE structured.review_rebuttals
       SET status = $2::rebuttal_status, decided_at = now(), decided_by = $3::uuid,
           decision_note = $4, updated_at = now()
       WHERE id = $1::uuid`,
      [id, to, by, note]
    );

    /*
     * 같은 트랜잭션에서 남긴다. L장이 요구하는 것은 "왜 그렇게 정했는가"를
     * 나중에 답할 수 있게 하는 것이고, 결정만 되고 기록이 빠지면 답할 수 없다.
     *
     * 근거는 가리키기만 한다 — 소속을 무엇으로 확인했는지는 note에 사람이 적고,
     * 그 증빙 자체는 여기 복사되지 않는다(원문 27번).
     */
    await recordDecision(client, {
      eventId: newEventId(),
      workflow: 'rebuttal_review',
      step: 'decide',
      subjectKind: 'rebuttal',
      subjectId: id,
      decider: { kind: 'human', userId: by },
      decision: to,
      reasonCode: to === 'published' ? 'affiliation_verified' : 'not_published',
      evidence: [{ kind: 'review', id: found.review_id }],
    });

    await notify(client, {
      userId: found.submitted_by_user_id,
      kind: 'rebuttal',
      title:
        to === 'published' ? '반론이 게시됐어요' : '반론을 게시하지 않기로 했어요',
      body: note,
      targetId: found.review_id,
    });
  });

  console.log(
    to === 'published'
      ? '게시했다. 이제 후기 아래에 함께 보인다.'
      : '게시하지 않기로 했다. 사유는 낸 사람에게 보인다.'
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (options.list) {
      const { rows } = await pool.query<{
        id: string;
        claimed_role: string;
        vendor_name: string;
        created_at: Date;
      }>(
        `SELECT b.id, b.claimed_role, v.name AS vendor_name, b.created_at
         FROM structured.review_rebuttals b
         JOIN structured.reviews r ON r.id = b.review_id
         JOIN structured.vendors v ON v.id = r.vendor_id
         WHERE b.status = 'pending'
         ORDER BY b.created_at`
      );

      if (rows.length === 0) {
        console.log('확인할 반론이 없다.');
        return;
      }

      console.log(`확인 대기 ${rows.length}건:`);
      for (const row of rows) {
        console.log(`  ${row.id}  ${row.vendor_name}  ${row.claimed_role}  ${when(row.created_at)}`);
      }
      return;
    }

    if (options.show) {
      const { rows } = await pool.query<{
        id: string;
        status: RebuttalStatus;
        claimed_role: string;
        body: string;
        decision_note: string | null;
        created_at: Date;
        vendor_name: string;
        review_title: string;
        review_body: string;
        review_overall: number;
        verified_role: string | null;
      }>(
        `SELECT b.id, b.status, b.claimed_role, b.body, b.decision_note, b.created_at,
                v.name AS vendor_name, r.title AS review_title, r.body AS review_body,
                r.overall AS review_overall,
                (SELECT c.claimed_role
                 FROM structured.approved_vendor_claims c
                 WHERE c.vendor_id = r.vendor_id
                   AND c.claimant_user_id = b.submitted_by_user_id
                 ORDER BY c.decided_at DESC
                 LIMIT 1) AS verified_role
         FROM structured.review_rebuttals b
         JOIN structured.reviews r ON r.id = b.review_id
         JOIN structured.vendors v ON v.id = r.vendor_id
         WHERE b.id = $1`,
        [options.show]
      );

      const found = rows[0];

      if (!found) {
        console.error('없는 반론이다.');
        process.exitCode = 1;
        return;
      }

      console.log(`${found.id}  ${REBUTTAL_STATUS_LABEL[found.status]}  ${when(found.created_at)}`);
      console.log(`  업체: ${found.vendor_name}`);
      console.log(`  본인이 밝힌 소속: ${found.claimed_role}`);
      /*
       * 관계자 인증을 마쳤는지. v2.0 25번이 반론의 첫 단계로 관계자 인증을
       * 두었으므로, 심사하는 사람이 먼저 볼 것은 이 줄이다.
       */
      console.log(
        found.verified_role === null
          ? '  관계자 인증: 없다  ← 이걸 확인하는 것이 심사다'
          : `  관계자 인증: 확인됨 (${found.verified_role})`
      );
      console.log(`  원본 후기(${found.review_overall}점): ${found.review_title}`);
      console.log(`    ${found.review_body}`);
      console.log(`  반론: ${found.body}`);
      if (found.decision_note) console.log(`  결정 사유: ${found.decision_note}`);
      return;
    }

    if (!options.by) {
      console.error('결정한 사람(--by <user-id>)이 필요하다. 결론에는 사람이 남아야 한다.');
      process.exitCode = 1;
      return;
    }

    if (!options.note) {
      console.error(
        '왜 그렇게 결정했는지(--note)가 필요하다. 게시할 때는 소속을 무엇으로 확인했는지, ' +
          '게시하지 않을 때는 그 사유를 적는다. 낸 사람이 이걸 읽는다.'
      );
      process.exitCode = 1;
      return;
    }

    if (options.publish) {
      await decide(pool, options.publish, 'published', options.by, options.note);
      return;
    }

    if (options.reject) {
      await decide(pool, options.reject, 'rejected', options.by, options.note);
      return;
    }

    console.error('무엇을 할지 정해라: --list | --show | --publish | --reject');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
