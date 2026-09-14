import {
  createConsultationUploadRequestSchema,
  updateConsultationRequestSchema,
} from '@weddingpick/api-contract';
import {
  VISIT_NOTE_AUDIO_CONSENT_VERSION,
  checkVisitNoteAudio,
  isVisitNoteAudioType,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { withTransaction } from '../db';
import { ApiError, notFound } from '../errors';

/**
 * 상담기록 — 녹음을 올리고, 읽어낸 것을 확인하고, 저장한다.
 *
 * **주인부터 본다.** 남의 상담기록 id를 넣어 남의 녹음을 읽게 할 수 없다.
 * 결제 증빙과 같은 방식이고, 이 화면은 그보다 더 민감하다 — 녹음에는 대화가
 * 통째로 들어 있다.
 */

const UPLOAD_URL_TTL_SECONDS = 600;

/** 원본을 늦어도 이때까지는 지운다. 처리방침 제2항에 적은 값이다. */
const AUDIO_MAX_RETENTION_HOURS = 24;

const EXTENSION: Record<string, string> = {
  'audio/wav': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/aiff': 'aiff',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
};

/**
 * 받아도 되는 크기.
 *
 * 2026-09-14 요청이 정한 100MB. **길이와 따로 본다** — 길이는 비용을 정하고
 * 크기는 저장소와 전송을 정한다. 둘 중 하나만 보면 다른 쪽으로 새는 파일이 있다.
 */
const MAX_BYTES = 100 * 1024 * 1024;

type Row = {
  id: string;
  wedding_id: string;
  vendor_id: string | null;
  vendor_label: string | null;
  status: string;
  category: string | null;
  confidence: string | null;
  common: Record<string, unknown>;
  category_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  confirmed_at: Date | null;
  audio_deleted_at: Date | null;
  created_at: Date;
};

/** `mine()`이 돌려주는 것. 원본 열쇠가 붙어 있다 — 지울 때 필요하고 화면에는 안 나간다. */
type OwnedRow = Row & { audio_key: string | null };

function toRecord(row: Row) {
  return {
    id: row.id,
    weddingId: row.wedding_id,
    vendorId: row.vendor_id,
    vendorLabel: row.vendor_label,
    status: row.status,
    category: row.category,
    confidence: row.confidence === null ? null : Number(row.confidence),
    common: row.common,
    categoryData: row.category_data,
    after: row.after_data,
    confirmedAt: row.confirmed_at?.toISOString() ?? null,
    audioDeletedAt: row.audio_deleted_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

/** 화면이 보는 칸. **`audio_key`는 여기 없다** — 내보내는 값이 아니다. */
const COLUMNS = `r.id, r.wedding_id, r.vendor_id, r.vendor_label, r.status, r.category,
  r.confidence, r.common, r.category_data, r.after_data, r.confirmed_at, r.audio_deleted_at,
  r.created_at`;

/** 고친 뒤 그대로 돌려주는 자리. 접두사 없이 쓴다. */
const RETURNING = COLUMNS.replaceAll('r.', '');

/** 이 웨딩이 그 사람 것인가. 모든 질의가 같은 조건을 쓴다. */
const OWNED = `EXISTS (
    SELECT 1 FROM structured.weddings w
     WHERE w.id = r.wedding_id AND w.owner_user_id = $2
  )`;

export function registerConsultationRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  /**
   * 내 것인지 본다. **없는 것과 남의 것을 같은 말로 답한다** — 「남의 것입니다」는
   * 그 id가 있다는 사실을 알려준다.
   */
  async function mine(userId: string, consultationId: string): Promise<OwnedRow> {
    const { rows } = await context.pool.query<OwnedRow>(
      `SELECT ${COLUMNS}, r.audio_key
         FROM structured.consultation_records r
        WHERE r.id = $1 AND ${OWNED}`,
      [consultationId, userId]
    );

    const row = rows[0];

    if (!row) throw notFound('상담기록');

    return row;
  }

  /**
   * 올릴 자리를 준다.
   *
   * **부르기 전에 막는다.** 형식·길이·크기는 보내기 전에 알 수 있고, 거절당한
   * 호출도 과금된다. 여기서 끝내면 Gemini를 한 번도 안 부른다.
   */
  app.post<{ Body: unknown }>('/v1/consultations/uploads', auth, async (request) => {
    const userId = currentUserId(request);
    const body = createConsultationUploadRequestSchema.parse(request.body);

    if (!isVisitNoteAudioType(body.mimeType)) {
      throw new ApiError('invalid_request', '이 형식의 녹음은 읽을 수 없어요.');
    }

    /*
     * **앱이 길이를 알면 여기서 먼저 걸러준다.** 두 시간짜리를 다 올리고 나서
     * 거절당하는 것보다 낫다.
     *
     * 다만 이 값은 힌트다 — 보내는 쪽이 정하는 값이라 믿지 않는다. 진짜 검사는
     * 파일이 도착한 뒤 `ffprobe`가 잰 값으로 한다(`clipForClassification`).
     */
    const rejection =
      body.seconds === undefined
        ? null
        : checkVisitNoteAudio({ mimeType: body.mimeType, seconds: body.seconds });

    if (rejection) {
      /*
       * **왜 막혔는지와 지금 값을 함께 말한다.** 「올릴 수 없어요」만 보이면
       * 사용자는 파일이 잘못된 줄 안다.
       */
      const message =
        rejection.kind === 'tooLong'
          ? `녹음이 너무 길어요. ${Math.floor(rejection.maxSeconds / 3600)}시간까지 올릴 수 있어요.`
          : rejection.kind === 'empty'
            ? '녹음 길이를 읽지 못했어요.'
            : '이 형식의 녹음은 읽을 수 없어요.';

      throw new ApiError('invalid_request', message);
    }

    if (body.byteSize > MAX_BYTES) {
      throw new ApiError(
        'invalid_request',
        `파일이 너무 커요. ${Math.floor(MAX_BYTES / 1024 / 1024)}MB까지 올릴 수 있어요.`
      );
    }

    if (body.consentVersion !== VISIT_NOTE_AUDIO_CONSENT_VERSION) {
      /*
       * **옛 동의로 올리지 못하게 한다.** 문구가 바뀌면 예전 동의는 그 새 내용에
       * 대한 동의가 아니다. 결제 증빙과 같은 규칙이다.
       */
      throw new ApiError('invalid_request', '안내 내용이 바뀌었어요. 다시 확인해주세요.');
    }

    const owns = await context.pool.query(
      'SELECT 1 FROM structured.weddings WHERE id = $1 AND owner_user_id = $2',
      [body.weddingId, userId]
    );

    if (owns.rowCount === 0) throw notFound('웨딩');

    const consultationId = randomUUID();
    const ext = EXTENSION[body.mimeType] ?? 'bin';

    // 서명 URL을 먼저 받아 스토리지 실패가 DB 줄을 남기지 않게 한다.
    const target = await context.storage.createUploadTarget({
      storageKey: `consultations/${userId}/${consultationId}.${ext}`,
      mimeType: body.mimeType,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    });

    await withTransaction(context.pool, async (client) => {
      await client.query(
        `INSERT INTO structured.consultation_records
           (id, wedding_id, created_by, vendor_id, vendor_label, status, category,
            audio_key, audio_seconds, audio_delete_by, consent_version)
         VALUES ($1, $2, $3, $4, $5, 'SUPPORTED_WEDDING_CONSULTATION', NULL,
                 $6, $7, now() + ($8 || ' hours')::interval, $9)`,
        [
          consultationId,
          body.weddingId,
          userId,
          body.vendorId ?? null,
          body.vendorLabel ?? null,
          target.storageKey,
          body.seconds === undefined ? null : Math.ceil(body.seconds),
          String(AUDIO_MAX_RETENTION_HOURS),
          body.consentVersion,
        ]
      );
    });

    return {
      consultationId,
      uploadUrl: target.uploadUrl,
      storageKey: target.storageKey,
      expiresAt: target.expiresAt.toISOString(),
    };
  });

  /**
   * 올리기가 끝났음을 알린다.
   *
   * **24시간 시계를 여기서 다시 잡는다.** 서명 URL을 받은 시각이 아니라 파일이
   * 실제로 온 시각부터 센다 — URL만 받고 안 올린 줄이 24시간 뒤에 「파기 대상」으로
   * 잡히면 지울 파일이 없는 것을 지우려 든다.
   *
   * **읽기는 아직 시작하지 않는다.** 개인정보처리방침에 Google LLC가 수탁자·국외
   * 이전 받는 자로 올라가고 시행일이 지나기 전에는 첫 호출을 내보내지 않는다
   * (개인정보보호법 제28조의8 — 고지가 이전보다 먼저다).
   */
  app.post<{ Params: { consultationId: string } }>(
    '/v1/consultations/:consultationId/complete',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const row = await mine(userId, request.params.consultationId);

      if (!row.audio_key) {
        throw new ApiError('invalid_request', '이미 정리가 끝난 기록이에요.');
      }

      const { rows } = await context.pool.query<Row>(
        `UPDATE structured.consultation_records
            SET audio_delete_by = now() + ($2 || ' hours')::interval
          WHERE id = $1
        RETURNING ${RETURNING}`,
        [row.id, String(AUDIO_MAX_RETENTION_HOURS)]
      );

      return toRecord(rows[0]!);
    }
  );

  app.get<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/consultations',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const { rows } = await context.pool.query<Row>(
        `SELECT ${COLUMNS}
           FROM structured.consultation_records r
          WHERE r.wedding_id = $1 AND ${OWNED}
          ORDER BY r.created_at DESC`,
        [request.params.weddingId, userId]
      );

      return { records: rows.map(toRecord) };
    }
  );

  app.get<{ Params: { consultationId: string } }>(
    '/v1/consultations/:consultationId',
    auth,
    async (request) =>
      toRecord(await mine(currentUserId(request), request.params.consultationId))
  );

  /**
   * 사용자가 고친다.
   *
   * **모델이 뽑은 값은 확정이 아니다.** 안 보낸 칸은 건드리지 않는다 — 한 칸만
   * 고치는 것이 보통이고, 안 보낸 칸을 지우면 사용자는 고친 적 없는 값이
   * 사라지는 것을 본다.
   */
  app.patch<{ Params: { consultationId: string }; Body: unknown }>(
    '/v1/consultations/:consultationId',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const row = await mine(userId, request.params.consultationId);
      const body = updateConsultationRequestSchema.parse(request.body ?? {});

      if (row.confirmed_at) {
        throw new ApiError('invalid_request', '이미 저장한 기록이에요.');
      }

      const { rows } = await context.pool.query<Row>(
        `UPDATE structured.consultation_records
            SET vendor_id     = COALESCE($2, vendor_id),
                vendor_label  = COALESCE($3, vendor_label),
                common        = COALESCE($4::jsonb, common),
                category_data = COALESCE($5::jsonb, category_data)
          WHERE id = $1
        RETURNING ${RETURNING}`,
        [
          row.id,
          body.vendorId ?? null,
          body.vendorLabel ?? null,
          body.common ? JSON.stringify(body.common) : null,
          body.categoryData ? JSON.stringify(body.categoryData) : null,
        ]
      );

      return toRecord(rows[0]!);
    }
  );

  /**
   * 확인을 마치고 저장한다. **여기서 원본을 지운다.**
   *
   * 지우기가 실패하면 저장도 하지 않는다 — 「저장했고 원본도 지웠다」를 반쪽만
   * 참인 채로 남기지 않는다. 다시 누르면 다시 시도한다.
   */
  app.post<{ Params: { consultationId: string } }>(
    '/v1/consultations/:consultationId/confirm',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const row = await mine(userId, request.params.consultationId);

      if (row.audio_key) {
        await context.storage.delete(row.audio_key);
      }

      const { rows } = await context.pool.query<Row>(
        `UPDATE structured.consultation_records
            SET confirmed_at     = COALESCE(confirmed_at, now()),
                audio_key        = NULL,
                audio_deleted_at = COALESCE(audio_deleted_at, now())
          WHERE id = $1
        RETURNING ${RETURNING}`,
        [row.id]
      );

      return toRecord(rows[0]!);
    }
  );

  /** 지운다. 원본이 남아 있으면 그것부터 지운다. */
  app.delete<{ Params: { consultationId: string } }>(
    '/v1/consultations/:consultationId',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const row = await mine(userId, request.params.consultationId);

      if (row.audio_key) {
        await context.storage.delete(row.audio_key);
      }

      await context.pool.query('DELETE FROM structured.consultation_records WHERE id = $1', [
        row.id,
      ]);

      return { deleted: true as const };
    }
  );
}
