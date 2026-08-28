import { productKey } from '@weddingpick/domain';
import type { PoolClient } from 'pg';

import type { Extraction } from './schema';
import { matchVendor } from './vendor-matching';

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
  push('depositAmount', extraction.depositAmount);
  push('balanceAmount', extraction.balanceAmount);
  push('contractDate', extraction.contractDate);
  push('weddingDate', extraction.weddingDate);
  push('hallName', extraction.hallName);
  push('guaranteedGuests', extraction.guaranteedGuests);
  push('mealPricePerPerson', extraction.mealPricePerPerson);

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
 * 업체는 정규화한 이름이 정확히 같을 때만 연결한다(사업계획서 27번 — 매칭은 서버 몫).
 * 연결하지 못해도 읽은 이름은 남겨두므로, 나중에 업체가 등록되면 다시 맞출 수 있다.
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

  const vendorId = await matchVendor(client, extraction.vendorName.value);

  const quote = await client.query<{ id: string }>(
    `INSERT INTO structured.quotes
       (wedding_id, raw_document_id, doc_type, vendor_id, vendor_name_raw, product_name,
        product_key, total_amount, discount_amount, deposit_amount, balance_amount,
        contract_date, wedding_date, hall_name, guaranteed_guests, meal_price_per_person,
        verification_level, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
             'L0', 'ai_extraction')
     RETURNING id`,
    [
      input.weddingId,
      input.rawDocumentId,
      extraction.documentKind === 'not_a_document' ? 'unknown' : extraction.documentKind,
      vendorId,
      extraction.vendorName.value,
      extraction.productName.value,
      // 업체가 연결돼야 상품 키가 생긴다. 업체를 모르면 무엇과 견줄지도 알 수 없다.
      vendorId
        ? productKey({
            vendorId,
            productName: extraction.productName.value,
            hallName: extraction.hallName.value,
          })
        : null,
      extraction.totalAmount.value,
      extraction.discountAmount.value,
      extraction.depositAmount.value,
      extraction.balanceAmount.value,
      extraction.contractDate.value,
      extraction.weddingDate.value,
      extraction.hallName.value,
      extraction.guaranteedGuests.value,
      extraction.mealPricePerPerson.value,
    ]
  );

  const quoteId = quote.rows[0]!.id;

  for (const item of extraction.lineItems) {
    await client.query(
      `INSERT INTO structured.quote_line_items
         (quote_id, kind, label, amount, amount_min, amount_max, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [quoteId, item.kind, item.label, item.amount, item.amountMin, item.amountMax, item.note]
    );
  }

  // 스드메처럼 업체가 여럿인 패키지. 각 업체도 따로 매칭한다.
  for (const subVendor of extraction.subVendors) {
    await client.query(
      `INSERT INTO structured.quote_sub_vendors (quote_id, role, name_raw, vendor_id, amount)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (quote_id, role, name_raw) DO NOTHING`,
      [quoteId, subVendor.role, subVendor.name, await matchVendor(client, subVendor.name), subVendor.amount]
    );
  }

  for (const term of extraction.terms) {
    await client.query(
      `INSERT INTO structured.contract_terms
         (quote_id, category, body, flagged, days_before_wedding, penalty_rate)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [quoteId, term.category, term.body, term.flagged, term.daysBeforeWedding, term.penaltyRate]
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
