import type { Pool } from 'pg';

/**
 * 종료 박람회 자동 삭제. `docs/expo-agent-spec.md` 15절.
 *
 * **당일은 지우지 않는다.** `현재 날짜 > end_date`일 때만 종료로 본다 — 종료일
 * 당일은 ONGOING으로 두고, 삭제는 종료일 **다음 날**부터다. `ends_at < CURRENT_DATE`가
 * 그 조건이다(둘 다 `date`라 시간 성분이 없다).
 *
 * 본문(혜택 · 소개 · 출처)은 지우고 최소 로그만 남긴다 — 로그의 목적은 재수집 방지와
 * 운영 이력 확인뿐이라 그 이상을 담지 않는다(사양 "최소 삭제 로그").
 */

export type ExpoDue = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  venue: string;
};

type ExpoRow = { id: string; title: string; starts_at: Date; ends_at: Date; venue: string };

function toRow(r: ExpoRow): ExpoDue {
  return {
    id: r.id,
    title: r.title,
    startsAt: r.starts_at.toISOString().slice(0, 10),
    endsAt: r.ends_at.toISOString().slice(0, 10),
    venue: r.venue,
  };
}

/** 지금 스윕을 돌리면 지워질 박람회. `--dry-run`과 관리자 화면이 이 함수를 같이 쓴다. */
export async function listExposDueForDeletion(pool: Pool): Promise<ExpoDue[]> {
  const { rows } = await pool.query<ExpoRow>(
    `SELECT id, title, starts_at, ends_at, venue
     FROM structured.expos
     WHERE ends_at < CURRENT_DATE
     ORDER BY ends_at ASC`
  );
  return rows.map(toRow);
}

/**
 * 내일 지워질 박람회 — 오늘이 종료일인 것들(오늘은 ONGOING으로 남아 있지만,
 * 내일 `ends_at < CURRENT_DATE`가 참이 되어 스윕에 걸린다). 관리자 화면의
 * 「내일 지워질 박람회」 미리보기가 이 함수를 쓴다.
 */
export async function listExposEndingToday(pool: Pool): Promise<ExpoDue[]> {
  const { rows } = await pool.query<ExpoRow>(
    `SELECT id, title, starts_at, ends_at, venue
     FROM structured.expos
     WHERE ends_at = CURRENT_DATE
     ORDER BY title ASC`
  );
  return rows.map(toRow);
}

export type SweepResult = { deleted: number; ids: string[] };

/**
 * 종료된 박람회를 지운다. **되돌릴 수 없다.**
 *
 * 한 건씩 트랜잭션을 묶는다 — 로그를 남기지 못하면 그 행은 지우지 않는다.
 * 알림 구독(`expo_notify`)은 `ON DELETE CASCADE`로 함께 지워진다(0064).
 */
export async function sweepEndedExpos(pool: Pool): Promise<SweepResult> {
  const due = await listExposDueForDeletion(pool);
  const ids: string[] = [];

  for (const expo of due) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO structured.expo_deletion_log
           (event_id, event_name, start_date, end_date, venue, delete_reason)
         VALUES ($1, $2, $3, $4, $5, 'EVENT_ENDED')`,
        [expo.id, expo.title, expo.startsAt, expo.endsAt, expo.venue]
      );
      await client.query('DELETE FROM structured.expos WHERE id = $1', [expo.id]);
      await client.query('COMMIT');
      ids.push(expo.id);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`박람회 삭제 실패 (${expo.id}):`, error);
    } finally {
      client.release();
    }
  }

  return { deleted: ids.length, ids };
}

/**
 * 재수집 방지(사양 15절) — 행사명 + 시작일 + 장소가 삭제 로그와 같으면 다시
 * 등록하지 않는다. 다음 해·새 일정으로 열리는 같은 브랜드는 시작일이 달라
 * 이 검사를 통과한다("2026 서울 웨딩페어" 종료 → "2027 서울 웨딩페어"는 신규).
 */
export async function wasRecentlyDeleted(
  pool: Pool,
  candidate: { eventName: string; startDate: string; venue: string }
): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM structured.expo_deletion_log
     WHERE event_name = $1 AND start_date = $2 AND venue = $3
     LIMIT 1`,
    [candidate.eventName, candidate.startDate, candidate.venue]
  );
  return rows.length > 0;
}
