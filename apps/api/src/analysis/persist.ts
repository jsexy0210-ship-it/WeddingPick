import type { PoolClient } from 'pg';

import type { Extraction } from './schema';

/** 신뢰도와 함께 저장할 추출 필드. */
function extractionFields(extraction: Extraction) {
  const fields: { path: string; value: string; confidence: number }[] = [];

  const push = (path: string, read: { value: unknown; confidence: number }) => {
    if (read.value !== null && read.value !== undefined) {
      fields.push({ path, value: String(read.value), confidence: read.confidence });
    }
  };

  push('vendorName', extraction.vendorName);
  push('plannerName', extraction.plannerName);
  push('productName', extraction.productName);
  push('totalAmount', extraction.totalAmount);
  push('discountAmount', extraction.discountAmount);
  push('contractDate', extraction.contractDate);

  // 환불조건은 확인이 필요한 핵심 필드다. 여러 조항이 있으면 하나로 묶어 보여준다.
  const refundTerms = extraction.terms.filter((term) => term.category === 'refund');

  if (refundTerms.length > 0) {
    fields.push({
      path: 'refundTerms',
      value: refundTerms.map((term) => term.body).join('\n'),
      confidence: 1,
    });
  }

  return fields;
}

/**
 * 추출 결과를 문서 한 건으로 저장한다.
 *
 * 등급은 L0에서 시작하고 confirmed_at은 비운다. 사용자 확인 전에는 어떤 계산에도
 * 들어가지 않는다 — 서비스정책서 1번.
 *
 * 업체는 이름만 받아 두고 연결하지 않는다. 어느 업체인지 확정하는 것은 서버의 매칭
 * 단계이며(사업계획서 27번), 아직 업체 데이터가 없다. 연결 전까지 이 문서는 가격
 * 비교에 쓰이지 않는다.
 */
export async function persistExtraction(
  client: PoolClient,
  input: { weddingId: string; rawDocumentId: string; extraction: Extraction }
): Promise<string> {
  const { extraction } = input;

  // 값이 아니라 종류만 남긴다. 구조화 데이터에 개인정보가 섞이지 않게 한다.
  await client.query(
    'UPDATE originals.raw_documents SET personal_info_kinds = $2 WHERE id = $1',
    [input.rawDocumentId, extraction.personalInfoKinds]
  );

  const quote = await client.query<{ id: string }>(
    `INSERT INTO structured.quotes
       (wedding_id, raw_document_id, doc_type, product_name, total_amount, discount_amount,
        contract_date, verification_level, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'L0', 'ai_extraction')
     RETURNING id`,
    [
      input.weddingId,
      input.rawDocumentId,
      extraction.documentKind === 'not_a_document' ? 'unknown' : extraction.documentKind,
      extraction.productName.value,
      extraction.totalAmount.value,
      extraction.discountAmount.value,
      extraction.contractDate.value,
    ]
  );

  const quoteId = quote.rows[0]!.id;

  for (const item of extraction.lineItems) {
    await client.query(
      `INSERT INTO structured.quote_line_items (quote_id, kind, label, amount, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [quoteId, item.kind, item.label, item.amount, item.note]
    );
  }

  for (const term of extraction.terms) {
    await client.query(
      `INSERT INTO structured.contract_terms (quote_id, category, body, flagged)
       VALUES ($1, $2, $3, $4)`,
      [quoteId, term.category, term.body, term.flagged]
    );
  }

  for (const field of extractionFields(extraction)) {
    await client.query(
      `INSERT INTO structured.extraction_fields
         (quote_id, field_path, extracted_value, confidence)
       VALUES ($1, $2, $3, $4)`,
      [quoteId, field.path, field.value, field.confidence]
    );
  }

  return quoteId;
}
