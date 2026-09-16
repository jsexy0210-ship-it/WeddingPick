import { randomUUID } from 'node:crypto';
import { CONSENT_ITEMS, privacySections, termsArticles, type PrivacySection } from '@weddingpick/domain';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { withTransaction } from './db';
import { recordDecision } from './decisions';
import { ApiError, notFound } from './errors';
import { isDocType, nextVersion, type DocType } from './admin-ops';

const text = z.string().trim().min(1).max(20000);
const date = z.iso.date();
export const eventBody = z.object({
  title: text.max(200), description: text, startsOn: date, endsOn: date,
  budgetAmount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
  status: z.enum(['draft', 'active', 'closed']),
}).refine((v) => v.endsOn >= v.startsOn, { message: '종료일은 시작일 이후로 입력해주세요' });
export const adBody = z.object({
  vendorId: z.uuid(), surface: z.enum(['vendor_detail', 'search', 'region_category']),
  tier: z.enum(['light', 'standard', 'premium']), category: z.string().trim().min(1).nullable(),
  region: z.string().trim().max(100).nullable(), startsOn: date, endsOn: date,
}).refine((v) => v.endsOn >= v.startsOn, { message: '종료일은 시작일 이후로 입력해주세요' })
  .refine((v) => v.tier === 'premium' || v.surface === 'vendor_detail' || (v.tier === 'standard' && v.surface === 'search'),
    { message: '광고 등급에 맞는 지면을 선택해주세요' });
export const clauseBody = z.object({ articleNumber: text.max(100), title: text.max(300), body: text });
export const draftBody = z.object({ doc: z.enum(['terms', 'privacy', 'marketing']) });

type Db = Pool | PoolClient;
async function audit(db: Db, by: string, kind: string, id: string, action: string) {
  await recordDecision(db, {
    eventId: randomUUID(), workflow: 'admin_content', step: action, subjectKind: kind, subjectId: id,
    decider: { kind: 'human', userId: by }, decision: action, reasonCode: `content_${action}`,
    evidence: [{ kind, id }],
  });
}

export async function listEvents(db: Db) {
  const { rows } = await db.query(`SELECT id, title, description, starts_on::text AS "startsOn",
    ends_on::text AS "endsOn", budget_amount::text AS "budgetAmount", status,
    created_at AS "createdAt" FROM structured.admin_events WHERE deleted_at IS NULL ORDER BY created_at DESC`);
  return rows.map((row) => ({ ...row, budgetAmount: row.budgetAmount === null ? null : Number(row.budgetAmount) }));
}

export async function saveEvent(pool: Pool, id: string | null, input: z.infer<typeof eventBody>, by: string) {
  return withTransaction(pool, async (db) => {
    const values = [input.title, input.description, input.startsOn, input.endsOn, input.budgetAmount, input.status];
    const result = id
      ? await db.query(`UPDATE structured.admin_events SET title=$1, description=$2, starts_on=$3, ends_on=$4,
          budget_amount=$5, status=$6, updated_at=now() WHERE id=$7 AND deleted_at IS NULL RETURNING id`, [...values, id])
      : await db.query(`INSERT INTO structured.admin_events(title,description,starts_on,ends_on,budget_amount,status,created_by)
          VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [...values, by]);
    if (!result.rows[0]) throw notFound('이벤트');
    await audit(db, by, 'event', result.rows[0].id, id ? 'updated' : 'created');
    return { id: result.rows[0].id as string };
  });
}

export async function deleteEvent(pool: Pool, id: string, by: string) {
  await withTransaction(pool, async (db) => {
    const result = await db.query('UPDATE structured.admin_events SET deleted_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id', [id]);
    if (!result.rows[0]) throw notFound('이벤트');
    await audit(db, by, 'event', id, 'deleted');
  });
}

export async function saveAd(pool: Pool, id: string | null, input: z.infer<typeof adBody>, by: string) {
  return withTransaction(pool, async (db) => {
    const vendor = await db.query('SELECT id FROM structured.vendors WHERE id=$1', [input.vendorId]);
    if (!vendor.rows[0]) throw notFound('업체');
    const values = [input.vendorId, input.surface, input.tier, input.category, input.region, input.startsOn, input.endsOn];
    const result = id
      ? await db.query(`UPDATE ads.placements SET vendor_id=$1,surface=$2::ad_surface,tier=$3::ad_tier,
          category=$4::vendor_category,region=$5,starts_on=$6,ends_on=$7 WHERE id=$8 RETURNING id`, [...values, id])
      : await db.query(`INSERT INTO ads.placements(vendor_id,surface,tier,category,region,starts_on,ends_on)
          VALUES($1,$2::ad_surface,$3::ad_tier,$4::vendor_category,$5,$6,$7) RETURNING id`, values);
    if (!result.rows[0]) throw notFound('광고');
    await audit(db, by, 'ad_placement', result.rows[0].id, id ? 'updated' : 'created');
    return { id: result.rows[0].id as string };
  });
}

export async function deleteAd(pool: Pool, id: string, by: string) {
  await withTransaction(pool, async (db) => {
    const result = await db.query('DELETE FROM ads.placements WHERE id=$1 RETURNING id', [id]);
    if (!result.rows[0]) throw notFound('광고');
    await audit(db, by, 'ad_placement', id, 'deleted');
  });
}

// 웹과 관리자는 같은 원문 구조를 쓴다. 표를 문단으로 변환하거나 법률 문구를 복제하지 않는다.
type Snapshot = PrivacySection[];
type Leaf = { path: string[]; title: string; body: string };
function leaves(sections: Snapshot): Leaf[] {
  const result: Leaf[] = [];
  function walk(value: unknown, path: string[], title: string) {
    if (typeof value === 'string') { result.push({ path, title, body: value }); return; }
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, [...path, String(i)], title));
    else if (value && typeof value === 'object') {
      for (const [key, v] of Object.entries(value)) {
        // 표 너비 등 표현 수치는 내용 편집 항목이 아니다.
        if (['t', 'l', 'lead', 'rows', 'cols', 'label'].includes(key)) walk(v, [...path, key], title);
      }
    }
  }
  sections.forEach((section, index) => walk(section, [String(index)], section.t));
  return result;
}

export async function createTermsDraft(pool: Pool, doc: DocType, by: string) {
  return withTransaction(pool, async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`terms:${doc}`]);
    const { rows } = await db.query(`SELECT id, version, published_at, document_snapshot
      FROM structured.terms_versions WHERE doc=$1 ORDER BY created_at DESC`, [doc]);
    if (rows.some((row) => row.published_at === null)) throw new ApiError('invalid_request', '이미 편집 중인 초안이 있어요');
    const last = rows[0];
    const snapshot: Snapshot = last?.document_snapshot ?? (doc === 'terms'
      ? termsArticles(process.env.WEDDINGPICK_CONTACT_EMAIL ?? null)
      : doc === 'privacy' ? privacySections(process.env.WEDDINGPICK_CONTACT_EMAIL ?? null) : []);
    const version = last ? nextVersion(last.version) : 'v1.0';
    const created = await db.query(`INSERT INTO structured.terms_versions(doc,version,document_snapshot)
      VALUES($1,$2,$3) RETURNING id`, [doc, version, JSON.stringify(snapshot)]);
    const id = created.rows[0].id;
    if (last?.document_snapshot) {
      await db.query(`INSERT INTO structured.terms_clauses(version_id,article_number,title,body,position,source_path)
        SELECT $1,article_number,title,body,position,source_path FROM structured.terms_clauses WHERE version_id=$2`, [id, last.id]);
    } else {
      const items = leaves(snapshot);
      for (const [position, leaf] of items.entries()) {
        await db.query(`INSERT INTO structured.terms_clauses(version_id,article_number,title,body,position,source_path)
          VALUES($1,$2,$3,$4,$5,$6)`, [id, String(position + 1), leaf.title, leaf.body, position, leaf.path]);
      }
    }
    await audit(db, by, 'terms_version', id, 'created');
    return { id, version };
  });
}

export async function saveClause(pool: Pool, doc: string, id: string | null, input: z.infer<typeof clauseBody>, by: string) {
  if (!isDocType(doc)) throw notFound('문서');
  await withTransaction(pool, async (db) => {
    const draft = await db.query(`SELECT id FROM structured.terms_versions WHERE doc=$1 AND published_at IS NULL FOR UPDATE`, [doc]);
    if (!draft.rows[0]) throw new ApiError('invalid_request', '먼저 초안을 만들어주세요');
    const versionId = draft.rows[0].id;
    if (id) {
      const existing = await db.query('SELECT article_number,title,source_path FROM structured.terms_clauses WHERE id=$1 AND version_id=$2', [id, versionId]);
      const clause = existing.rows[0];
      if (clause?.source_path && (clause.title !== input.title || clause.article_number !== input.articleNumber)) {
        throw new ApiError('invalid_request', '원문 항목은 내용을 편집해주세요. 제목은 제목 항목의 내용에서 바꿀 수 있어요.');
      }
    }
    const result = id
      ? await db.query(`UPDATE structured.terms_clauses SET article_number=$3,title=$4,body=$5
          WHERE id=$1 AND version_id=$2 RETURNING id`, [id, versionId, input.articleNumber, input.title, input.body])
      : await db.query(`INSERT INTO structured.terms_clauses(version_id,article_number,title,body,position)
          SELECT $1,$2,$3,$4,coalesce(max(position),-1)+1 FROM structured.terms_clauses WHERE version_id=$1 RETURNING id`,
        [versionId, input.articleNumber, input.title, input.body]);
    if (!result.rows[0]) throw notFound('초안 조문');
    await audit(db, by, 'terms_clause', result.rows[0].id, id ? 'updated' : 'created');
  });
}

export async function deleteClause(pool: Pool, doc: string, id: string, by: string) {
  if (!isDocType(doc)) throw notFound('문서');
  await withTransaction(pool, async (db) => {
    const draft = await db.query('SELECT id FROM structured.terms_versions WHERE doc=$1 AND published_at IS NULL FOR UPDATE', [doc]);
    if (!draft.rows[0]) throw notFound('초안');
    const result = await db.query(`DELETE FROM structured.terms_clauses c USING structured.terms_versions v
      WHERE c.id=$1 AND c.version_id=v.id AND v.id=$2 AND v.published_at IS NULL RETURNING c.id`, [id, draft.rows[0].id]);
    if (!result.rows[0]) throw notFound('초안 조문');
    await audit(db, by, 'terms_clause', id, 'deleted');
  });
}

export async function deleteTermsDraft(pool: Pool, doc: string, by: string) {
  if (!isDocType(doc)) throw notFound('문서');
  await withTransaction(pool, async (db) => {
    const draft = await db.query('SELECT id FROM structured.terms_versions WHERE doc=$1 AND published_at IS NULL FOR UPDATE', [doc]);
    if (!draft.rows[0]) throw notFound('초안');
    await db.query('DELETE FROM structured.terms_versions WHERE id=$1', [draft.rows[0].id]);
    await audit(db, by, 'terms_version', draft.rows[0].id, 'deleted');
  });
}

export async function publicTerms(db: Db, doc: DocType) {
  const result = await db.query(`SELECT id,version,published_at,document_snapshot FROM structured.terms_versions
    WHERE doc=$1 AND published_at IS NOT NULL ORDER BY published_at DESC LIMIT 1`, [doc]);
  const version = result.rows[0];
  // 웹과 연결되기 전 별도로 보관하던 조문은 웹 정본으로 승격하지 않는다.
  if (!version?.document_snapshot) return null;
  const { rows } = await db.query(`SELECT title,body,source_path FROM structured.terms_clauses WHERE version_id=$1 ORDER BY position`, [version.id]);
  const sections: Snapshot = structuredClone(version.document_snapshot ?? []);
  // 삭제한 원문을 되살리지 않는다. 내용이 삭제된 표 셀은 빈칸으로 유지한다.
  const set = (path: string[], value: string) => {
    let node: unknown = sections;
    for (const part of path.slice(0, -1)) node = (node as Record<string, unknown> | undefined)?.[part];
    if (node) (node as Record<string, unknown>)[path[path.length - 1]!] = value;
  };
  for (const leaf of leaves(sections)) set(leaf.path, '');
  for (const row of rows) {
    if (row.source_path) set(row.source_path, row.body);
    else sections.push({ t: row.title, l: row.body.split('\n\n') });
  }
  return { version: version.version as string, publishedAt: version.published_at, sections };
}

export async function currentConsentItems(db: Db) {
  const { rows } = await db.query<{ doc: string; version: string }>(`SELECT DISTINCT ON (doc) doc,version
    FROM structured.terms_versions WHERE published_at IS NOT NULL ORDER BY doc,published_at DESC`);
  return CONSENT_ITEMS.map((item) => ({ ...item, version: rows.find((row) => row.doc === item.key)?.version ?? item.version }));
}
