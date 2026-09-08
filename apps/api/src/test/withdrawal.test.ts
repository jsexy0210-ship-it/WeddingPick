import type { LocalStorage } from '../storage/local';
import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 회원탈퇴. 디자인 핸드오프 WP-MY-008.
 *
 * 여기서 지키는 것은 셋이다.
 *
 *   1. **원본 파일이 스토리지에 남지 않는다.** 계정을 지웠는데 파일이 남으면
 *      지웠다고 말하고 남긴 것이 된다.
 *   2. **떠나는 사람이 남는 사람의 기록을 지우지 않는다.** 웨딩은 배우자에게 넘어간다.
 *   3. **확인된 정보는 작성자와 끊어질 뿐 사라지지 않는다.** 후기가 사라지면 그
 *      업체를 보던 다음 사람의 판단 근거가 함께 사라진다.
 */
describeWithDb('회원탈퇴', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function aWedding(ownerId: string): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
      [ownerId]
    );

    return rows[0]!.id;
  }

  async function aDocument(ownerId: string): Promise<{ id: string; key: string }> {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO originals.raw_documents (owner_user_id, page_count, uploaded_at)
       VALUES ($1, 1, now()) RETURNING id`,
      [ownerId]
    );

    const id = rows[0]!.id;
    const key = `${id}/page-0`;

    (test.context.storage as LocalStorage).put(key, Buffer.from('원본'));
    await test.pool.query(
      `INSERT INTO originals.raw_document_pages (raw_document_id, page_index, storage_key, mime_type)
       VALUES ($1, 0, $2, 'image/jpeg')`,
      [id, key]
    );

    return { id, key };
  }

  async function aReview(authorId: string): Promise<string> {
    const vendor = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id`
    );

    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.reviews (vendor_id, author_user_id, role, overall, title, body)
       VALUES ($1, $2, 'contractor', 4, '식장이 넓었어요',
               '음식이 따뜻하게 나왔고 직원분들이 동선을 잘 안내해 주셨습니다. 주차는 조금 붐비는 편이었습니다.')
       RETURNING id`,
      [vendor.rows[0]!.id, authorId]
    );

    return rows[0]!.id;
  }

  const userExists = async (userId: string) =>
    (await test.pool.query('SELECT 1 FROM structured.users WHERE id = $1', [userId])).rowCount === 1;

  it('안내가 그 사람의 실제 개수를 말한다', async () => {
    const me = await signInAs(test, 'leaving');
    const weddingId = await aWedding(me.userId);

    await test.pool.query(
      `INSERT INTO structured.wedding_tasks (wedding_id, label) VALUES ($1, '드레스 투어')`,
      [weddingId]
    );
    await test.pool.query(
      `INSERT INTO structured.expenses (wedding_id, label, amount) VALUES ($1, '계약금', 3000000)`,
      [weddingId]
    );

    const notice = (
      await test.app.inject({ method: 'GET', url: '/v1/me/withdrawal', headers: me.headers })
    ).json<{ lead: string; deleted: { label: string; value: string }[] }>();

    expect(notice.lead).toBe('지금까지 준비한 기록이 사라져요');
    expect(notice.deleted).toContainEqual({ label: '일정 · 체크리스트', value: '1개' });
    expect(notice.deleted).toContainEqual({ label: '지출 기록', value: '300만원' });
  });

  it('탈퇴하면 원본 파일이 스토리지에 남지 않는다', async () => {
    /*
     * 가장 나쁜 결과는 계정만 지워지고 파일이 남는 것이다. 지울 열쇠(문서 행)가
     * 계정과 함께 사라지므로, 그 뒤에는 아무도 그 파일이 있는 줄 모른다.
     */
    const me = await signInAs(test, 'leaving');
    const document = await aDocument(me.userId);
    const storage = test.context.storage as LocalStorage;

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/me/withdrawal',
      headers: me.headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ completed: boolean }>().completed).toBe(true);
    await expect(storage.download(document.key)).rejects.toThrow();
    expect(await userExists(me.userId)).toBe(false);
  });

  it('Pick한 업체가 있어도 계정이 그 자리에서 지워진다', async () => {
    /*
     * 회귀 — vendor_candidates의 삭제 이력 트리거(0067)가 웨딩이 CASCADE로
     * 사라지는 도중 이미 없는 wedding_id로 removed_candidates에 INSERT하려다
     * FK에 걸려, Pick이 하나라도 있는 사람은 계정 행이 끝내 안 지워졌다.
     * API는 그래도 completed=false로 «접수»라 답해 아무도 눈치채지 못했다.
     */
    const me = await signInAs(test, 'picker');
    const weddingId = await aWedding(me.userId);
    const vendor = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id`
    );

    await test.pool.query(
      `INSERT INTO structured.vendor_candidates (wedding_id, vendor_id, added_by)
       VALUES ($1, $2, $3)`,
      [weddingId, vendor.rows[0]!.id, me.userId]
    );

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/me/withdrawal',
      headers: me.headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ completed: true });
    expect(await userExists(me.userId)).toBe(false);

    const failures = await test.pool.query(
      'SELECT 1 FROM structured.withdrawal_deletion_failures WHERE user_id = $1',
      [me.userId]
    );

    expect(failures.rowCount).toBe(0);
  });

  it('탈퇴하면 그 자리에서 못 들어온다', async () => {
    const me = await signInAs(test, 'leaving');

    await test.app.inject({ method: 'POST', url: '/v1/me/withdrawal', headers: me.headers });

    const after = await test.app.inject({
      method: 'GET',
      url: '/v1/me/settings',
      headers: me.headers,
    });

    expect(after.statusCode).toBe(401);
  });

  it('배우자가 있으면 웨딩을 넘기고 상대 기록은 지우지 않는다', async () => {
    /*
     * 떠나는 사람의 탈퇴가 남는 사람의 일정과 지출을 지울 권한은 아니다.
     * weddings.owner_user_id 가 CASCADE라서 넘기지 않으면 함께 사라진다.
     */
    const me = await signInAs(test, 'leaving');
    const partner = await signInAs(test, 'staying');
    const weddingId = await aWedding(me.userId);

    await test.pool.query('UPDATE structured.weddings SET partner_user_id = $2 WHERE id = $1', [
      weddingId,
      partner.userId,
    ]);
    await test.pool.query(
      `INSERT INTO structured.expenses (wedding_id, label, amount) VALUES ($1, '계약금', 3000000)`,
      [weddingId]
    );

    const notice = (
      await test.app.inject({ method: 'GET', url: '/v1/me/withdrawal', headers: me.headers })
    ).json<{ lead: string; hasPartner: boolean }>();

    expect(notice.hasPartner).toBe(true);
    expect(notice.lead).toBe('배우자와 함께 만든 기록도 함께 사라져요');

    await test.app.inject({ method: 'POST', url: '/v1/me/withdrawal', headers: me.headers });

    const { rows } = await test.pool.query<{ owner_user_id: string; partner_user_id: string | null }>(
      'SELECT owner_user_id, partner_user_id FROM structured.weddings WHERE id = $1',
      [weddingId]
    );

    expect(rows[0]).toEqual({ owner_user_id: partner.userId, partner_user_id: null });

    const expenses = await test.pool.query('SELECT 1 FROM structured.expenses WHERE wedding_id = $1', [
      weddingId,
    ]);

    expect(expenses.rowCount).toBe(1);
  });

  it('부를 이름을 적어뒀으면 그 이름으로 말한다', async () => {
    const me = await signInAs(test, 'leaving');
    const partner = await signInAs(test, 'staying');
    const weddingId = await aWedding(me.userId);

    await test.pool.query('UPDATE structured.weddings SET partner_user_id = $2 WHERE id = $1', [
      weddingId,
      partner.userId,
    ]);
    await test.pool.query('UPDATE structured.users SET display_name = $2 WHERE id = $1', [
      partner.userId,
      '준호',
    ]);

    const notice = (
      await test.app.inject({ method: 'GET', url: '/v1/me/withdrawal', headers: me.headers })
    ).json<{ lead: string }>();

    expect(notice.lead).toBe('준호님과 함께 만든 기록도 함께 사라져요');
  });

  it('후기는 사라지지 않고 작성자와 끊어진다', async () => {
    const me = await signInAs(test, 'leaving');
    const reviewId = await aReview(me.userId);

    await test.app.inject({ method: 'POST', url: '/v1/me/withdrawal', headers: me.headers });

    const { rows } = await test.pool.query<{ author_user_id: string | null; title: string }>(
      'SELECT author_user_id, title FROM structured.reviews WHERE id = $1',
      [reviewId]
    );

    expect(rows[0]).toEqual({ author_user_id: null, title: '식장이 넓었어요' });
  });

  it('완료 화면에 적을 줄을 지우기 전에 세어 돌려준다', async () => {
    const me = await signInAs(test, 'leaving');

    await aReview(me.userId);

    const result = (
      await test.app.inject({ method: 'POST', url: '/v1/me/withdrawal', headers: me.headers })
    ).json<{ done: string[] }>();

    expect(result.done).toContain('계정과 프로필을 삭제했어요');
    expect(result.done).toContain('후기와 확인된 정보는 나를 알아볼 수 없도록 분리했어요');
  });

  it('운영자는 앱에서 탈퇴할 수 없다', async () => {
    /*
     * 운영자가 내린 결정에는 그 사람이 남아 있어야 한다. 막지 않으면 마지막
     * 단계에서 알 수 없는 오류로 끝난다.
     */
    const me = await signInAs(test, 'operator');

    await test.pool.query('UPDATE structured.users SET is_operator = true WHERE id = $1', [
      me.userId,
    ]);

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/me/withdrawal',
      headers: me.headers,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { message: string } }>().error.message).toContain(
      '운영자 계정은'
    );
    expect(await userExists(me.userId)).toBe(true);
  });

  it('로그인해야 탈퇴할 수 있다', async () => {
    const response = await test.app.inject({ method: 'POST', url: '/v1/me/withdrawal' });

    expect(response.statusCode).toBe(401);
  });
});
