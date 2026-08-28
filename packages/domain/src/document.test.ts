import { isConfirmed, needsAttention, needsUserConfirmation } from './document';
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

describe('확인 필요 표시', () => {
  const field = (over: Partial<Parameters<typeof needsAttention>[0]> = {}) => ({
    requiresConfirmation: false,
    confirmedByUser: false,
    confidence: 1,
    ...over,
  });

  it('핵심 필드는 신뢰도가 높아도 드러낸다', () => {
    // 서비스정책서 1번: 계약금액·계약일·환불조건은 예외 없이 확인을 거친다.
    expect(needsAttention(field({ requiresConfirmation: true }))).toBe(true);
  });

  it('흐릿하게 읽은 항목은 핵심이 아니어도 드러낸다', () => {
    /*
     * 실제 계약서 사진에서 접힌 자리·손글씨 때문에 예식일을 확신 못 하는 일이
     * 흔하다. 그 값이 맞는 것처럼 나가면 사용자는 틀린 것을 그대로 믿는다.
     */
    expect(needsAttention(field({ confidence: 0.45 }))).toBe(true);
  });

  it('또렷하게 읽은 항목은 조용히 둔다', () => {
    expect(needsAttention(field({ confidence: 0.95 }))).toBe(false);
  });

  it('사용자가 확인했으면 더 묻지 않는다', () => {
    expect(
      needsAttention(field({ requiresConfirmation: true, confirmedByUser: true }))
    ).toBe(false);
    expect(needsAttention(field({ confidence: 0.1, confirmedByUser: true }))).toBe(false);
  });
});
