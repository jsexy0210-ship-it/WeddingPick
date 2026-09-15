import type { Pool } from 'pg';

import type { Storage } from '../storage/port';

/**
 * 기한이 지난 상담 녹음 원본을 지운다.
 *
 * ## 왜 따로 도는가
 *
 * 문서 파기(`sweepExpiredDocuments`)는 **사람이 보는 과정**이 붙어 있다 — 인증
 * 심사가 끝나야 기한이 정해지고, 그래서 운영자가 먼저 볼 수 있게 `manual` 모드가
 * 있다.
 *
 * **상담 녹음에는 볼 과정이 없다.** 읽어내면 끝이고, 처리방침 제2항이 「읽어내기가
 * 끝나는 즉시 삭제하며, 끝나지 않은 경우에도 업로드 시점부터 24시간을 넘겨
 * 보관하지 않습니다」라고 적었다. 그 약속에는 조건이 없다.
 *
 * 그래서 **`manual` 모드에서도 돈다.** 모드를 따르면 운영자가 스위치를 만지는
 * 동안 약속한 기한이 지나고, 그 사실은 아무 화면에도 뜨지 않는다.
 *
 * ## 열쇠가 남은 줄이 곧 지울 것이다
 *
 * 깃발을 따로 두지 않는다 — 깃발과 실제가 어긋나면 「지웠다고 적혀 있으나 안 지운」
 * 줄이 생기고, 파기 작업은 그것을 건너뛴다.
 */

export type ConsultationSweepResult = { deleted: number; failed: number };

type Row = { id: string; audio_key: string };

export async function sweepExpiredConsultationAudio(
  deps: { pool: Pool; storage: Storage },
  limit = 50
): Promise<ConsultationSweepResult> {
  const { rows } = await deps.pool.query<Row>(
    `SELECT id, audio_key
       FROM structured.consultation_records
      WHERE audio_key IS NOT NULL
        AND audio_delete_by IS NOT NULL
        AND audio_delete_by <= now()
      ORDER BY audio_delete_by
      LIMIT $1`,
    [limit]
  );

  let deleted = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      /*
       * **파일부터 지운다.** 여기서 실패하면 표를 건드리지 않아 다음 차례에 다시
       * 시도한다. 순서를 뒤집으면 「지웠다고 적혔는데 파일은 남은」 줄이 생기고,
       * 그 줄은 다음 차례에 조회되지 않아 영원히 남는다.
       */
      await deps.storage.delete(row.audio_key);

      await deps.pool.query(
        `UPDATE structured.consultation_records
            SET audio_key = NULL, audio_deleted_at = now()
          WHERE id = $1`,
        [row.id]
      );

      deleted += 1;
    } catch {
      failed += 1;
    }
  }

  return { deleted, failed };
}

/**
 * 기한이 지났는데 아직 안 지운 것이 몇인가.
 *
 * **0이 정상이다.** 0이 아니면 파기가 밀리고 있다는 뜻이고, 그것은 처리방침을
 * 어기는 중이라는 뜻이다 — 운영 화면이 이 숫자를 본다.
 */
export async function countOverdueConsultationAudio(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT count(*) AS count
       FROM structured.consultation_records
      WHERE audio_key IS NOT NULL
        AND audio_delete_by IS NOT NULL
        AND audio_delete_by <= now()`
  );

  return Number(rows[0]?.count ?? 0);
}
