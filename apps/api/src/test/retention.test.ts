import {
  listFailedDeletions,
  listRetentionAttention,
  markUnreachableForReview,
  sweepExpiredDocuments,
} from '../retention/worker';
import type { LocalStorage } from '../storage/local';
import type { Storage } from '../storage/port';
import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 원본 하나.
 *
 * 파기 예정일은 이제 저장하지 않고 계산한다(0018) — 검증이 끝난 날로부터 센다.
 * 그래서 만료 시각을 직접 넣는 대신 업로드 시각을 옮긴다. 아무 일도 없는
 * 문서에서는 업로드가 기준이 되므로, 30일보다 오래되면 파기 대상이다.
 */
async function seedDocument(
  uploadedAt: string | 'expired' | 'fresh',
  keys = ['a.jpg', 'b.jpg']
) {
  const user = await test.pool.query<{ id: string }>(
    'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
  );

  const uploaded =
    uploadedAt === 'expired'
      ? new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
      : uploadedAt === 'fresh'
        ? new Date()
        : new Date(uploadedAt);

  const document = await test.pool.query<{ id: string }>(
    `INSERT INTO originals.raw_documents (owner_user_id, page_count, uploaded_at)
     VALUES ($1, $2, $3) RETURNING id`,
    [user.rows[0]!.id, keys.length, uploaded]
  );

  const documentId = document.rows[0]!.id;
  const storage = test.context.storage as LocalStorage;

  for (const [index, key] of keys.entries()) {
    const storageKey = `${documentId}/${key}`;
    storage.put(storageKey, Buffer.from('원본'));

    await test.pool.query(
      `INSERT INTO originals.raw_document_pages
         (raw_document_id, page_index, storage_key, mime_type)
       VALUES ($1, $2, $3, 'image/jpeg')`,
      [documentId, index, storageKey]
    );
  }

  return { documentId, userId: user.rows[0]!.id };
}

async function documentStatus(documentId: string) {
  const { rows } = await test.pool.query<{
    status: string;
    deleted_at: Date | null;
    delete_attempts: number;
  }>('SELECT status, deleted_at, delete_attempts FROM originals.raw_documents WHERE id = $1', [
    documentId,
  ]);

  return rows[0]!;
}

describeWithDb('원본 자동삭제', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('보관 기간이 지난 원본의 파일을 지우고 기록을 남긴다', async () => {
    const { documentId } = await seedDocument('expired');

    const result = await sweepExpiredDocuments({
      pool: test.pool,
      storage: test.context.storage,
    });

    expect(result).toEqual({ deleted: 1, failed: 0 });

    // 파일은 지우되 문서 행은 남긴다 — 언제 무엇을 지웠는지가 파기 기록이다.
    const status = await documentStatus(documentId);
    expect(status.status).toBe('deleted');
    expect(status.deleted_at).not.toBeNull();

    await expect(test.context.storage.download(`${documentId}/a.jpg`)).rejects.toThrow();
  });

  it('없는 파일을 가리키는 키는 남기지 않는다', async () => {
    const { documentId } = await seedDocument('expired');

    await sweepExpiredDocuments({ pool: test.pool, storage: test.context.storage });

    const { rows } = await test.pool.query(
      'SELECT 1 FROM originals.raw_document_pages WHERE raw_document_id = $1',
      [documentId]
    );
    expect(rows).toHaveLength(0);
  });

  it('구조화 데이터는 남고 연결만 끊긴다', async () => {
    const { documentId, userId } = await seedDocument('expired');

    const wedding = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
      [userId]
    );
    await test.pool.query(
      `INSERT INTO structured.quotes (wedding_id, raw_document_id, doc_type, source)
       VALUES ($1, $2, 'contract', 'ai_extraction')`,
      [wedding.rows[0]!.id, documentId]
    );

    await sweepExpiredDocuments({ pool: test.pool, storage: test.context.storage });

    // 사업계획서 28번: 핵심 자산은 원본이 아니라 구조화된 데이터다.
    const { rows } = await test.pool.query('SELECT 1 FROM structured.quotes');
    expect(rows).toHaveLength(1);
  });

  it('보관 기간이 남은 원본은 건드리지 않는다', async () => {
    const future = await seedDocument('fresh');

    const result = await sweepExpiredDocuments({
      pool: test.pool,
      storage: test.context.storage,
    });

    expect(result.deleted).toBe(0);
    expect((await documentStatus(future.documentId)).status).toBe('uploaded');
  });

  it('삭제가 실패하면 조용히 넘어가지 않고 표시로 남긴다', async () => {
    const { documentId } = await seedDocument('expired');

    const brokenStorage: Storage = {
      ...test.context.storage,
      delete: async () => {
        throw new Error('스토리지 장애');
      },
    };

    const result = await sweepExpiredDocuments({ pool: test.pool, storage: brokenStorage });

    expect(result).toEqual({ deleted: 0, failed: 1 });

    // 서비스정책서 4번: 자동삭제 실패는 사람이 처리한다.
    const status = await documentStatus(documentId);
    expect(status.status).toBe('delete_failed');
    expect(status.delete_attempts).toBe(1);
    expect(await listFailedDeletions(test.pool)).toEqual([{ id: documentId, attempts: 1 }]);
  });

  it('실패한 문서는 다음 차례에 다시 시도한다', async () => {
    const { documentId } = await seedDocument('expired');

    const brokenStorage: Storage = {
      ...test.context.storage,
      delete: async () => {
        throw new Error('스토리지 장애');
      },
    };

    await sweepExpiredDocuments({ pool: test.pool, storage: brokenStorage });
    const second = await sweepExpiredDocuments({ pool: test.pool, storage: test.context.storage });

    expect(second.deleted).toBe(1);
    expect((await documentStatus(documentId)).status).toBe('deleted');
  });
});

/**
 * 서비스정책서 4번: 자동삭제 실패에는 알림과 수동 처리가 따라야 한다.
 *
 * 여기서 지키는 것은 "조용히 남지 않는다"이다. 개인정보가 보관 기간을 넘겨
 * 남아 있는데 아무도 모르는 상태가 가장 나쁘다.
 */
describeWithDb('보관 점검', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  /** 페이지 기록이 없는 문서. 삭제 작업이 집어가지 못한다. */
  async function seedPagelessDocument(uploadedAt: 'expired' | 'fresh') {
    const user = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );

    const uploaded =
      uploadedAt === 'expired'
        ? new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
        : new Date();

    const document = await test.pool.query<{ id: string }>(
      `INSERT INTO originals.raw_documents
         (owner_user_id, page_count, uploaded_at, personal_info_kinds)
       VALUES ($1, 1, $2, ARRAY['resident_number']) RETURNING id`,
      [user.rows[0]!.id, uploaded]
    );

    return document.rows[0]!.id;
  }

  it('페이지 기록이 없으면 삭제 작업이 집어가지 못한다', async () => {
    await seedPagelessDocument('expired');

    const { rows } = await test.pool.query('SELECT 1 FROM originals.expired_documents');

    // 정규 삭제 목록에는 없다 — 이게 조용히 남는 이유다.
    expect(rows).toHaveLength(0);
  });

  it('집어가지 못하는 문서도 점검 목록에는 올라온다', async () => {
    const documentId = await seedPagelessDocument('expired');

    const attention = await listRetentionAttention(test.pool);

    expect(attention).toHaveLength(1);
    expect(attention[0]!.id).toBe(documentId);
    expect(attention[0]!.reason).toBe('unreachable');
    // 무엇이 남아 있는지 알아야 얼마나 급한지 판단할 수 있다.
    expect(attention[0]!.personalInfoKinds).toEqual(['resident_number']);
  });

  it('삭제에 실패한 문서도 같은 목록에 올라온다', async () => {
    const { documentId } = await seedDocument('expired');

    await test.pool.query(
      `UPDATE originals.raw_documents SET status = 'delete_failed', delete_attempts = 3
       WHERE id = $1`,
      [documentId]
    );

    const attention = await listRetentionAttention(test.pool);

    expect(attention).toEqual([
      expect.objectContaining({ id: documentId, reason: 'delete_failed', attempts: 3 }),
    ]);
  });

  it('보관 기간이 남은 문서는 점검 목록에 오지 않는다', async () => {
    await seedPagelessDocument('fresh');

    expect(await listRetentionAttention(test.pool)).toHaveLength(0);
  });

  it('처리 목록에 올려도 한 문서는 한 줄로만 센다', async () => {
    await seedPagelessDocument('expired');

    expect(await markUnreachableForReview(test.pool)).toBe(1);

    const attention = await listRetentionAttention(test.pool);

    // status는 delete_failed가 됐지만 페이지는 여전히 없다. 두 조건에 모두
    // 걸리더라도 문서는 하나다 — 건수가 부풀면 운영자가 문서 수를 셀 수 없다.
    expect(attention).toHaveLength(1);
    // 무엇을 해야 하는지를 결정하는 쪽이 남는다: 지울 키를 우리가 모른다.
    expect(attention[0]!.reason).toBe('unreachable');
  });

  it('이미 올라간 것을 다시 올리지 않는다', async () => {
    await seedPagelessDocument('expired');

    expect(await markUnreachableForReview(test.pool)).toBe(1);
    // 두 번째는 아무것도 하지 않았다고 말해야 한다. 안 그러면 매번 새 문제가
    // 생긴 것처럼 보인다.
    expect(await markUnreachableForReview(test.pool)).toBe(0);
  });

  it('처리 목록에 올리는 것은 무엇도 지우지 않는다', async () => {
    const documentId = await seedPagelessDocument('expired');

    await markUnreachableForReview(test.pool);

    const { rows } = await test.pool.query<{ deleted_at: Date | null }>(
      'SELECT deleted_at FROM originals.raw_documents WHERE id = $1',
      [documentId]
    );

    // 파일을 확인하지 않고 "지웠다"고 적으면 파기 기록이 거짓이 된다.
    expect(rows[0]!.deleted_at).toBeNull();
  });
});
