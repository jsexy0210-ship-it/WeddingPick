import type { Pool } from 'pg';
import { z } from 'zod';

import { wasRecentlyDeleted } from './retention/expo-sweep';

const confidenceSchema = z.enum([
  'OFFICIAL_CONFIRMED',
  'CROSS_CONFIRMED',
  'SOCIAL_ONLY',
  'CONFLICT',
]);

const statusSchema = z.enum(['UPCOMING', 'ONGOING', 'CANCELLED', 'POSTPONED']);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const expoCandidateSchema = z.object({
  eventName: z.string(),
  canonicalEventName: z.string(),
  aliases: z.array(z.string()),
  organizer: z.string(),
  host: z.string().nullable(),
  startDate: dateSchema,
  endDate: dateSchema,
  openingHours: z.string().nullable(),
  province: z.string(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  venueName: z.string(),
  address: z.string(),
  eventCategories: z.array(z.string()),
  admissionFee: z.string().nullable(),
  reservationRequired: z.boolean().nullable(),
  reservationUrl: z.string().url().nullable(),
  benefitsSummary: z.array(z.string()),
  description: z.string(),
  officialWebsiteUrl: z.string().url().nullable(),
  officialSnsUrls: z.array(z.string().url()),
  discoveryUrls: z.array(z.string().url()),
  verificationUrls: z.array(z.string().url()),
  status: statusSchema,
  confidence: confidenceSchema,
  confidenceScore: z.number().int().min(0).max(100),
  adminReviewRequired: z.boolean(),
  reviewReason: z.array(z.string()),
  sourceNote: z.string(),
  thumbnailCandidateUrl: z.string().url().nullable(),
  thumbnailSourceUrl: z.string().url().nullable(),
});

export type ExpoCandidate = z.infer<typeof expoCandidateSchema>;
export type ExpoCollectionTrigger = 'scheduled' | 'manual';
export type ExpoDiscoverer = () => Promise<ExpoCandidate[]>;

export type ExpoCollectionResult = {
  runId: string | null;
  skipped: boolean;
  discovered: number;
  created: number;
  updated: number;
  duplicates: number;
  reviewRequired: number;
};

export type ExpoCollectionRun = {
  id: string;
  trigger: ExpoCollectionTrigger;
  status: 'running' | 'success' | 'failed' | 'skipped';
  model: string;
  startedAt: string;
  finishedAt: string | null;
  discovered: number;
  created: number;
  updated: number;
  duplicates: number;
  reviewRequired: number;
  errorMessage: string | null;
};

/*
 * **Gemini 기반 검색 수집기(`createGeminiExpoDiscoverer`)를 없앴다**(2026-09-23
 * 대표 지시 — 「제미나이 api는 사진·이미지 분석 및 정보 추출, 녹음 파일 정보 추출,
 * 관리자 피드 자동생성 말고는 절대 사용 금지한다」). 이 함수는 Google Search로
 * 웹을 검색해 박람회 후보를 짓는 자리였다 — 이미지도 녹음도 피드 생성도 아니라
 * 허용 범위 밖이다. `apps/api/src/analysis/gemini-scope.test.ts`가 이 파일에
 * `callGemini`가 다시 들어오는 것을 막는다.
 *
 * 아래 `ExpoDiscoverer`(들어온 후보 배열을 돌려주는 함수 하나)·`runExpoCollection`은
 * 출처를 가리지 않는 그대로 남긴다 — 공공데이터(예: 한국관광공사 TourAPI) 기반
 * 수집기로 교체할 자리다. 그전까지 자동 수집은 꺼진다(`worker-loops.ts`).
 */

function todayInSeoul(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function clean(value: string | null | undefined): string | null {
  const next = value?.trim() ?? '';
  return next || null;
}

function httpsOnly(value: string | null | undefined): string | null {
  const next = clean(value);
  if (!next) return null;
  try {
    const parsed = new URL(next);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function uniqueHttps(values: string[]): string[] {
  return [...new Set(values.map(httpsOnly).filter((value): value is string => Boolean(value)))];
}

function addReason(reasons: string[], reason: string): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function publicable(candidate: ExpoCandidate, verificationUrls: string[], reviewReasons: string[]): boolean {
  if (!candidate.organizer.trim()) addReason(reviewReasons, '주최사를 확인할 수 없음');
  if (!candidate.venueName.trim()) addReason(reviewReasons, '장소를 확인할 수 없음');
  if (verificationUrls.length === 0) addReason(reviewReasons, '공식 또는 교차 검증 출처 없음');
  if (candidate.confidenceScore < 70) addReason(reviewReasons, '신뢰도 70점 미만');
  if (candidate.confidence === 'SOCIAL_ONLY') addReason(reviewReasons, 'SNS 한 곳에서만 확인');
  if (candidate.confidence === 'CONFLICT') addReason(reviewReasons, '출처 정보 충돌');

  return (
    reviewReasons.length === 0 &&
    !candidate.adminReviewRequired &&
    candidate.confidenceScore >= 70 &&
    verificationUrls.length > 0 &&
    Boolean(candidate.organizer.trim()) &&
    Boolean(candidate.venueName.trim())
  );
}

async function latestRecentScheduledSuccess(pool: Pool): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM structured.expo_collection_runs
       WHERE trigger = 'scheduled' AND status = 'success'
         AND started_at >= now() - interval '20 hours'
     ) AS exists`
  );
  return Boolean(rows[0]?.exists);
}

export async function getLatestExpoCollectionRun(pool: Pool): Promise<ExpoCollectionRun | null> {
  const { rows } = await pool.query<{
    id: string;
    trigger: ExpoCollectionTrigger;
    status: ExpoCollectionRun['status'];
    model: string;
    started_at: Date;
    finished_at: Date | null;
    discovered_count: number;
    created_count: number;
    updated_count: number;
    duplicate_count: number;
    review_required_count: number;
    error_message: string | null;
  }>(
    `SELECT id, trigger, status, model, started_at, finished_at,
            discovered_count, created_count, updated_count, duplicate_count,
            review_required_count, error_message
     FROM structured.expo_collection_runs
     ORDER BY started_at DESC
     LIMIT 1`
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    trigger: row.trigger,
    status: row.status,
    model: row.model,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
    discovered: row.discovered_count,
    created: row.created_count,
    updated: row.updated_count,
    duplicates: row.duplicate_count,
    reviewRequired: row.review_required_count,
    errorMessage: row.error_message,
  };
}

async function recordChange(
  pool: Pool,
  input: { eventId: string; type: string; before: string | null; after: string | null; sourceUrl: string | null }
): Promise<void> {
  if (input.before === input.after) return;
  await pool.query(
    `INSERT INTO structured.expo_change_log
       (event_id, change_type, before_value, after_value, source_url)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.eventId, input.type, input.before, input.after, input.sourceUrl]
  );
}

async function processCandidate(pool: Pool, candidate: ExpoCandidate, today: string): Promise<'created' | 'updated' | 'duplicate'> {
  if (!candidate.eventName.trim() || !candidate.startDate || !candidate.endDate || !candidate.venueName.trim() || !candidate.province.trim()) {
    return 'duplicate';
  }
  if (candidate.endDate < today || candidate.endDate < candidate.startDate) return 'duplicate';

  if (
    await wasRecentlyDeleted(pool, {
      eventName: candidate.eventName.trim(),
      startDate: candidate.startDate,
      venue: candidate.venueName.trim(),
    })
  ) {
    return 'duplicate';
  }

  const reservationUrl = httpsOnly(candidate.reservationUrl);
  const officialWebsiteUrl = httpsOnly(candidate.officialWebsiteUrl);
  const verificationUrls = uniqueHttps(candidate.verificationUrls);
  const discoveryUrls = uniqueHttps(candidate.discoveryUrls);
  const officialSnsUrls = uniqueHttps(candidate.officialSnsUrls);
  const thumbnailCandidateUrl = httpsOnly(candidate.thumbnailCandidateUrl);
  const thumbnailSourceUrl = httpsOnly(candidate.thumbnailSourceUrl);

  const { rows: existingRows } = await pool.query<{
    id: string;
    starts_at: Date;
    ends_at: Date;
    venue: string;
    reservation_url: string | null;
    official_website_url: string | null;
    benefits: unknown;
  }>(
    `SELECT id, starts_at, ends_at, venue, reservation_url, official_website_url, benefits
     FROM structured.expos
     WHERE ($6::text IS NOT NULL AND reservation_url = $6)
        OR ($7::text IS NOT NULL AND official_website_url = $7)
        OR (
          starts_at = $1::date AND ends_at = $2::date AND lower(venue) = lower($3)
          AND (lower(organizer) = lower($4) OR lower(title) = lower($5))
        )
     ORDER BY updated_at DESC
     LIMIT 1`,
    [
      candidate.startDate,
      candidate.endDate,
      candidate.venueName.trim(),
      candidate.organizer.trim(),
      candidate.eventName.trim(),
      reservationUrl,
      officialWebsiteUrl,
    ]
  );

  const existing = existingRows[0];
  const { rows: duplicateRows } = await pool.query<{ id: string }>(
    `SELECT id FROM structured.expos
     WHERE starts_at = $1::date AND ends_at = $2::date AND lower(venue) = lower($3)
       AND ($4::uuid IS NULL OR id <> $4::uuid)
     ORDER BY starts_at ASC
     LIMIT 10`,
    [candidate.startDate, candidate.endDate, candidate.venueName.trim(), existing?.id ?? null]
  );
  const duplicateIds = duplicateRows.map((row) => row.id);

  const reviewReasons = [...candidate.reviewReason.map((reason) => reason.trim()).filter(Boolean)];
  if (duplicateIds.length > 0) addReason(reviewReasons, '기존 행사와 중복 가능성이 높음');
  const canPublish = publicable(candidate, verificationUrls, reviewReasons);
  const adminReviewRequired = !canPublish || duplicateIds.length > 0;
  const manualStatus = candidate.status === 'CANCELLED' || candidate.status === 'POSTPONED' ? candidate.status : null;
  const sourceUrl = verificationUrls[0] ?? officialWebsiteUrl ?? discoveryUrls[0] ?? null;

  if (existing) {
    const beforeStart = existing.starts_at.toISOString().slice(0, 10);
    const beforeEnd = existing.ends_at.toISOString().slice(0, 10);
    const beforeBenefits = JSON.stringify(Array.isArray(existing.benefits) ? existing.benefits : []);
    const afterBenefits = JSON.stringify(candidate.benefitsSummary);

    await pool.query(
      `UPDATE structured.expos SET
         title = $2,
         canonical_event_name = $3,
         aliases = $4::jsonb,
         organizer = $5,
         host = $6,
         starts_at = $7::date,
         ends_at = $8::date,
         opening_hours = $9,
         region = $10,
         city = $11,
         district = $12,
         venue = $13,
         address = $14,
         event_categories = $15::jsonb,
         admission_fee = $16,
         reservation_required = $17,
         reservation_url = COALESCE($18, reservation_url),
         benefits = $19::jsonb,
         description = $20,
         official_website_url = COALESCE($21, official_website_url),
         official_sns_urls = $22::jsonb,
         discovery_urls = $23::jsonb,
         verification_urls = $24::jsonb,
         confidence = $25,
         confidence_score = $26,
         duplicate_candidate_ids = $27::jsonb,
         admin_review_required = $28,
         review_reason = $29::jsonb,
         manual_status = $30,
         source_note = $31,
         thumbnail_candidate_url = COALESCE($32, thumbnail_candidate_url),
         thumbnail_source_url = COALESCE($33, thumbnail_source_url),
         last_verified_at = now(),
         updated_at = now()
       WHERE id = $1`,
      [
        existing.id,
        candidate.eventName.trim(),
        candidate.canonicalEventName.trim() || candidate.eventName.trim(),
        JSON.stringify(candidate.aliases),
        candidate.organizer.trim(),
        clean(candidate.host),
        candidate.startDate,
        candidate.endDate,
        clean(candidate.openingHours),
        candidate.province.trim(),
        clean(candidate.city),
        clean(candidate.district),
        candidate.venueName.trim(),
        candidate.address.trim(),
        JSON.stringify(candidate.eventCategories),
        clean(candidate.admissionFee),
        candidate.reservationRequired,
        reservationUrl,
        JSON.stringify(candidate.benefitsSummary),
        candidate.description.trim(),
        officialWebsiteUrl,
        JSON.stringify(officialSnsUrls),
        JSON.stringify(discoveryUrls),
        JSON.stringify(verificationUrls),
        candidate.confidence,
        candidate.confidenceScore,
        JSON.stringify(duplicateIds),
        adminReviewRequired,
        JSON.stringify(reviewReasons),
        manualStatus,
        candidate.sourceNote.trim() || '자동 수집',
        thumbnailCandidateUrl,
        thumbnailSourceUrl,
      ]
    );

    await recordChange(pool, { eventId: existing.id, type: 'DATE_CHANGED', before: `${beforeStart}~${beforeEnd}`, after: `${candidate.startDate}~${candidate.endDate}`, sourceUrl });
    await recordChange(pool, { eventId: existing.id, type: 'VENUE_CHANGED', before: existing.venue, after: candidate.venueName.trim(), sourceUrl });
    await recordChange(pool, { eventId: existing.id, type: 'URL_CHANGED', before: existing.reservation_url ?? existing.official_website_url, after: reservationUrl ?? officialWebsiteUrl, sourceUrl });
    await recordChange(pool, { eventId: existing.id, type: 'BENEFIT_CHANGED', before: beforeBenefits, after: afterBenefits, sourceUrl });
    return 'updated';
  }

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO structured.expos
       (title, canonical_event_name, aliases, organizer, host, starts_at, ends_at, opening_hours,
        region, city, district, venue, address, event_categories, admission_fee, reservation_required,
        reservation_url, benefits, description, official_website_url, official_sns_urls,
        discovery_urls, verification_urls, confidence, confidence_score, duplicate_candidate_ids,
        admin_review_required, review_reason, manual_status, source_note,
        thumbnail_candidate_url, thumbnail_source_url, last_verified_at)
     VALUES
       ($1, $2, $3::jsonb, $4, $5, $6::date, $7::date, $8,
        $9, $10, $11, $12, $13, $14::jsonb, $15, $16,
        $17, $18::jsonb, $19, $20, $21::jsonb,
        $22::jsonb, $23::jsonb, $24, $25, $26::jsonb,
        $27, $28::jsonb, $29, $30, $31, $32, now())
     RETURNING id`,
    [
      candidate.eventName.trim(),
      candidate.canonicalEventName.trim() || candidate.eventName.trim(),
      JSON.stringify(candidate.aliases),
      candidate.organizer.trim(),
      clean(candidate.host),
      candidate.startDate,
      candidate.endDate,
      clean(candidate.openingHours),
      candidate.province.trim(),
      clean(candidate.city),
      clean(candidate.district),
      candidate.venueName.trim(),
      candidate.address.trim(),
      JSON.stringify(candidate.eventCategories),
      clean(candidate.admissionFee),
      candidate.reservationRequired,
      reservationUrl,
      JSON.stringify(candidate.benefitsSummary),
      candidate.description.trim(),
      officialWebsiteUrl,
      JSON.stringify(officialSnsUrls),
      JSON.stringify(discoveryUrls),
      JSON.stringify(verificationUrls),
      candidate.confidence,
      candidate.confidenceScore,
      JSON.stringify(duplicateIds),
      adminReviewRequired,
      JSON.stringify(reviewReasons),
      manualStatus,
      candidate.sourceNote.trim() || '자동 수집',
      thumbnailCandidateUrl,
      thumbnailSourceUrl,
    ]
  );

  if (!rows[0]) return 'duplicate';
  return 'created';
}

export async function runExpoCollection(input: {
  pool: Pool;
  discover: ExpoDiscoverer;
  model: string;
  trigger: ExpoCollectionTrigger;
}): Promise<ExpoCollectionResult> {
  const lockClient = await input.pool.connect();
  let locked = false;
  let runId: string | null = null;

  try {
    const lock = await lockClient.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_lock(hashtext('weddingpick:expo-collection')) AS locked`
    );
    locked = Boolean(lock.rows[0]?.locked);

    if (!locked || (input.trigger === 'scheduled' && (await latestRecentScheduledSuccess(input.pool)))) {
      const { rows } = await input.pool.query<{ id: string }>(
        `INSERT INTO structured.expo_collection_runs
           (trigger, status, model, finished_at)
         VALUES ($1, 'skipped', $2, now())
         RETURNING id`,
        [input.trigger, input.model]
      );
      return { runId: rows[0]?.id ?? null, skipped: true, discovered: 0, created: 0, updated: 0, duplicates: 0, reviewRequired: 0 };
    }

    const { rows: runRows } = await input.pool.query<{ id: string }>(
      `INSERT INTO structured.expo_collection_runs (trigger, status, model)
       VALUES ($1, 'running', $2)
       RETURNING id`,
      [input.trigger, input.model]
    );
    runId = runRows[0]?.id ?? null;

    const candidates = await input.discover();
    const today = todayInSeoul();
    let created = 0;
    let updated = 0;
    let duplicates = 0;

    for (const candidate of candidates) {
      const result = await processCandidate(input.pool, candidate, today);
      if (result === 'created') created += 1;
      else if (result === 'updated') updated += 1;
      else duplicates += 1;
    }

    const { rows: reviewRows } = await input.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM structured.expos WHERE admin_review_required`
    );
    const reviewRequired = Number(reviewRows[0]?.count ?? 0);

    if (runId) {
      await input.pool.query(
        `UPDATE structured.expo_collection_runs SET
           status = 'success', finished_at = now(), discovered_count = $2,
           created_count = $3, updated_count = $4, duplicate_count = $5,
           review_required_count = $6
         WHERE id = $1`,
        [runId, candidates.length, created, updated, duplicates, reviewRequired]
      );
    }

    return { runId, skipped: false, discovered: candidates.length, created, updated, duplicates, reviewRequired };
  } catch (error) {
    if (runId) {
      await input.pool.query(
        `UPDATE structured.expo_collection_runs SET status = 'failed', finished_at = now(), error_message = $2 WHERE id = $1`,
        [runId, error instanceof Error ? error.message.slice(0, 500) : '알 수 없는 오류']
      );
    }
    throw error;
  } finally {
    if (locked) {
      await lockClient.query(`SELECT pg_advisory_unlock(hashtext('weddingpick:expo-collection'))`);
    }
    lockClient.release();
  }
}
