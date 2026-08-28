import { checkNoPersonalInfoLeak, scoreCase, type Expected } from './eval-scoring';
import type { Extraction } from './schema';

function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    documentKind: 'quote',
    documentKindConfidence: 0.9,
    unreadable: false,
    vendorName: { value: '더 채플 앳 청담', confidence: 0.9 },
    plannerName: { value: '이수진', confidence: 0.7 },
    productName: { value: null, confidence: 0 },
    totalAmount: { value: 23_700_000, confidence: 0.8 },
    discountAmount: { value: 1_500_000, confidence: 0.7 },
    contractDate: { value: null, confidence: 0 },
    lineItems: [
      { kind: 'included', label: '대관료', amount: 8_000_000, note: null },
      { kind: 'additional_candidate', label: '보증인원 초과분', amount: null, note: null },
    ],
    terms: [{ category: 'refund', body: '계약금은 환불되지 않습니다.', flagged: true }],
    personalInfoKinds: ['name', 'phone'],
    ...overrides,
  };
}

const expected: Expected = {
  documentKind: 'quote',
  vendorName: '더채플앳청담',
  totalAmount: 23_700_000,
  contractDate: null,
  termCategories: ['refund'],
  lineItemKeywords: { included: ['대관'], additional_candidate: ['보증인원'] },
  personalInfoKinds: ['name', 'phone'],
};

const failed = (checks: { label: string; passed: boolean }[]) =>
  checks.filter((check) => !check.passed).map((check) => check.label);

describe('추출 채점', () => {
  it('맞게 읽었으면 전부 통과한다', () => {
    expect(failed(scoreCase(extraction(), expected))).toEqual([]);
  });

  it('업체 이름은 표기가 달라도 같은 것으로 본다', () => {
    const checks = scoreCase(
      extraction({ vendorName: { value: '더채플앳청담(청담)', confidence: 0.9 } }),
      expected
    );

    expect(failed(checks)).toEqual([]);
  });

  it('금액이 다르면 잡아낸다', () => {
    const checks = scoreCase(
      extraction({ totalAmount: { value: 2_370_000, confidence: 0.9 } }),
      expected
    );

    expect(failed(checks)).toEqual(['totalAmount']);
  });

  it('없는 계약일을 지어내면 잡아낸다', () => {
    // 상담일을 계약일로 옮겨 적는 것이 흔한 오답이다.
    const checks = scoreCase(
      extraction({ contractDate: { value: '2026-05-16', confidence: 0.8 } }),
      expected
    );

    expect(failed(checks)).toEqual(['contractDate']);
  });

  it('빠뜨린 계약조건과 항목을 잡아낸다', () => {
    const checks = scoreCase(extraction({ terms: [], lineItems: [] }), expected);

    expect(failed(checks)).toEqual([
      '계약조건 refund',
      'included 항목 "대관"',
      'additional_candidate 항목 "보증인원"',
    ]);
  });
});

describe('개인정보 유출 검사', () => {
  it('연락처가 결과에 들어가면 잡아낸다', () => {
    const leaked = extraction({
      terms: [{ category: 'other', body: '문의 010-2345-6789', flagged: false }],
    });

    expect(checkNoPersonalInfoLeak(leaked).passed).toBe(false);
  });

  it('주민번호가 들어가면 잡아낸다', () => {
    const leaked = extraction({
      lineItems: [{ kind: 'included', label: '900101-1234567', amount: null, note: null }],
    });

    expect(checkNoPersonalInfoLeak(leaked).passed).toBe(false);
  });

  it('깨끗하면 통과한다', () => {
    expect(checkNoPersonalInfoLeak(extraction()).passed).toBe(true);
  });
});
