import { createTestApp, resetDatabase, type TestApp } from '../test/helpers';
import {
  listExposDueForDeletion,
  listExposEndingToday,
  sweepEndedExpos,
  wasRecentlyDeleted,
} from './expo-sweep';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

async function insertExpo(
  test: TestApp,
  overrides: { title?: string; venue?: string; daysFromToday: { starts: number; ends: number } }
): Promise<string> {
  const { rows } = await test.pool.query<{ id: string }>(
    `INSERT INTO structured.expos (title, organizer, starts_at, ends_at, venue, region)
     VALUES ($1, '테스트 주최사', CURRENT_DATE + $2::int, CURRENT_DATE + $3::int, $4, '서울')
     RETURNING id`,
    [
      overrides.title ?? '테스트 박람회',
      overrides.daysFromToday.starts,
      overrides.daysFromToday.ends,
      overrides.venue ?? '테스트 컨벤션',
    ]
  );
  return rows[0]!.id;
}

/**
 * 종료 박람회 자동 삭제(`docs/expo-agent-spec.md` 15절) — 종료일 당일은 그대로 두고
 * 다음 날부터 지운다. 삭제하면 본문은 사라지고 최소 로그만 남는다.
 */
describeWithDb('종료 박람회 자동 삭제', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('종료일 당일은 지우지 않는다', async () => {
    await insertExpo(test, { daysFromToday: { starts: -2, ends: 0 } });

    const due = await listExposDueForDeletion(test.pool);
    expect(due).toHaveLength(0);

    const endingToday = await listExposEndingToday(test.pool);
    expect(endingToday).toHaveLength(1);
  });

  it('종료일 다음 날부터 삭제 대상이다', async () => {
    const id = await insertExpo(test, { daysFromToday: { starts: -3, ends: -1 } });

    const due = await listExposDueForDeletion(test.pool);
    expect(due.map((e) => e.id)).toEqual([id]);
  });

  it('지우면 본문은 사라지고 최소 로그만 남는다', async () => {
    const id = await insertExpo(test, {
      title: '종료된 박람회',
      venue: '코엑스',
      daysFromToday: { starts: -10, ends: -1 },
    });

    const result = await sweepEndedExpos(test.pool);

    expect(result.deleted).toBe(1);
    expect(result.ids).toEqual([id]);

    const { rows: remaining } = await test.pool.query('SELECT 1 FROM structured.expos WHERE id = $1', [id]);
    expect(remaining).toHaveLength(0);

    const { rows: logRows } = await test.pool.query<{
      event_name: string;
      venue: string;
      delete_reason: string;
    }>('SELECT event_name, venue, delete_reason FROM structured.expo_deletion_log WHERE event_id = $1', [id]);

    expect(logRows).toHaveLength(1);
    expect(logRows[0]).toMatchObject({
      event_name: '종료된 박람회',
      venue: '코엑스',
      delete_reason: 'EVENT_ENDED',
    });
  });

  it('진행 중이거나 예정인 박람회는 건드리지 않는다', async () => {
    await insertExpo(test, { daysFromToday: { starts: 5, ends: 6 } }); // 예정
    await insertExpo(test, { daysFromToday: { starts: -1, ends: 1 } }); // 진행 중

    const result = await sweepEndedExpos(test.pool);

    expect(result.deleted).toBe(0);
    const { rows } = await test.pool.query('SELECT 1 FROM structured.expos');
    expect(rows).toHaveLength(2);
  });

  it('삭제 로그와 행사명 + 시작일 + 장소가 같으면 재수집 방지 대상이다', async () => {
    await insertExpo(test, {
      title: '2026 서울 웨딩페어',
      venue: '코엑스',
      daysFromToday: { starts: -10, ends: -1 },
    });
    await sweepEndedExpos(test.pool);

    const { rows } = await test.pool.query<{ start_date: string }>(
      `SELECT start_date::text FROM structured.expo_deletion_log LIMIT 1`
    );
    const startDate = rows[0]!.start_date;

    const blocked = await wasRecentlyDeleted(test.pool, {
      eventName: '2026 서울 웨딩페어',
      startDate,
      venue: '코엑스',
    });
    expect(blocked).toBe(true);

    // 다음 해 같은 브랜드는 시작일이 달라 신규 행사로 통과한다.
    const nextYear = await wasRecentlyDeleted(test.pool, {
      eventName: '2027 서울 웨딩페어',
      startDate,
      venue: '코엑스',
    });
    expect(nextYear).toBe(false);
  });
});
