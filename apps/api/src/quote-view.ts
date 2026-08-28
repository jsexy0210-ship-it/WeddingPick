import type { Pool } from 'pg';

import { notFound } from './errors';

type QuoteRow = {
  id: string;
  wedding_id: string;
  doc_type: string;
  vendor_id: string | null;
  vendor_name: string | null;
  planner_id: string | null;
  planner_name: string | null;
  product_name: string | null;
  total_amount: string | null;
  discount_amount: string | null;
  contract_date: Date | null;
  verification_level: string;
  source: string;
  created_at: Date;
  confirmed_at: Date | null;
};

const toAmount = (value: string | null) => (value === null ? null : Number(value));
const toDate = (value: Date | null) => (value === null ? null : value.toISOString().slice(0, 10));

/** 계약이 정한 모양 그대로 문서 하나를 읽는다. */
export async function loadQuote(pool: Pool, quoteId: string) {
  const { rows } = await pool.query<QuoteRow>(
    `SELECT q.id, q.wedding_id, q.doc_type, q.vendor_id, v.name AS vendor_name,
            q.planner_id, p.name AS planner_name, q.product_name, q.total_amount,
            q.discount_amount, q.contract_date, q.verification_level, q.source,
            q.created_at, q.confirmed_at
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

  const [lineItems, terms, fields] = await Promise.all([
    pool.query(
      `SELECT id, kind, label, amount, note FROM structured.quote_line_items
       WHERE quote_id = $1 ORDER BY label`,
      [quoteId]
    ),
    pool.query(
      `SELECT id, category, body, flagged FROM structured.contract_terms
       WHERE quote_id = $1 ORDER BY category`,
      [quoteId]
    ),
    pool.query(
      `SELECT field_path, extracted_value, confidence, requires_confirmation,
              confirmed_by_user, corrected_value
       FROM structured.extraction_fields WHERE quote_id = $1 ORDER BY field_path`,
      [quoteId]
    ),
  ]);

  return {
    id: quote.id,
    weddingId: quote.wedding_id,
    docType: quote.doc_type,
    vendor: quote.vendor_id ? { id: quote.vendor_id, name: quote.vendor_name! } : null,
    planner: quote.planner_id ? { id: quote.planner_id, name: quote.planner_name! } : null,
    productName: quote.product_name,
    totalAmount: toAmount(quote.total_amount),
    discountAmount: toAmount(quote.discount_amount),
    contractDate: toDate(quote.contract_date),
    verificationLevel: quote.verification_level,
    source: quote.source,
    lineItems: lineItems.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      label: row.label,
      amount: toAmount(row.amount),
      ...(row.note && { note: row.note }),
    })),
    terms: terms.rows.map((row) => ({
      id: row.id,
      category: row.category,
      body: row.body,
      flagged: row.flagged,
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
    createdAt: quote.created_at.toISOString(),
    confirmedAt: quote.confirmed_at?.toISOString() ?? null,
  };
}
