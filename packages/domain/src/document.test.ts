import { isConfirmed, needsUserConfirmation } from './document';
import type { ExtractionField, Quote } from './document';

function field(path: string, confirmed: boolean): ExtractionField {
  return { path, value: '값', confidence: 0.4, confirmedByUser: confirmed };
}

describe('사용자 확인 단계', () => {
  it('핵심 필드가 확인되지 않았으면 확인이 필요하다', () => {
    // 서비스정책서 1번: 계약금액·계약일·환불조건은 예외 없이 확인을 거친다.
    expect(needsUserConfirmation([field('totalAmount', false)])).toBe(true);
    expect(needsUserConfirmation([field('contractDate', false)])).toBe(true);
    expect(needsUserConfirmation([field('refundTerms', false)])).toBe(true);
  });

  it('핵심이 아닌 필드는 확인되지 않아도 막지 않는다', () => {
    expect(needsUserConfirmation([field('productName', false)])).toBe(false);
  });

  it('핵심 필드가 모두 확인되면 통과한다', () => {
    expect(
      needsUserConfirmation([field('totalAmount', true), field('contractDate', true)])
    ).toBe(false);
  });

  it('확인 단계를 통과하지 않은 문서는 비교에 쓰지 않는다', () => {
    const quote = { confirmedAt: null } as Quote;

    expect(isConfirmed(quote)).toBe(false);
  });
});
