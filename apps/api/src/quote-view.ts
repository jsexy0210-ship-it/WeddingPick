import {
  STANDARD_SOURCES,
  comparePenalty,
  matchEssentialOption,
  withObject,
  withTopic,
} from '@weddingpick/domain';
import type { Pool } from 'pg';

import { notFound } from './errors';
import { vendorSourceNote } from './vendor-view';

type QuoteRow = {
  id: string;
  wedding_id: string;
  doc_type: string;
  vendor_id: string | null;
  vendor_name: string | null;
  vendor_source: string | null;
  planner_id: string | null;
  planner_name: string | null;
  product_name: string | null;
  total_amount: string | null;
  discount_amount: string | null;
  deposit_amount: string | null;
  balance_amount: string | null;
  contract_date: Date | null;
  wedding_date: Date | null;
  hall_name: string | null;
  guaranteed_guests: number | null;
  meal_price_per_person: string | null;
  verification_level: string;
  source: string;
  created_at: Date;
  confirmed_at: Date | null;
};

const toAmount = (value: string | null) => (value === null ? null : Number(value));
const toDate = (value: Date | null) => (value === null ? null : value.toISOString().slice(0, 10));
const percent = (rate: number) => `${Math.round(rate * 100)}%`;

/**
 * 위약금 조항을 공개 기준과 견준다.
 *
 * 무겁다고 무효라는 뜻이 아니다. 계약 전에 물어볼 거리를 주는 것이며, 법률 판단은
 * 하지 않는다 (이용약관 제3조, 사업계획서 8번).
 */
function penaltyNote(days: number | null, rate: string | null): string | null {
  if (days === null || rate === null) {
    return null;
  }

  const result = comparePenalty({ daysBeforeWedding: days, contractRate: Number(rate) });

  if (result.verdict === 'within_standard') {
    return null;
  }

  const standard =
    result.standardRate === 0 ? '계약금 환급' : `총 비용의 ${percent(result.standardRate)}`;

  const source = `${STANDARD_SOURCES.weddingHallCancellation.authority} ${STANDARD_SOURCES.weddingHallCancellation.name}`;

  return `${withTopic(source)} 예식 ${days}일 전 취소 시 ${withObject(standard)} 기준으로 합니다. 이 조항은 ${percent(result.contractRate)}로 더 무겁습니다.`;
}

/** 기본 제공이어야 하는 항목이 추가비용으로 잡혀 있는지 본다. */
function essentialOptionNote(kind: string, label: string): string | null {
  if (kind !== 'additional_candidate') {
    return null;
  }

  const option = matchEssentialOption(label);

  if (!option) {
    return null;
  }

  return `${withTopic(option.label)} ${STANDARD_SOURCES.sdmEssentialOptions.authority}가 기본 제공에 포함하도록 시정한 항목입니다. 별도 청구인지 확인해보세요.`;
}

/** 계약이 정한 모양 그대로 문서 하나를 읽는다. */
export async function loadQuote(pool: Pool, quoteId: string) {
  const { rows } = await pool.query<QuoteRow>(
    `SELECT q.id, q.wedding_id, q.doc_type, q.vendor_id, v.name AS vendor_name,
            q.planner_id, p.name AS planner_name, q.product_name, q.total_amount,
            v.source AS vendor_source,
            q.discount_amount, q.deposit_amount, q.balance_amount, q.contract_date,
            q.wedding_date, q.hall_name, q.guaranteed_guests, q.meal_price_per_person,
            q.verification_level, q.source, q.created_at, q.confirmed_at
     FROM structured.quotes q
     LEFT JOIN structured.vendors v ON v.id = q.vendor_id
     LEFT JOIN structured.planners p ON p.id = q.planner_id
     WHERE q.id = $1`,
    [quoteId]
  );

  const quote = rows[0];

  if (!quote) {
    throw notFound('문서');
  }

  const [lineItems, terms, fields, subVendors, documents] = await Promise.all([
    pool.query(
      `SELECT id, kind, label, amount, amount_min, amount_max, note
       FROM structured.quote_line_items WHERE quote_id = $1 ORDER BY label`,
      [quoteId]
    ),
    pool.query(
      `SELECT id, category, body, flagged, days_before_wedding, penalty_rate
       FROM structured.contract_terms WHERE quote_id = $1 ORDER BY category`,
      [quoteId]
    ),
    pool.query(
      `SELECT field_path, extracted_value, confidence, requires_confirmation,
              confirmed_by_user, corrected_value
       FROM structured.extraction_fields WHERE quote_id = $1 ORDER BY field_path`,
      [quoteId]
    ),
    pool.query(
      `SELECT role, name_raw, vendor_id, amount FROM structured.quote_sub_vendors
       WHERE quote_id = $1 ORDER BY role`,
      [quoteId]
    ),
    // 원본은 분석을 통해서만 문서에 이어진다. 삭제 예정일(A-12)과 인증 증빙(A-13)이 여기서 나온다.
    pool.query(
      // 파기 예정일은 저장된 값이 아니라 계산값이다(0018). 확인과 심사가 끝날
      // 때마다 달라지므로, 화면에 보여줄 때도 그때그때 계산한 것을 준다.
      `SELECT d.id, d.page_count, d.uploaded_at, d.deleted_at,
              s.retention_until, s.awaiting_verification
       FROM structured.analyses a
       JOIN originals.raw_documents d ON d.id = a.raw_document_id
       JOIN originals.document_retention_schedule s ON s.id = d.id
       WHERE a.quote_id = $1
       ORDER BY d.uploaded_at`,
      [quoteId]
    ),
  ]);

  return {
    id: quote.id,
    weddingId: quote.wedding_id,
    docType: quote.doc_type,
    vendor: quote.vendor_id
      ? {
          id: quote.vendor_id,
          name: quote.vendor_name!,
          sourceNote: vendorSourceNote(quote.vendor_source),
        }
      : null,
    planner: quote.planner_id ? { id: quote.planner_id, name: quote.planner_name! } : null,
    productName: quote.product_name,
    totalAmount: toAmount(quote.total_amount),
    discountAmount: toAmount(quote.discount_amount),
    depositAmount: toAmount(quote.deposit_amount),
    balanceAmount: toAmount(quote.balance_amount),
    contractDate: toDate(quote.contract_date),
    weddingDate: toDate(quote.wedding_date),
    hallName: quote.hall_name,
    guaranteedGuests: quote.guaranteed_guests,
    mealPricePerPerson: toAmount(quote.meal_price_per_person),
    verificationLevel: quote.verification_level,
    source: quote.source,
    subVendors: subVendors.rows.map((row) => ({
      role: row.role,
      name: row.name_raw,
      amount: toAmount(row.amount),
      matched: row.vendor_id !== null,
    })),
    lineItems: lineItems.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      label: row.label,
      amount: toAmount(row.amount),
      amountMin: toAmount(row.amount_min),
      amountMax: toAmount(row.amount_max),
      ...(row.note && { note: row.note }),
      standardNote: essentialOptionNote(row.kind, row.label),
    })),
    terms: terms.rows.map((row) => ({
      id: row.id,
      category: row.category,
      body: row.body,
      flagged: row.flagged,
      daysBeforeWedding: row.days_before_wedding,
      penaltyRate: row.penalty_rate === null ? null : Number(row.penalty_rate),
      standardNote: penaltyNote(row.days_before_wedding, row.penalty_rate),
    })),
    // 신뢰도는 늘 함께 나간다. 낮은 값을 "확인 필요"로 드러내려면 화면이 알아야 한다.
    extractionFields: fields.rows.map((row) => ({
      path: row.field_path,
      value: row.extracted_value,
      confidence: Number(row.confidence),
      requiresConfirmation: row.requires_confirmation,
      confirmedByUser: row.confirmed_by_user,
      ...(row.corrected_value && { correctedValue: row.corrected_value }),
    })),
    documents: documents.rows.map((row) => ({
      rawDocumentId: row.id,
      pageCount: row.page_count,
      uploadedAt: row.uploaded_at.toISOString(),
      retentionUntil: row.retention_until?.toISOString() ?? null,
      awaitingVerification: row.awaiting_verification,
      deletedAt: row.deleted_at?.toISOString() ?? null,
    })),
    createdAt: quote.created_at.toISOString(),
    confirmedAt: quote.confirmed_at?.toISOString() ?? null,
  };
}
