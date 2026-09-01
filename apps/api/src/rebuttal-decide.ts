import { REBUTTAL_STATUS_LABEL, type RebuttalStatus } from '@weddingpick/domain';
import type { Pool } from 'pg';

import { newEventId, recordDecision } from './decisions';
import { withTransaction } from './db';
import { notify } from './notify';

/**
 * 반론 하나에 결론을 낸다. 최종통합정책 v2.0 원문 26·27번.
 *
 * 심사 도구(`rebuttal-admin`)에서 떼어 둔 이유는 하나다 — **알림이 누구에게 가는지는
 * 규칙이지 도구의 사정이 아니다.** 도구 안에 두면 테스트가 닿지 못하고, 닿지 못하는
 * 규칙은 다음 사람이 조용히 바꾼다.
 */
export async function decideRebuttal(
  pool: Pool,
  input: {
    id: string;
    to: Exclude<RebuttalStatus, 'pending'>;
    by: string;
    note: string;
  }
): Promise<void> {
  const { id, to, by, note } = input;

  await withTransaction(pool, async (client) => {
    const { rows } = await client.query<{
      status: RebuttalStatus;
      submitted_by_user_id: string;
      review_id: string;
      review_author_user_id: string;
    }>(
      `SELECT b.status, b.submitted_by_user_id, b.review_id,
              r.author_user_id AS review_author_user_id
       FROM structured.review_rebuttals b
       JOIN structured.reviews r ON r.id = b.review_id
       WHERE b.id = $1 FOR UPDATE OF b`,
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

    /*
     * 후기를 쓴 사람에게도 알린다.
     *
     * 내 후기 아래에 업체의 반론이 실렸는데 나만 모르는 상태를 만들지 않는다.
     * 반론은 후기를 지우지 않고 나란히 붙는 것이므로(19번), 붙었다는 사실은
     * 작성자가 알아야 대응할지 말지를 고를 수 있다.
     *
     * **심사 메모(note)를 그대로 보내지 않는다.** 그 글은 심사자가 소속을 무엇으로
     * 확인했는지 적은 내부 기록이고, 작성자에게 갈 말이 아니다. 게시하지 않기로
     * 한 경우에는 아무것도 보내지 않는다 — 작성자에게는 일어나지 않은 일이다.
     */
    if (to === 'published' && found.review_author_user_id !== found.submitted_by_user_id) {
      await notify(client, {
        userId: found.review_author_user_id,
        kind: 'rebuttal',
        title: '내 후기에 업체 반론이 실렸어요',
        body: '후기 화면에서 반론을 함께 볼 수 있어요. 후기는 그대로 남아 있어요.',
        targetId: found.review_id,
      });
    }
  });
}
