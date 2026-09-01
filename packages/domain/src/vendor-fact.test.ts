import {
  FACT_STALE_DAYS,
  VENDOR_FACT_FIELDS,
  VENDOR_FACT_SOURCE_LABEL,
  factCaption,
  isStale,
  pendingVendorFactFields,
  readyVendorFactFields,
  type VendorFact,
} from './vendor-fact';
import { findPaymentWords } from './pick-verification';

const fact = (checkedOn: string): VendorFact<string> => ({
  value: '가능',
  source: 'vendor_notice',
  checkedOn,
});

describe('업체 사실 항목', () => {
  it('v3.13 §O-4가 이름 붙인 항목이 모두 있다', () => {
    const keys = VENDOR_FACT_FIELDS.map((field) => field.key);

    expect(keys).toEqual([
      'parking',
      'valet',
      'guaranteed_guests',
      'meal_price',
      'hall_fee',
      'options',
      'extra_items',
      'change_cancel_terms',
    ]);
  });

  it('아직 자료가 없는 항목은 왜 없는지 적혀 있다', () => {
    for (const field of VENDOR_FACT_FIELDS) {
      if (!field.ready) expect(field.note).toBeTruthy();
    }
  });

  it('준비된 것과 아닌 것이 겹치지 않는다', () => {
    const ready = readyVendorFactFields();
    const pending = pendingVendorFactFields();

    expect(ready.filter((key) => pending.includes(key))).toEqual([]);
    expect(ready.length + pending.length).toBe(VENDOR_FACT_FIELDS.length);
  });

  it('값 아래에 출처와 확인일이 함께 나간다', () => {
    expect(factCaption(fact('2026-08-14'))).toBe('업체 안내 · 2026-08-14 확인');
  });

  it('확인한 지 오래되면 오래됐다고만 말한다', () => {
    const today = new Date('2026-09-01T00:00:00Z');

    expect(isStale(fact('2026-08-14'), today)).toBe(false);
    expect(isStale(fact('2025-01-01'), today)).toBe(true);
  });

  it('확인일이 없거나 읽을 수 없으면 오래된 것으로 본다', () => {
    /* 읽을 수 없는 날짜를 최신으로 보면, 언제 확인했는지 모르는 값이 최신으로 보인다. */
    expect(isStale(fact('언젠가'), new Date('2026-09-01T00:00:00Z'))).toBe(true);
  });

  it('오래됨의 기준이 한 곳에 있다', () => {
    expect(FACT_STALE_DAYS).toBe(180);
  });

  it('출처 표기에 금지어가 없다', () => {
    for (const label of Object.values(VENDOR_FACT_SOURCE_LABEL)) {
      expect(findPaymentWords(label)).toEqual([]);
    }
  });

  it('항목 이름과 안내에 견적·계약서가 없다', () => {
    for (const field of VENDOR_FACT_FIELDS) {
      expect(`${field.label} ${field.note ?? ''}`).not.toMatch(/견적|계약서/);
    }
  });
});
