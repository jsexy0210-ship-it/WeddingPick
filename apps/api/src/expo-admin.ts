import type { Pool } from 'pg';

import { notFound } from './errors';

/**
 * 관리자 박람회 관리 — 목록 · 상세 · 등록 · 수정 · 삭제 · 검수 큐.
 * `docs/expo-agent-spec.md`가 정본이고, 이 파일은 그 값을 담는 그릇이다.
 *
 * 자동 수집(SNS · 공식 채널 검색)은 아직 붙지 않았다 — 이 환경의 네트워크 정책이
 * 외부 사이트(네이버 · 인스타그램 등)로 나가는 것을 막고 있어 실제로 닿는지 확인할
 * 수 없었다(PR 본문 참고). 그래서 이 화면이 먼저 여는 것은 **수동 등록 + 검수** 경로다 —
 * 관리자가 값을 넣거나 고치면 `admin_review_required`로 검수 표시를 남길 수 있다.
 */

export type ExpoStatus = 'UPCOMING' | 'ONGOING' | 'ENDED' | 'CANCELLED' | 'POSTPONED';

type ExpoRow = {
  id: string;
  title: string;
  canonical_event_name: string | null;
  organizer: string;
  host: string | null;
  starts_at: Date;
  ends_at: Date;
  venue: string;
  address: string;
  region: string;
  city: string | null;
  district: string | null;
  registration_deadline: Date | null;
  reservation_url: string | null;
  official_website_url: string | null;
  benefits: unknown;
  description: string;
  event_categories: unknown;
  confidence: string | null;
  confidence_score: number | null;
  discovery_urls: unknown;
  verification_urls: unknown;
  admin_review_required: boolean;
  review_reason: unknown;
  manual_status: 'CANCELLED' | 'POSTPONED' | null;
  source_note: string;
  thumbnail_url: string | null;
  thumbnail_candidate_url: string | null;
  thumbnail_source_url: string | null;
  thumbnail_rights: 'ORGANIZER_PROVIDED' | 'LICENSED' | 'OFFICIAL_PUBLIC' | 'WEDDINGPICK_CREATED' | null;
  last_verified_at: Date;
};

export type ExpoAdmin = {
  id: string;
  title: string;
  canonicalEventName: string | null;
  organizer: string;
  host: string | null;
  startsAt: string;
  endsAt: string;
  venue: string;
  address: string;
  region: string;
  city: string | null;
  district: string | null;
  registrationDeadline: string | null;
  reservationUrl: string | null;
  officialWebsiteUrl: string | null;
  benefits: string[];
  description: string;
  eventCategories: string[];
  status: ExpoStatus;
  confidence: string | null;
  confidenceScore: number | null;
  discoveryUrls: string[];
  verificationUrls: string[];
  adminReviewRequired: boolean;
  reviewReason: string[];
  sourceNote: string;
  thumbnailUrl: string | null;
  thumbnailCandidateUrl: string | null;
  thumbnailSourceUrl: string | null;
  thumbnailRights: 'ORGANIZER_PROVIDED' | 'LICENSED' | 'OFFICIAL_PUBLIC' | 'WEDDINGPICK_CREATED' | null;
  lastVerifiedAt: string;
};

const COLUMNS = `
  id, title, canonical_event_name, organizer, host, starts_at, ends_at, venue, address,
  region, city, district, registration_deadline, reservation_url, official_website_url,
  benefits, description, event_categories, confidence, confidence_score, discovery_urls,
  verification_urls, admin_review_required, review_reason, manual_status, source_note,
  thumbnail_url, thumbnail_candidate_url, thumbnail_source_url, thumbnail_rights, last_verified_at
`;

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}

/** UPCOMING/ONGOING/ENDED는 날짜로 계산한다. 취소·연기만 저장된 값을 그대로 쓴다. */
function computeStatus(row: ExpoRow): ExpoStatus {
  if (row.manual_status) return row.manual_status;
  const now = new Date();
  if (now < row.starts_at) return 'UPCOMING';
  if (now > row.ends_at) return 'ENDED';
  return 'ONGOING';
}

function toAdmin(row: ExpoRow): ExpoAdmin {
  return {
    id: row.id,
    title: row.title,
    canonicalEventName: row.canonical_event_name,
    organizer: row.organizer,
    host: row.host,
    startsAt: toDateStr(row.starts_at),
    endsAt: toDateStr(row.ends_at),
    venue: row.venue,
    address: row.address,
    region: row.region,
    city: row.city,
    district: row.district,
    registrationDeadline: row.registration_deadline ? toDateStr(row.registration_deadline) : null,
    reservationUrl: row.reservation_url,
    officialWebsiteUrl: row.official_website_url,
    benefits: toArray(row.benefits),
    description: row.description,
    eventCategories: toArray(row.event_categories),
    status: computeStatus(row),
    confidence: row.confidence,
    confidenceScore: row.confidence_score,
    discoveryUrls: toArray(row.discovery_urls),
    verificationUrls: toArray(row.verification_urls),
    adminReviewRequired: row.admin_review_required,
    reviewReason: toArray(row.review_reason),
    sourceNote: row.source_note,
    thumbnailUrl: row.thumbnail_url,
    thumbnailCandidateUrl: row.thumbnail_candidate_url,
    thumbnailSourceUrl: row.thumbnail_source_url,
    thumbnailRights: row.thumbnail_rights,
    lastVerifiedAt: toDateStr(row.last_verified_at),
  };
}

/** 검수 대기가 맨 위다(2026-09-15 관리자 공통 규칙 — 지금 봐야 할 것이 위). */
export async function listExpos(pool: Pool): Promise<ExpoAdmin[]> {
  const { rows } = await pool.query<ExpoRow>(
    `SELECT ${COLUMNS} FROM structured.expos
     ORDER BY admin_review_required DESC, starts_at ASC`
  );
  return rows.map(toAdmin);
}

export async function reviewQueue(pool: Pool): Promise<ExpoAdmin[]> {
  const { rows } = await pool.query<ExpoRow>(
    `SELECT ${COLUMNS} FROM structured.expos
     WHERE admin_review_required
     ORDER BY starts_at ASC`
  );
  return rows.map(toAdmin);
}

export async function getExpo(pool: Pool, id: string): Promise<ExpoAdmin> {
  const { rows } = await pool.query<ExpoRow>(`SELECT ${COLUMNS} FROM structured.expos WHERE id = $1`, [id]);
  if (!rows[0]) throw notFound('박람회');
  return toAdmin(rows[0]);
}

export type ExpoInput = {
  title: string;
  organizer: string;
  host?: string | null;
  startsAt: string;
  endsAt: string;
  venue: string;
  address?: string;
  region: string;
  city?: string | null;
  district?: string | null;
  registrationDeadline?: string | null;
  reservationUrl?: string | null;
  officialWebsiteUrl?: string | null;
  benefits?: string[];
  description?: string;
  eventCategories?: string[];
  confidence?: string | null;
  confidenceScore?: number | null;
  sourceNote?: string;
  thumbnailUrl?: string | null;
  thumbnailCandidateUrl?: string | null;
  thumbnailSourceUrl?: string | null;
  thumbnailRights?: 'ORGANIZER_PROVIDED' | 'LICENSED' | 'OFFICIAL_PUBLIC' | 'WEDDINGPICK_CREATED' | null;
  adminReviewRequired?: boolean;
  reviewReason?: string[];
};

/** 관리자가 직접 넣는 값이다 — 출처는 「관리자 등록」으로 남긴다. */
export async function createExpo(pool: Pool, input: ExpoInput): Promise<ExpoAdmin> {
  const { rows } = await pool.query<ExpoRow>(
    `INSERT INTO structured.expos
       (title, organizer, host, starts_at, ends_at, venue, address, region, city, district,
        registration_deadline, reservation_url, official_website_url, benefits, description,
        event_categories, confidence, confidence_score, source_note, thumbnail_url,
        thumbnail_candidate_url, thumbnail_source_url, thumbnail_rights, admin_review_required,
        review_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15,
             $16::jsonb, $17, $18, $19, $20, $21, $22, $23, $24, $25::jsonb)
     RETURNING ${COLUMNS}`,
    [
      input.title,
      input.organizer,
      input.host ?? null,
      input.startsAt,
      input.endsAt,
      input.venue,
      input.address ?? '',
      input.region,
      input.city ?? null,
      input.district ?? null,
      input.registrationDeadline ?? null,
      input.reservationUrl ?? null,
      input.officialWebsiteUrl ?? null,
      JSON.stringify(input.benefits ?? []),
      input.description ?? '',
      JSON.stringify(input.eventCategories ?? []),
      input.confidence ?? null,
      input.confidenceScore ?? null,
      input.sourceNote ?? '관리자 등록',
      input.thumbnailUrl ?? null,
      input.thumbnailCandidateUrl ?? null,
      input.thumbnailSourceUrl ?? null,
      input.thumbnailRights ?? null,
      input.adminReviewRequired ?? false,
      JSON.stringify(input.reviewReason ?? []),
    ]
  );
  return toAdmin(rows[0]!);
}

export type ExpoPatch = Partial<ExpoInput>;

const PATCH_COLUMNS: Record<keyof ExpoPatch, string> = {
  title: 'title',
  organizer: 'organizer',
  host: 'host',
  startsAt: 'starts_at',
  endsAt: 'ends_at',
  venue: 'venue',
  address: 'address',
  region: 'region',
  city: 'city',
  district: 'district',
  registrationDeadline: 'registration_deadline',
  reservationUrl: 'reservation_url',
  officialWebsiteUrl: 'official_website_url',
  benefits: 'benefits',
  description: 'description',
  eventCategories: 'event_categories',
  confidence: 'confidence',
  confidenceScore: 'confidence_score',
  sourceNote: 'source_note',
  thumbnailUrl: 'thumbnail_url',
  thumbnailCandidateUrl: 'thumbnail_candidate_url',
  thumbnailSourceUrl: 'thumbnail_source_url',
  thumbnailRights: 'thumbnail_rights',
  adminReviewRequired: 'admin_review_required',
  reviewReason: 'review_reason',
};

const JSONB_FIELDS = new Set<keyof ExpoPatch>(['benefits', 'eventCategories', 'reviewReason']);

export async function updateExpo(pool: Pool, id: string, patch: ExpoPatch): Promise<ExpoAdmin> {
  const keys = Object.keys(patch) as (keyof ExpoPatch)[];
  if (keys.length === 0) return getExpo(pool, id);

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const key of keys) {
    const column = PATCH_COLUMNS[key];
    const value = patch[key];
    if (JSONB_FIELDS.has(key)) {
      sets.push(`${column} = $${idx++}::jsonb`);
      params.push(JSON.stringify(value ?? []));
    } else {
      sets.push(`${column} = $${idx++}`);
      params.push(value ?? null);
    }
  }
  sets.push(`updated_at = now()`);
  params.push(id);

  const { rows } = await pool.query<ExpoRow>(
    `UPDATE structured.expos SET ${sets.join(', ')} WHERE id = $${idx} RETURNING ${COLUMNS}`,
    params
  );
  if (!rows[0]) throw notFound('박람회');
  return toAdmin(rows[0]);
}

/** 검수를 마쳤다는 표시만 지운다 — 값은 그대로다. */
export async function approveExpo(pool: Pool, id: string): Promise<ExpoAdmin> {
  return updateExpo(pool, id, { adminReviewRequired: false, reviewReason: [] });
}

/**
 * 관리자가 직접 지운다. **되돌릴 수 없다** — 종료 자동 삭제와 같은 로그 표에
 * `ADMIN_DELETED` 사유로 최소 로그만 남긴다.
 */
export async function removeExpo(pool: Pool, id: string): Promise<void> {
  const { rows } = await pool.query<{ title: string; starts_at: Date; ends_at: Date; venue: string }>(
    'SELECT title, starts_at, ends_at, venue FROM structured.expos WHERE id = $1',
    [id]
  );
  const expo = rows[0];
  if (!expo) throw notFound('박람회');

  await pool.query(
    `INSERT INTO structured.expo_deletion_log
       (event_id, event_name, start_date, end_date, venue, delete_reason)
     VALUES ($1, $2, $3, $4, $5, 'ADMIN_DELETED')`,
    [id, expo.title, expo.starts_at, expo.ends_at, expo.venue]
  );
  await pool.query('DELETE FROM structured.expos WHERE id = $1', [id]);
}
