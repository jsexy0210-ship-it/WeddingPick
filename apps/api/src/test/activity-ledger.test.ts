import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { ACTIVITY_MAX_AXES, ACTIVITY_MIN_SUBJECTS, foldSearchText, weekStart } from '@weddingpick/domain';

import { activityOverview, buildRollup } from '../activity-admin';
import { flushActivity, recordActivity } from '../activity-ledger';
import { withdraw } from '../withdrawal';
import {
  adminSession,
  createTestApp,
  createWedding,
  resetDatabase,
  signInAs,
  type TestApp,
} from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 회원 활동 원장(1층)과 집계층(2층). 0280.
 *
 * 여기서 지키는 것은 넷이다.
 *
 *   원장은 고치지도 지우지도 않는다
 *   탈퇴하면 원장은 사라지고 집계는 남는다
 *   최소 인원에 못 미치는 묶음은 **행 자체가** 나가지 않는다
 *   민감한 값은 스키마가 막는다
 */
describeWithDb('회원 활동 원장', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function aMember(subject: string) {
    return signInAs(test, subject);
  }

  async function recordOne(userId: string, overrides: Record<string, unknown> = {}) {
    recordActivity(test.pool, {
      userId,
      eventName: 'vendor_viewed',
      surface: 'vendor',
      ...overrides,
    });
    await flushActivity(test.pool);
  }

  describe('append-only', () => {
    it('담긴 줄은 고칠 수 없다', async () => {
      const member = await aMember('ledger-immutable');

      await recordOne(member.userId);

      await expect(
        test.pool.query("UPDATE structured.activity_events SET surface = 'home'")
      ).rejects.toThrow(/고치지 않는다/);
    });

    it('살아 있는 회원의 줄은 지울 수 없다', async () => {
      const member = await aMember('ledger-undeletable');

      await recordOne(member.userId);

      await expect(
        test.pool.query('DELETE FROM structured.activity_events')
      ).rejects.toThrow(/지우지 않는다/);
    });

    it('틀린 줄은 남고 정정 줄이 뒤에 붙는다', async () => {
      const member = await aMember('ledger-correction');

      await recordOne(member.userId, { surface: 'home' });

      const { rows: before } = await test.pool.query<{ id: string }>(
        'SELECT id FROM structured.activity_events'
      );

      await test.pool.query(
        `INSERT INTO structured.activity_events
           (user_id, event_name, surface, client_event_id, corrects_event_id)
         VALUES ($1, 'vendor_viewed', 'vendor', $2, $3)`,
        [member.userId, randomUUID(), before[0]!.id]
      );

      const { rows } = await test.pool.query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM structured.activity_events'
      );

      // 두 줄이다. 틀린 줄이 지워지지 않았다는 것이 요점이다.
      expect(Number(rows[0]!.count)).toBe(2);
    });

    it('남의 줄은 정정하지 못한다', async () => {
      const mine = await aMember('ledger-mine');
      const theirs = await aMember('ledger-theirs');

      await recordOne(mine.userId);

      const { rows } = await test.pool.query<{ id: string }>(
        'SELECT id FROM structured.activity_events'
      );

      await expect(
        test.pool.query(
          `INSERT INTO structured.activity_events
             (user_id, event_name, surface, client_event_id, corrects_event_id)
           VALUES ($1, 'vendor_viewed', 'vendor', $2, $3)`,
          [theirs.userId, randomUUID(), rows[0]!.id]
        )
      ).rejects.toThrow();
    });
  });

  describe('민감한 값', () => {
    it('전화번호꼴 검색어는 담기지 않는다', async () => {
      const member = await aMember('ledger-phone');

      await expect(
        test.pool.query(
          `INSERT INTO structured.activity_events
             (user_id, event_name, surface, search_text, client_event_id)
           VALUES ($1, 'search_submitted', 'search', '010-1234-5678', $2)`,
          [member.userId, randomUUID()]
        )
      ).rejects.toThrow();
    });

    it('카드번호꼴 검색어도 담기지 않는다', async () => {
      const member = await aMember('ledger-card');

      await expect(
        test.pool.query(
          `INSERT INTO structured.activity_events
             (user_id, event_name, surface, search_text, client_event_id)
           VALUES ($1, 'search_submitted', 'search', '4111 1111 1111 1111', $2)`,
          [member.userId, randomUUID()]
        )
      ).rejects.toThrow();
    });

    it('검색이 아닌 사건에는 글이 실리지 않는다', async () => {
      const member = await aMember('ledger-note');

      await expect(
        test.pool.query(
          `INSERT INTO structured.activity_events
             (user_id, event_name, surface, search_text, client_event_id)
           VALUES ($1, 'visit_note_written', 'wedding_note', '드레스가 예뻤다', $2)`,
          [member.userId, randomUUID()]
        )
      ).rejects.toThrow();
    });
  });

  describe('탈퇴', () => {
    it('계정이 파기되면 원장은 함께 사라진다', async () => {
      const member = await aMember('ledger-withdrawn');

      await recordOne(member.userId);

      const deleted = await withdraw(
        { pool: test.pool, storage: test.context.storage },
        member.userId
      );

      expect(deleted.completed).toBe(true);

      const { rows } = await test.pool.query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM structured.activity_events'
      );

      expect(Number(rows[0]!.count)).toBe(0);
    });

    it('탈퇴해도 이미 뽑아둔 집계는 남는다 — 두 층으로 지은 이유다', async () => {
      const members = await manyMembers('ledger-survivor', ACTIVITY_MIN_SUBJECTS);

      for (const member of members) await recordOne(member.userId, { surface: 'vendor' });

      const period = weekStart(new Date()).toISOString().slice(0, 10);

      await buildRollup(test.pool, { periodStart: period, periodDays: 7 });

      const before = await rollupCount();

      expect(before).toBeGreaterThan(0);

      for (const member of members) {
        await withdraw({ pool: test.pool, storage: test.context.storage }, member.userId);
      }

      const { rows } = await test.pool.query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM structured.activity_events'
      );

      expect(Number(rows[0]!.count)).toBe(0);
      expect(await rollupCount()).toBe(before);
    });
  });

  describe('집계층', () => {
    it('최소 인원에 못 미치면 행 자체가 없다', async () => {
      const members = await manyMembers('ledger-thin', ACTIVITY_MIN_SUBJECTS - 1);

      for (const member of members) await recordOne(member.userId);

      const period = weekStart(new Date()).toISOString().slice(0, 10);
      const result = await buildRollup(test.pool, { periodStart: period, periodDays: 7 });

      expect(result.rowsWritten).toBe(0);
      // 뺀 수는 남긴다 — 기준이 적당한지를 그 수가 말해준다.
      expect(result.rowsSuppressed).toBeGreaterThan(0);
      expect(await rollupCount()).toBe(0);
    });

    it('최소 인원을 넘기면 묶음이 나간다', async () => {
      const members = await manyMembers('ledger-thick', ACTIVITY_MIN_SUBJECTS);

      for (const member of members) await recordOne(member.userId);

      const period = weekStart(new Date()).toISOString().slice(0, 10);
      const result = await buildRollup(test.pool, { periodStart: period, periodDays: 7 });

      expect(result.rowsWritten).toBeGreaterThan(0);
      expect(result.kThreshold).toBe(ACTIVITY_MIN_SUBJECTS);
    });

    it('지역·예산으로 가른 묶음이 실제로 나온다 — 접는 규칙이 도는지', async () => {
      /*
       * 축 없는 묶음만 나오는 것으로는 「접는 규칙이 돈다」를 확인할 수 없다.
       * 회원마다 웨딩을 만들어 지역과 예산을 붙이고, 그 축으로 갈린 행이 실제로
       * 나오는지 본다.
       */
      const members = await manyMembers('ledger-axes', ACTIVITY_MIN_SUBJECTS);

      for (const member of members) {
        const weddingId = await createWedding(test, member.headers);

        await test.pool.query(
          `UPDATE structured.weddings
           SET region = '서울특별시 강남구', budget_bracket = '20m_30m'
           WHERE id = $1`,
          [weddingId]
        );

        await recordOne(member.userId);
      }

      const period = weekStart(new Date()).toISOString().slice(0, 10);

      await buildRollup(test.pool, { periodStart: period, periodDays: 7 });

      const { rows } = await test.pool.query<{
        region: string | null;
        budget_bracket: string | null;
      }>('SELECT region, budget_bracket FROM structured.activity_rollups');

      // 긴 꼴(«서울특별시»)이 짧은 꼴로 접혔다.
      expect(rows.some((row) => row.region === '서울')).toBe(true);
      expect(rows.some((row) => row.budget_bracket === '20m_30m')).toBe(true);
      // 지역과 예산을 함께 가른 묶음도 있다 — 축 둘까지는 허용이다.
      expect(rows.some((row) => row.region === '서울' && row.budget_bracket === '20m_30m')).toBe(true);
      // 축 없는 전체 묶음도 그대로 있다.
      expect(rows.some((row) => row.region === null && row.budget_bracket === null)).toBe(true);
    });

    it('두 번 뽑아도 행이 늘지 않는다', async () => {
      const members = await manyMembers('ledger-twice', ACTIVITY_MIN_SUBJECTS);

      for (const member of members) await recordOne(member.userId);

      const period = weekStart(new Date()).toISOString().slice(0, 10);

      await buildRollup(test.pool, { periodStart: period, periodDays: 7 });

      const first = await rollupCount();

      await buildRollup(test.pool, { periodStart: period, periodDays: 7 });

      expect(await rollupCount()).toBe(first);
    });

    it('사람 단위 행이 없다', async () => {
      const { rows } = await test.pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'structured' AND table_name = 'activity_rollups'`
      );

      const names = rows.map((row) => row.column_name);

      expect(names).not.toContain('user_id');
      expect(names.some((name) => name.includes('user'))).toBe(false);
    });

    it('축을 셋 다 채운 행은 들어가지 못한다', async () => {
      await expect(
        test.pool.query(
          `INSERT INTO structured.activity_rollups
             (period_start, period_days, event_name, surface, region, category, budget_bracket,
              subject_count, event_count, fold_rule, k_threshold)
           VALUES ('2026-09-14', 7, 'vendor_viewed', 'vendor', '서울', 'studio', '20m_30m',
                   100, 100, 'fold/v1', $1)`,
          [ACTIVITY_MIN_SUBJECTS]
        )
      ).rejects.toThrow();
    });

    it('최소 인원 미만인 행은 스키마가 막는다 — 뽑는 코드가 틀려도', async () => {
      await expect(
        test.pool.query(
          `INSERT INTO structured.activity_rollups
             (period_start, period_days, event_name, surface,
              subject_count, event_count, fold_rule, k_threshold)
           VALUES ('2026-09-14', 7, 'vendor_viewed', 'vendor', $1, 100, 'fold/v1', $2)`,
          [ACTIVITY_MIN_SUBJECTS - 1, ACTIVITY_MIN_SUBJECTS]
        )
      ).rejects.toThrow();
    });

    it('스키마의 최소 인원과 도메인의 값이 같다', () => {
      /*
       * 둘이 어긋나면 코드가 거른 것과 표가 거른 것이 달라진다. 숫자를 두 곳에
       * 적은 대가라 시험이 대신 지킨다 — CHECK에는 상수를 쓸 수 없다.
       */
      const sql = readFileSync(
        join(__dirname, '..', '..', '..', '..', 'packages/db/migrations/0280_activity_ledger.sql'),
        'utf8'
      );

      expect(sql).toContain(`CHECK (subject_count >= ${ACTIVITY_MIN_SUBJECTS})`);
      expect(sql).toContain(`CHECK (k_threshold >= ${ACTIVITY_MIN_SUBJECTS})`);
      expect(ACTIVITY_MAX_AXES).toBe(2);
    });
  });

  describe('검색어 접기', () => {
    it('업종 이름과 지역 이름만 집어낸다', () => {
      expect(foldSearchText('강남 스튜디오 저렴한 곳')).toEqual({
        category: 'studio',
        region: null,
      });
      expect(foldSearchText('서울 웨딩홀')).toEqual({ category: 'hall', region: '서울' });
    });

    it('둘이 함께 든 말은 접지 않는다 — 하나를 고르면 지어낸 값이다', () => {
      expect(foldSearchText('스튜디오 드레스 패키지').category).toBeNull();
    });

    it('어디에도 없는 말은 그대로 올라가지 않는다', () => {
      expect(foldSearchText('제 이름은 김철수입니다')).toEqual({ category: null, region: null });
    });
  });

  describe('서버가 보는 행동', () => {
    it('업체를 열면 원장에 한 줄이 남는다', async () => {
      const member = await aMember('ledger-hook');
      const { rows } = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source, last_verified_at)
         VALUES ('강남 A 스튜디오', 'studio', '서울 강남구', 'public_data', now()) RETURNING id`
      );

      await test.app.inject({
        method: 'GET',
        url: `/v1/vendors/${rows[0]!.id}`,
        headers: member.headers,
      });

      await flushActivity(test.pool);

      const { rows: events } = await test.pool.query<{ event_name: string; target_id: string }>(
        'SELECT event_name, target_id FROM structured.activity_events'
      );

      expect(events).toHaveLength(1);
      expect(events[0]!.event_name).toBe('vendor_viewed');
      expect(events[0]!.target_id).toBe(rows[0]!.id);
    });

    it('로그인하지 않은 요청은 담지 않는다', async () => {
      await test.app.inject({ method: 'GET', url: '/health' });
      await flushActivity(test.pool);

      const { rows } = await test.pool.query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM structured.activity_events'
      );

      expect(Number(rows[0]!.count)).toBe(0);
    });
  });

  describe('앱이 보내는 줄', () => {
    it('같은 줄을 두 번 보내도 한 줄이다', async () => {
      const member = await aMember('ledger-retry');
      const clientEventId = randomUUID();
      const payload = {
        events: [{ clientEventId, eventName: 'screen_view', surface: 'home' }],
      };

      await test.app.inject({
        method: 'POST',
        url: '/v1/activity/events',
        headers: member.headers,
        payload,
      });
      await test.app.inject({
        method: 'POST',
        url: '/v1/activity/events',
        headers: member.headers,
        payload,
      });

      await flushActivity(test.pool);

      const { rows } = await test.pool.query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM structured.activity_events'
      );

      expect(Number(rows[0]!.count)).toBe(1);
    });

    it('목록에 없는 지역은 받지 않는다', async () => {
      const member = await aMember('ledger-badregion');

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/activity/events',
        headers: member.headers,
        payload: {
          events: [
            {
              clientEventId: randomUUID(),
              eventName: 'category_selected',
              surface: 'search',
              region: '서울특별시',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('관리자 화면이 읽는 값', () => {
    it('기준을 숫자로 함께 내려준다 — 화면이 스스로 정하지 않게', async () => {
      const overview = await activityOverview(test.pool, { droppedInProcess: 0 });

      expect(overview.policy.minSubjects).toBe(ACTIVITY_MIN_SUBJECTS);
      expect(overview.policy.maxAxes).toBe(ACTIVITY_MAX_AXES);
    });

    it('운영자는 읽고, 관리자가 아닌 계정은 막힌다', async () => {
      const operator = await adminSession(test, 'operator');
      const outsider = await adminSession(test, null);

      const allowed = await test.app.inject({
        method: 'GET',
        url: '/v1/admin/activity',
        headers: operator.headers,
      });
      const blocked = await test.app.inject({
        method: 'GET',
        url: '/v1/admin/activity',
        headers: outsider.headers,
      });

      expect(allowed.statusCode).toBe(200);
      expect(blocked.statusCode).toBe(403);
    });

    it('내보내는 값에 사람이 없다', async () => {
      const members = await manyMembers('ledger-export', ACTIVITY_MIN_SUBJECTS);

      for (const member of members) await recordOne(member.userId);

      const period = weekStart(new Date()).toISOString().slice(0, 10);

      await buildRollup(test.pool, { periodStart: period, periodDays: 7 });

      const operator = await adminSession(test, 'operator');
      const response = await test.app.inject({
        method: 'GET',
        url: '/v1/admin/activity/export',
        headers: operator.headers,
      });

      const body = response.json<{ rows: Record<string, unknown>[] }>();

      expect(body.rows.length).toBeGreaterThan(0);

      for (const row of body.rows) {
        expect(Object.keys(row)).not.toContain('userId');
        expect(Number(row['subjectCount'])).toBeGreaterThanOrEqual(ACTIVITY_MIN_SUBJECTS);
      }
    });
  });

  async function manyMembers(prefix: string, count: number) {
    const members = [];

    for (let i = 0; i < count; i += 1) {
      members.push(await signInAs(test, `${prefix}-${i}`));
    }

    return members;
  }

  async function rollupCount(): Promise<number> {
    const { rows } = await test.pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM structured.activity_rollups'
    );

    return Number(rows[0]!.count);
  }
});
