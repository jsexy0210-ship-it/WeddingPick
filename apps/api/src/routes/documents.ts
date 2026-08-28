import { randomUUID } from 'node:crypto';

import { createUploadRequestSchema } from '@weddingpick/api-contract';
import type { FastifyInstance } from 'fastify';

import { assertWeddingAccess } from '../access';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { withTransaction } from '../db';
import { ApiError, notFound } from '../errors';

const UPLOAD_URL_TTL_SECONDS = 15 * 60;

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

export function registerDocumentRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.post('/v1/documents/uploads', auth, async (request, reply) => {
    const userId = currentUserId(request);
    const body = createUploadRequestSchema.parse(request.body);

    await assertWeddingAccess(context.pool, body.weddingId, userId);

    const documentId = randomUUID();

    // 서명 URL을 먼저 받아 스토리지 실패가 DB 행을 남기지 않게 한다.
    const uploads = await Promise.all(
      body.pages.map(async (page, index) => {
        const target = await context.storage.createUploadTarget({
          storageKey: `${userId}/${documentId}/${index + 1}.${EXTENSION[page.mimeType]}`,
          mimeType: page.mimeType,
          expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
        });

        return { pageIndex: index, ...target };
      })
    );

    await withTransaction(context.pool, async (client) => {
      await client.query(
        'INSERT INTO originals.raw_documents (id, owner_user_id, page_count) VALUES ($1, $2, $3)',
        [documentId, userId, body.pages.length]
      );

      for (const [index, upload] of uploads.entries()) {
        await client.query(
          `INSERT INTO originals.raw_document_pages
             (raw_document_id, page_index, storage_key, mime_type)
           VALUES ($1, $2, $3, $4)`,
          [documentId, index, upload.storageKey, body.pages[index]!.mimeType]
        );
      }
    });

    return reply.status(201).send({
      rawDocumentId: documentId,
      uploads: uploads.map((upload) => ({
        pageIndex: upload.pageIndex,
        uploadUrl: upload.uploadUrl,
        storageKey: upload.storageKey,
        expiresAt: upload.expiresAt.toISOString(),
      })),
    });
  });

  app.post<{ Params: { rawDocumentId: string }; Body: { weddingId?: string } }>(
    '/v1/documents/:rawDocumentId/complete',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const { rawDocumentId } = request.params;

      const { rows } = await context.pool.query<{ owner_user_id: string }>(
        'SELECT owner_user_id FROM originals.raw_documents WHERE id = $1',
        [rawDocumentId]
      );

      const document = rows[0];

      if (!document) {
        throw notFound('문서');
      }

      if (document.owner_user_id !== userId) {
        throw new ApiError('forbidden', '접근 권한이 없습니다.');
      }

      const weddingId = request.body?.weddingId;

      if (!weddingId) {
        throw new ApiError('invalid_request', 'weddingId가 필요합니다.');
      }

      await assertWeddingAccess(context.pool, weddingId, userId);

      const analysisId = await withTransaction(context.pool, async (client) => {
        // 같은 문서로 두 번 눌러도 분석은 하나만 돈다. AI 호출은 비용이다.
        const existing = await client.query<{ id: string }>(
          'SELECT id FROM structured.analyses WHERE raw_document_id = $1',
          [rawDocumentId]
        );

        if (existing.rows[0]) {
          return existing.rows[0].id;
        }

        await client.query(
          `UPDATE originals.raw_documents SET status = 'analyzed' WHERE id = $1`,
          [rawDocumentId]
        );

        const created = await client.query<{ id: string }>(
          `INSERT INTO structured.analyses (raw_document_id, wedding_id) VALUES ($1, $2)
           RETURNING id`,
          [rawDocumentId, weddingId]
        );

        return created.rows[0]!.id;
      });

      return reply.status(202).send({ rawDocumentId, analysisId });
    }
  );
}
