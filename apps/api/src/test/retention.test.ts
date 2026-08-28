import { listFailedDeletions, sweepExpiredDocuments } from '../retention/worker';
import type { LocalStorage } from '../storage/local';
import type { Storage } from '../storage/port';
import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/** 만료 시각을 직접 지정해 원본 하나를 만든다. */
async function seedDocument(retentionUntil: string | null, keys = ['a.jpg', 'b.jpg']) {
  const user = await test.pool.query<{ id: string }>(
    'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
  );

  const document = await test.pool.query<{ id: string }>(
    `INSERT INTO originals.raw_documents (owner_user_id, page_count, retention_until)
     VALUES ($1, $2, $3) RETURNING id`,
    [user.rows[0]!.id, keys.length, retentionUntil]
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
    const { documentId } = await seedDocument('2020-01-01T00:00:00Z');

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
    const { documentId } = await seedDocument('2020-01-01T00:00:00Z');

    await sweepExpiredDocuments({ pool: test.pool, storage: test.context.storage });

    const { rows } = await test.pool.query(
      'SELECT 1 FROM originals.raw_document_pages WHERE raw_document_id = $1',
      [documentId]
    );
    expect(rows).toHaveLength(0);
  });

  it('구조화 데이터는 남고 연결만 끊긴다', async () => {
    const { documentId, userId } = await seedDocument('2020-01-01T00:00:00Z');

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

  it('보관 기간이 남았거나 정해지지 않은 원본은 건드리지 않는다', async () => {
    const future = await seedDocument('2099-01-01T00:00:00Z');
    const undecided = await seedDocument(null);

    const result = await sweepExpiredDocuments({
      pool: test.pool,
      storage: test.context.storage,
    });

    expect(result.deleted).toBe(0);
    expect((await documentStatus(future.documentId)).status).toBe('uploaded');
    // 보관 기간이 확정되기 전에 올라온 문서를 임의로 지우지 않는다.
    expect((await documentStatus(undecided.documentId)).status).toBe('uploaded');
  });

  it('삭제가 실패하면 조용히 넘어가지 않고 표시로 남긴다', async () => {
    const { documentId } = await seedDocument('2020-01-01T00:00:00Z');

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
    const { documentId } = await seedDocument('2020-01-01T00:00:00Z');

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
