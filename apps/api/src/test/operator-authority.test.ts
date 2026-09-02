import { NotAnOperator } from '../decisions';
import { holdReview } from '../objection-decide';
import { conclude } from '../pii-admin';
import { decideRebuttal } from '../rebuttal-decide';
import { decide as decideVendorClaim } from '../vendor-claim-admin';
import { moveStatus } from '../inquiry-admin';
import { approve as approveVerification } from '../verification-admin';
import { hold as holdWithdrawal, resume as resumeWithdrawal, retry as retryWithdrawal } from '../withdrawal-admin';
import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 결정을 내리는 도구는 사용자 id를 받을 뿐, 그 사람이 심사 권한이 있는지
 * 확인하지 않았다(05번 명세 14번). 서버에 접근할 수 있는 사람만 이 명령을
 * 돌릴 수 있다는 것이 유일한 통제였고, 그건 통제라기보다 우연이었다.
 *
 * **관문은 결정 함수 맨 앞에 있다** — 대상을 찾기도 전에 사람부터 본다. 그래서
 * 존재하지 않는 id를 넘겨도 "권한이 없다"는 같은 답을 받는다. 대상이 있는지
 * 없는지를 권한 없는 사람에게 먼저 알려줄 이유가 없다.
 */
describeWithDb('심사 권한', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function anOrdinaryUser(): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );

    return rows[0]!.id;
  }

  const NOWHERE = '00000000-0000-0000-0000-000000000000';

  it('반론을 실을 때 운영자가 아니면 막는다', async () => {
    await expect(
      decideRebuttal(test.pool, {
        id: NOWHERE,
        to: 'published',
        by: await anOrdinaryUser(),
        note: '아무거나',
      })
    ).rejects.toThrow(NotAnOperator);
  });

  it('이의를 내려둘 때 운영자가 아니면 막는다', async () => {
    await expect(
      holdReview(test.pool, { reviewId: NOWHERE, by: await anOrdinaryUser(), note: '아무거나' })
    ).rejects.toThrow(NotAnOperator);
  });

  it('인증 심사를 승인할 때 운영자가 아니면 막는다', async () => {
    await expect(
      approveVerification(test.pool, NOWHERE, await anOrdinaryUser(), null)
    ).rejects.toThrow(NotAnOperator);
  });

  it('업체 관계자 인증을 결정할 때 운영자가 아니면 막는다', async () => {
    await expect(
      decideVendorClaim(test.pool, NOWHERE, 'approved', await anOrdinaryUser(), '아무거나')
    ).rejects.toThrow(NotAnOperator);
  });

  it('개인정보 검토를 마칠 때 운영자가 아니면 막는다', async () => {
    await expect(
      conclude(test.pool, NOWHERE, await anOrdinaryUser(), 'clean')
    ).rejects.toThrow(NotAnOperator);
  });

  it('문의를 처리할 때 운영자가 아니면 막는다', async () => {
    await expect(
      moveStatus(test.pool, NOWHERE, 'answered', await anOrdinaryUser(), '아무거나', false, null)
    ).rejects.toThrow(NotAnOperator);
  });

  it('탈퇴를 보류할 때 운영자가 아니면 막는다', async () => {
    await expect(
      holdWithdrawal(test.pool, NOWHERE, await anOrdinaryUser(), '아무거나', new Date(Date.now() + 86_400_000))
    ).rejects.toThrow(NotAnOperator);
  });

  it('탈퇴 보류를 해제할 때 운영자가 아니면 막는다', async () => {
    await expect(
      resumeWithdrawal(test.pool, NOWHERE, await anOrdinaryUser(), '아무거나')
    ).rejects.toThrow(NotAnOperator);
  });

  it('탈퇴 삭제를 재시도할 때 운영자가 아니면 막는다', async () => {
    await expect(
      retryWithdrawal({ pool: test.pool, storage: test.context.storage }, NOWHERE, await anOrdinaryUser())
    ).rejects.toThrow(NotAnOperator);
  });

  it('가입하지 않은 id로는 아무 결정도 낼 수 없다', async () => {
    // 존재하지 않는 사람도 운영자가 아닌 사람과 같은 취급을 받는다.
    await expect(
      decideRebuttal(test.pool, { id: NOWHERE, to: 'published', by: NOWHERE, note: '아무거나' })
    ).rejects.toThrow(NotAnOperator);
  });
});
