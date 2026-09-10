import { completeWithdrawals } from '../withdrawal';
import { forceWithdraw, hold, list, resume, retry } from '../withdrawal-admin';
import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 회원탈퇴 운영자 개입. 05번 명세 14·35번.
 *
 * 자동 파기(withdrawal.test.ts)는 그대로 두고, 여기서는 운영자가 조회·보류·
 * 재시도할 때 지켜야 하는 것만 본다 — **무기한 보류는 없고**, **보류는 스스로
 * 풀리며**, **삭제는 두 번 시도해도 안전하고**, **모든 개입은 로그로 남는다.**
 */
describeWithDb('회원탈퇴 운영자 개입', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function anOperator(): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
    );

    return rows[0]!.id;
  }

  /** 탈퇴를 접수한 계정. 원본 문서를 남겨두면 아직 지울 수 없는 상태가 된다. */
  async function aWithdrawnUser(withBlockingDocument = false): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      "INSERT INTO structured.users (deleted_at) VALUES (now()) RETURNING id"
    );
    const userId = rows[0]!.id;

    if (withBlockingDocument) {
      await test.pool.query(
        `INSERT INTO originals.raw_documents (owner_user_id, page_count, uploaded_at)
         VALUES ($1, 1, now())`,
        [userId]
      );
    }

    return userId;
  }

  const userExists = async (userId: string) =>
    (await test.pool.query('SELECT 1 FROM structured.users WHERE id = $1', [userId])).rowCount === 1;

  const isDeletable = async (userId: string) =>
    (
      await test.pool.query('SELECT 1 FROM structured.deletable_accounts WHERE user_id = $1', [
        userId,
      ])
    ).rowCount === 1;

  it('조회는 대기·보류·삭제대기를 구분해서 보여준다', async () => {
    const pending = await aWithdrawnUser(true);
    const deletionPending = await aWithdrawnUser(false);
    const operator = await anOperator();

    await hold(test.pool, pending, operator, '사고 의심', new Date(Date.now() + 60_000));

    const accounts = await list(test.pool);
    const byId = Object.fromEntries(accounts.map((a) => [a.userId, a]));

    expect(byId[pending]!.status).toBe('hold');
    expect(byId[deletionPending]!.status).toBe('deletion_pending');
  });

  it('탈퇴를 접수하지 않은 계정은 보류할 수 없다', async () => {
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );
    const operator = await anOperator();

    await expect(
      hold(test.pool, rows[0]!.id, operator, '아무거나', new Date(Date.now() + 60_000))
    ).rejects.toThrow('탈퇴를 접수하지 않은');
  });

  it('사유 없이는 보류할 수 없다', async () => {
    const userId = await aWithdrawnUser();
    const operator = await anOperator();

    await expect(hold(test.pool, userId, operator, '  ', new Date(Date.now() + 60_000))).rejects.toThrow(
      '보류 사유'
    );
  });

  it('지난 시각으로는 보류할 수 없다 — 무기한 보류를 만드는 뒷문을 막는다', async () => {
    const userId = await aWithdrawnUser();
    const operator = await anOperator();

    await expect(
      hold(test.pool, userId, operator, '사고 의심', new Date(Date.now() - 1000))
    ).rejects.toThrow('hold_until');
  });

  it('같은 계정을 두 번 보류할 수 없다', async () => {
    const userId = await aWithdrawnUser();
    const operator = await anOperator();

    await hold(test.pool, userId, operator, '먼저 건 것', new Date(Date.now() + 60_000));

    await expect(
      hold(test.pool, userId, operator, '나중에 건 것', new Date(Date.now() + 60_000))
    ).rejects.toThrow('이미 보류가 걸려 있는');
  });

  it('보류가 걸린 계정은 워커가 지우지 않는다', async () => {
    const userId = await aWithdrawnUser();
    const operator = await anOperator();

    await hold(test.pool, userId, operator, '사고 의심', new Date(Date.now() + 60_000));

    expect(await isDeletable(userId)).toBe(false);

    await completeWithdrawals(test.pool);

    expect(await userExists(userId)).toBe(true);
  });

  it('보류 만료 시각이 지나면 운영자가 해제하지 않아도 다시 파기 대상이 된다', async () => {
    // 시스템이 스스로 진행을 재개한다 — 사람이 보류를 걸고 잊어도 계정이 영원히 남지 않는다.
    const userId = await aWithdrawnUser();
    const operator = await anOperator();

    await hold(test.pool, userId, operator, '사고 의심', new Date(Date.now() + 1000));

    expect(await isDeletable(userId)).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(await isDeletable(userId)).toBe(true);

    await completeWithdrawals(test.pool);

    expect(await userExists(userId)).toBe(false);
  });

  it('걸려 있지 않은 보류는 해제할 수 없다', async () => {
    const userId = await aWithdrawnUser();
    const operator = await anOperator();

    await expect(resume(test.pool, userId, operator, '아무거나')).rejects.toThrow('걸려 있는 보류가 없다');
  });

  it('해제하면 다시 파기 대상이 된다', async () => {
    const userId = await aWithdrawnUser();
    const operator = await anOperator();

    await hold(test.pool, userId, operator, '사고 의심', new Date(Date.now() + 60_000));
    expect(await isDeletable(userId)).toBe(false);

    await resume(test.pool, userId, operator, '확인 완료, 문제 없음');
    expect(await isDeletable(userId)).toBe(true);
  });

  it('실패 기록이 없는 계정은 재시도할 수 없다', async () => {
    const userId = await aWithdrawnUser();
    const operator = await anOperator();

    await expect(
      retry({ pool: test.pool, storage: test.context.storage }, userId, operator)
    ).rejects.toThrow('다시 시도할 실패 기록이 없는');
  });

  it('보류 중인 계정은 재시도할 수 없다', async () => {
    const userId = await aWithdrawnUser();
    const operator = await anOperator();

    await test.pool.query(
      `INSERT INTO structured.withdrawal_deletion_failures (user_id, error_message) VALUES ($1, $2)`,
      [userId, '연결이 끊겼었다']
    );
    await hold(test.pool, userId, operator, '사고 의심', new Date(Date.now() + 60_000));

    await expect(
      retry({ pool: test.pool, storage: test.context.storage }, userId, operator)
    ).rejects.toThrow('보류 중인 계정은 재시도할 수 없다');
  });

  it('재시도가 성공하면 계정을 지우고 실패 기록도 함께 지운다', async () => {
    const userId = await aWithdrawnUser();
    const operator = await anOperator();

    await test.pool.query(
      `INSERT INTO structured.withdrawal_deletion_failures (user_id, error_message) VALUES ($1, $2)`,
      [userId, '연결이 끊겼었다']
    );

    const result = await retry({ pool: test.pool, storage: test.context.storage }, userId, operator);

    expect(result.completed).toBe(true);
    expect(await userExists(userId)).toBe(false);

    const failures = await test.pool.query(
      'SELECT 1 FROM structured.withdrawal_deletion_failures WHERE user_id = $1',
      [userId]
    );

    expect(failures.rowCount).toBe(0);
  });

  it('재시도해도 원본이 남아 있으면 아직 지우지 않는다', async () => {
    const userId = await aWithdrawnUser(true);
    const operator = await anOperator();

    await test.pool.query(
      `INSERT INTO structured.withdrawal_deletion_failures (user_id, error_message) VALUES ($1, $2)`,
      [userId, '연결이 끊겼었다']
    );

    const result = await retry({ pool: test.pool, storage: test.context.storage }, userId, operator);

    expect(result.completed).toBe(false);
    expect(await userExists(userId)).toBe(true);
  });

  it('두 번 지우려 해도 두 번째는 조용히 아무 일도 하지 않는다', async () => {
    // 멱등성. 배치와 RETRY가 같은 계정을 동시에 다뤄도 문제가 없어야 한다.
    const userId = await aWithdrawnUser();

    const first = await completeWithdrawals(test.pool);
    const second = await completeWithdrawals(test.pool);

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(await userExists(userId)).toBe(false);
  });

  it('모든 개입이 감사로그에 남는다', async () => {
    const userId = await aWithdrawnUser();
    const operator = await anOperator();

    await hold(test.pool, userId, operator, '사고 의심', new Date(Date.now() + 60_000));
    await resume(test.pool, userId, operator, '확인 완료');

    const { rows } = await test.pool.query<{
      action: string;
      operator_id: string;
      account_id: string;
      reason: string;
      before_status: string;
      after_status: string;
    }>(
      `SELECT action, operator_id, account_id, reason, before_status, after_status
       FROM structured.withdrawal_audit_log
       WHERE account_id = $1
       ORDER BY created_at`,
      [userId]
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      action: 'hold',
      operator_id: operator,
      account_id: userId,
      reason: '사고 의심',
      after_status: 'hold',
    });
    expect(rows[1]).toMatchObject({
      action: 'resume',
      operator_id: operator,
      account_id: userId,
      reason: '확인 완료',
      before_status: 'hold',
    });
  });

  /**
   * 운영자가 대신 탈퇴시킨다(2026-09-10 대표 지시).
   *
   * 되돌릴 수 없는 조작이라 **열어 준 만큼 닫아둔 자리**를 같이 못박는다 —
   * 사유 없이는 안 되고, 운영자 계정은 대상이 아니고, 기록이 반드시 남는다.
   */
  describe('운영자가 대신 탈퇴시킨다', () => {
    const deps = () => ({ pool: test.pool, storage: test.context.storage });

    /** 아직 탈퇴하지 않은 보통 계정. */
    async function anActiveUser(): Promise<string> {
      const { rows } = await test.pool.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );

      return rows[0]!.id;
    }

    it('탈퇴를 접수하고 기록을 남긴다', async () => {
      const userId = await anActiveUser();
      const operator = await anOperator();

      const result = await forceWithdraw(deps(), userId, operator, '본인 요청 · 전화 접수');

      expect(result.completed).toBe(true);

      const { rows } = await test.pool.query<{ action: string; reason: string; operator_id: string }>(
        'SELECT action, reason, operator_id FROM structured.withdrawal_audit_log WHERE account_id = $1',
        [userId]
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: 'force',
        reason: '본인 요청 · 전화 접수',
        operator_id: operator,
      });
    });

    it('사유 없이는 아무것도 하지 않는다', async () => {
      const userId = await anActiveUser();
      const operator = await anOperator();

      await expect(forceWithdraw(deps(), userId, operator, '   ')).rejects.toThrow();

      expect(await userExists(userId)).toBe(true);
    });

    it('운영자 계정은 대상이 아니다', async () => {
      const target = await anOperator();
      const operator = await anOperator();

      await expect(forceWithdraw(deps(), target, operator, '정리')).rejects.toThrow();

      expect(await userExists(target)).toBe(true);
    });

    it('이미 접수된 계정은 다시 접수하지 않는다', async () => {
      const userId = await aWithdrawnUser();
      const operator = await anOperator();

      await expect(forceWithdraw(deps(), userId, operator, '중복')).rejects.toThrow();
    });

    it('운영 권한이 없으면 막는다', async () => {
      const userId = await anActiveUser();
      const notOperator = await anActiveUser();

      await expect(forceWithdraw(deps(), userId, notOperator, '권한 없음')).rejects.toThrow();

      expect(await userExists(userId)).toBe(true);
    });
  });

  it('감사로그는 계정이 지워져도 남는다', async () => {
    // account_id는 외래키가 아니다 — 사고 조사 기록이 계정과 함께 사라지면 안 된다.
    const userId = await aWithdrawnUser();
    const operator = await anOperator();

    await hold(test.pool, userId, operator, '사고 의심', new Date(Date.now() + 60_000));
    await resume(test.pool, userId, operator, '확인 완료');
    await completeWithdrawals(test.pool);

    expect(await userExists(userId)).toBe(false);

    const { rowCount } = await test.pool.query(
      'SELECT 1 FROM structured.withdrawal_audit_log WHERE account_id = $1',
      [userId]
    );

    expect(rowCount).toBe(2);
  });
});
