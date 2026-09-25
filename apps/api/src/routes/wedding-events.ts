import {
  createConsultationEventRequestSchema,
  createWeddingEventRequestSchema,
  updateWeddingEventRequestSchema,
  type CreateConsultationEventRequest,
  type WeddingEventSource,
} from '@weddingpick/api-contract';
import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';

import { assertWeddingAccess } from '../access';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError, notFound } from '../errors';

type EventRow = {
  id: string;
  title: string;
  starts_at: Date;
  location: string | null;
  vendor_id: string | null;
  vendor_label: string | null;
  memo: string | null;
  notify_enabled: boolean;
  source: WeddingEventSource;
};

type IdempotentEventRow = {
  id: string;
  vendor_id: string | null;
  starts_at: Date;
};

function matchesConsultationRequest(row: IdempotentEventRow, body: CreateConsultationEventRequest): boolean {
  return row.vendor_id === body.vendorId && row.starts_at.getTime() === new Date(body.startsAt).getTime();
}

async function createConsultationEvent(
  context: AppContext,
  weddingId: string,
  userId: string,
  body: CreateConsultationEventRequest
): Promise<string> {
  const client = await context.pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query<IdempotentEventRow>(
      `SELECT id, vendor_id, starts_at
       FROM structured.wedding_events
       WHERE wedding_id = $1 AND idempotency_key = $2`,
      [weddingId, body.idempotencyKey]
    );
    if (existing.rows[0]) {
      if (!matchesConsultationRequest(existing.rows[0], body)) {
        throw new ApiError('conflict', '같은 요청 키로 다른 상담 일정을 등록할 수 없습니다.');
      }
      await client.query('COMMIT');
      return existing.rows[0].id;
    }

    /*
     * 2026-09-25 대표 결정(안 A) — 상담 예약은 최종 결정이 아니라 Pick(후보 담기)을 요구한다.
     * 받는 조건은 «후보에 있다» 또는 «이미 결정했다»인데, 결정은 FK `decision_is_a_pick`
     * (0041)으로 반드시 후보 줄을 가리키므로 후보 줄 하나만 보면 둘 다 덮는다.
     * 후보 줄을 FOR SHARE로 잠가, 이 INSERT가 끝나기 전에 배우자가 Pick에서 빼는(DELETE —
     * 결정도 cascade로 같이 지워진다) 경합을 막는다. 상담 등록끼리는 서로 막지 않는다.
     */
    const locked = await client.query(
      `SELECT 1
       FROM structured.vendor_candidates
       WHERE wedding_id = $1 AND vendor_id = $2
       FOR SHARE`,
      [weddingId, body.vendorId]
    );
    if (locked.rows.length === 0) {
      throw new ApiError('forbidden', 'Pick에 담은 업체만 상담 일정을 등록할 수 있습니다.');
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO structured.wedding_events
         (wedding_id, title, starts_at, location, vendor_id, vendor_label, memo, notify_enabled,
          added_by, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (wedding_id, idempotency_key) WHERE idempotency_key IS NOT NULL
       DO NOTHING
       RETURNING id`,
      [weddingId, body.title, body.startsAt, body.location ?? null, body.vendorId,
       body.vendorLabel ?? null, body.memo ?? null, body.notifyEnabled, userId, body.idempotencyKey]
    );
    if (inserted.rows[0]) {
      await client.query('COMMIT');
      return inserted.rows[0].id;
    }

    const raced = await client.query<IdempotentEventRow>(
      `SELECT id, vendor_id, starts_at
       FROM structured.wedding_events
       WHERE wedding_id = $1 AND idempotency_key = $2`,
      [weddingId, body.idempotencyKey]
    );
    const row = raced.rows[0];
    if (!row || !matchesConsultationRequest(row, body)) {
      throw new ApiError('conflict', '같은 요청 키로 다른 상담 일정을 등록할 수 없습니다.');
    }
    await client.query('COMMIT');
    return row.id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function toResponse(row: EventRow) {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at.toISOString(),
    location: row.location,
    vendorId: row.vendor_id,
    vendorLabel: row.vendor_label,
    memo: row.memo,
    notifyEnabled: row.notify_enabled,
    source: row.source,
    // 저장하지 않는다 — 지났는지는 지금 시각과 비교하면 되는 값이다.
    status: row.starts_at.getTime() <= Date.now() ? ('done' as const) : ('upcoming' as const),
  };
}

export function registerWeddingEventRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/events',
    auth,
    async (request) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rows } = await context.pool.query<EventRow>(
        `SELECT id, title, starts_at, location, vendor_id, vendor_label, memo, notify_enabled, source
         FROM structured.wedding_events
         WHERE wedding_id = $1
         ORDER BY starts_at`,
        [request.params.weddingId]
      );

      return { events: rows.map(toResponse) };
    }
  );

  app.post<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/events',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = createWeddingEventRequestSchema.parse(request.body);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const insertSql = `INSERT INTO structured.wedding_events
        (wedding_id, title, starts_at, location, vendor_id, vendor_label, memo, notify_enabled, added_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`;
      const insertValues = [
        request.params.weddingId,
        body.title,
        body.startsAt,
        body.location ?? null,
        body.vendorId ?? null,
        body.vendorLabel ?? null,
        body.memo ?? null,
        body.notifyEnabled,
        userId,
      ];

      const inserted = await context.pool.query<{ id: string }>(insertSql, insertValues);

      return reply.status(201).send({ eventId: inserted.rows[0]!.id });
    }
  );

  /**
   * 상담 시트 전용 일정 등록.
   *
   * 일반 일정의 vendorId는 단순 관련 업체라 Pick 전에도 쓸 수 있다. 상담 시트만
   * 이 별도 경로를 사용하고, 여기서만 Pick 여부를 서버 쓰기와 원자적으로 묶는다.
   * 예전에는 «최종 Pick 저장 뒤에만 상담 예약»이었는데, 2026-09-25 대표 결정(안 A)으로
   * 최종 결정 확인 시트를 지우고 Pick 후보(또는 결정한 업체)면 받는다.
   */
  app.post<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/consultation-events',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = createConsultationEventRequestSchema.parse(request.body);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const eventId = await createConsultationEvent(
        context,
        request.params.weddingId,
        userId,
        body
      );

      return reply.status(201).send({ eventId });
    }
  );

  app.patch<{ Params: { weddingId: string; eventId: string } }>(
    '/v1/weddings/:weddingId/events/:eventId',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const body = updateWeddingEventRequestSchema.parse(request.body);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      // 보낸 칸만 고친다 — wedding_tasks 패턴과 같은 이유.
      const updateSql = `UPDATE structured.wedding_events SET
        title = CASE WHEN $3 THEN $4::text ELSE title END,
        starts_at = CASE WHEN $5 THEN $6::timestamptz ELSE starts_at END,
        location = CASE WHEN $7 THEN $8::text ELSE location END,
        vendor_id = CASE WHEN $9 THEN $10::uuid ELSE vendor_id END,
        vendor_label = CASE WHEN $11 THEN $12::text ELSE vendor_label END,
        memo = CASE WHEN $13 THEN $14::text ELSE memo END,
        notify_enabled = CASE WHEN $15 THEN $16::boolean ELSE notify_enabled END
        WHERE id = $1 AND wedding_id = $2`;
      const updateValues = [
        request.params.eventId,
        request.params.weddingId,
        body.title !== undefined,
        body.title ?? null,
        body.startsAt !== undefined,
        body.startsAt ?? null,
        body.location !== undefined,
        body.location ?? null,
        body.vendorId !== undefined,
        body.vendorId ?? null,
        body.vendorLabel !== undefined,
        body.vendorLabel ?? null,
        body.memo !== undefined,
        body.memo ?? null,
        body.notifyEnabled !== undefined,
        body.notifyEnabled ?? null,
      ];

      const updated = await context.pool.query(updateSql, updateValues);

      if (updated.rowCount === 0) {
        throw notFound('일정');
      }

      return { ok: true };
    }
  );

  app.delete<{ Params: { weddingId: string; eventId: string } }>(
    '/v1/weddings/:weddingId/events/:eventId',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rowCount } = await context.pool.query(
        'DELETE FROM structured.wedding_events WHERE id = $1 AND wedding_id = $2',
        [request.params.eventId, request.params.weddingId]
      );

      if (rowCount === 0) {
        throw notFound('일정');
      }

      return reply.status(204).send();
    }
  );
}
