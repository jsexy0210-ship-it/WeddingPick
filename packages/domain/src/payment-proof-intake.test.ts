import { paymentProofIntake } from './payment-proof';

/**
 * 읽은 결과를 접수 상태로 옮기는 규칙. 핸드오프 v3.24.
 *
 * **「못 읽었다」가 정상 상태다.** 예전에는 못 읽으면 화면이 사용자에게 물어 빈칸을
 * 채웠다. 그 길이 없어진 지금, 이 함수가 「접수는 됐고 아직 쓸 수 없다」를 만든다 —
 * 여기가 흔들리면 증빙 없는 값이 금액 구간에 들어가거나, 멀쩡한 제보가 버려진다.
 */
describe('결제인증 접수 상태', () => {
  const read = {
    merchantName: '가온예식홀',
    paidAmount: 3_000_000,
    paidAt: '2026-05-20T04:00:00.000Z',
    needsConfirmation: [] as const,
    rejection: null,
  };

  const now = new Date('2026-06-01T00:00:00.000Z');

  it('다 읽었으면 바로 쓴다', () => {
    expect(paymentProofIntake(read, now)).toEqual({
      state: 'accepted',
      pendingFields: [],
      reviewNote: null,
    });
  });

  it('금액을 못 읽으면 접수는 하되 기다린다', () => {
    const result = paymentProofIntake({ ...read, paidAmount: null }, now);

    expect(result.state).toBe('pending_review');
    expect(result.pendingFields).toEqual(['paidAmount']);
    // 값을 지어내지 않는다. 사유는 무엇이 되는지를 말한다.
    expect(result.reviewNote).toContain('알려드려요');
  });

  it('가맹점 이름이 공백뿐이어도 못 읽은 것이다', () => {
    // 빈 문자열을 「읽었다」로 세면 이름 없는 줄이 업체 매칭으로 넘어간다.
    expect(paymentProofIntake({ ...read, merchantName: '   ' }, now).pendingFields).toEqual([
      'merchantName',
    ]);
  });

  it('확신이 낮은 칸이 있으면 기다린다', () => {
    // 값은 다 있지만 흐릿하게 읽었다. 그대로 분포에 넣으면 읽기 실패보다 나쁘다.
    const result = paymentProofIntake({ ...read, needsConfirmation: ['paidAt'] }, now);

    expect(result.state).toBe('pending_review');
    expect(result.pendingFields).toEqual(['paidAt']);
  });

  it('지불 수단 하나로는 붙들지 않는다', () => {
    // 카드인지 계좌이체인지 흐릿한 것은 금액이 흐릿한 것과 다르다. 값은 그대로 맞다.
    expect(paymentProofIntake({ ...read, needsConfirmation: ['method'] }, now).state).toBe(
      'accepted'
    );
  });

  it('취소 문자는 접수는 하되 그 사유를 남긴다', () => {
    const result = paymentProofIntake({ ...read, rejection: '승인취소 문자예요' }, now);

    // 버리면 사용자는 올린 것이 어디 갔는지 모르고, 받아들이면 낸 적 없는 돈이 낸 돈이 된다.
    expect(result.state).toBe('pending_review');
    expect(result.reviewNote).toBe('승인취소 문자예요');
  });

  it('앞으로의 날짜는 다 읽혀도 기다린다', () => {
    const result = paymentProofIntake({ ...read, paidAt: '2099-01-01T00:00:00.000Z' }, now);

    expect(result.state).toBe('pending_review');
    expect(result.reviewNote).toBeTruthy();
  });

  it('너무 작은 금액은 읽기 실패로 본다', () => {
    expect(paymentProofIntake({ ...read, paidAmount: 100 }, now).state).toBe('pending_review');
  });
});
