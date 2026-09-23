import type { Pool } from 'pg';
import { z } from 'zod';

import { callGemini } from './analysis/gemini-call';
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

function discoverySchemaMax(max: number) {
  return z.object({ candidates: z.array(expoCandidateSchema).max(max) });
}

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

const BASE_PROMPT = `너는 WeddingPick의 대한민국 웨딩박람회 수집기다.

반드시 Google Search로 최신 공개 정보를 찾고, SNS 게시물 하나만 보고 사실을 확정하지 않는다.
공식 홈페이지·주최사 공식 페이지·행사장 공식 일정·공식 신청 페이지를 우선 검증한다.
이미 종료된 행사는 후보에 넣지 않는다. 날짜·장소·주최사·공식 URL이 충돌하면 adminReviewRequired를 true로 둔다.
확인되지 않은 값은 지어내지 않는다. 홍보문구를 복사하지 말고 사실만 짧게 요약한다.
이미지는 무단 복제하지 않는다. 공식 페이지에서 대표 이미지 URL을 확인할 수 있어도 thumbnailCandidateUrl로만 제안하고,
실제 공개용 thumbnailUrl은 운영자가 권리 상태를 확인한 뒤 별도로 정한다.`;

/*
 * 지역별 우선순위(2026-09-23 대표 지시 「서울 및 경기가 가장 중요하다. 비중을
 * 가장 높이도록」). 한 프롬프트에 17개 도를 동일 가중치로 나열하면 서울·경기가
 * 다른 15개와 똑같은 한 줄일 뿐이다 — Gemini 호출을 둘로 쪼개 서울·경기 전용
 * 예산(PRIORITY_MAX)을 따로 확보한다. `ExpoDiscoverer`의 바깥 모양(후보 배열
 * 하나)은 그대로라 `runExpoCollection`은 손대지 않는다.
 */
const PRIORITY_REGIONS = ['서울', '경기'];
const REST_REGIONS = ['인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const PRIORITY_MAX = 24;
const REST_MAX = 20;

function regionPrompt(regions: string[]): string {
  return `${BASE_PROMPT}\n\n검색은 ${regions.join('·')}을 대상으로 각 지역 + 웨딩박람회 / 웨딩페어 / 결혼박람회 / 웨딩홀 박람회 / 스드메 박람회 패턴을 반복한다.`;
}

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

async function discoverRegion(
  options: { apiKey: string; model: string },
  regions: string[],
  max: number
): Promise<ExpoCandidate[]> {
  const today = todayInSeoul();
  const { value } = await callGemini({
    apiKey: options.apiKey,
    model: options.model,
    systemPrompt: regionPrompt(regions),
    schema: discoverySchemaMax(max),
    tools: { googleSearch: true, urlContext: true },
    parts: [
      {
        text:
          `기준일은 ${today}(Asia/Seoul)이다. 오늘 이후 진행 중이거나 예정된 대한민국 웨딩박람회를 최대 ${max}건 찾는다.\n` +
          '각 후보는 반드시 구조화 스키마를 채우고, verificationUrls에는 사실 확인에 쓴 출처를 넣는다. ' +
          '공식 출처를 확인하지 못하면 confidence를 SOCIAL_ONLY 또는 CONFLICT로 두고 검수 사유를 적는다.',
      },
    ],
  });

  return value.candidates;
}

export function createGeminiExpoDiscoverer(options: { apiKey: string; model: string }): ExpoDiscoverer {
  if (!options.apiKey) throw new Error('GEMINI_API_KEY가 없다. 박람회 자동 수집을 부를 수 없다.');

  return async () => {
    /*
     * 서울·경기를 먼저, 별도 예산(PRIORITY_MAX)으로 부른다. 순서대로(Promise.all이
     * 아니라) 부르는 이유는 없다 — 두 호출은 서로 무관하니 병렬로 묶어 왕복 시간을 줄인다.
     */
    const [priority, rest] = await Promise.all([
      discoverRegion(options, PRIORITY_REGIONS, PRIORITY_MAX),
      discoverRegion(options, REST_REGIONS, REST_MAX),
    ]);

    return [...priority, ...rest];
  };
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
