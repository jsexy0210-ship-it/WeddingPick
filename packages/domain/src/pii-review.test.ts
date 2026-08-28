import { canShare, findPiiHints, isReviewed, reviewSummary } from './pii-review';

describe('새어 들어온 개인정보 찾기', () => {
  it('계약조건 원문에 섞인 연락처를 가리킨다', () => {
    // 문서를 읽는 쪽은 값을 옮기지 말라고 지시받지만, 계약조건은 "원문 그대로"라
    // 조항 안에 든 연락처가 그대로 따라 들어온다.
    const hints = findPiiHints({
      contractTerms: '문의는 담당 실장 010-2345-6789로 연락 바랍니다.',
    });

    expect(hints).toContainEqual({ field: 'contractTerms', kind: 'phone' });
  });

  it('주민번호와 이메일도 가리킨다', () => {
    expect(findPiiHints({ productName: '900101-1234567' })).toContainEqual({
      field: 'productName',
      kind: 'resident_number',
    });
    expect(findPiiHints({ hallName: 'a.b@c.co.kr' })).toContainEqual({
      field: 'hallName',
      kind: 'email',
    });
  });

  it('금액은 계좌로 읽지 않는다', () => {
    expect(findPiiHints({ contractTerms: '총액 32,800,000원' })).toEqual([]);
  });

  it('깨끗한 조항에는 아무것도 가리키지 않는다', () => {
    expect(
      findPiiHints({
        vendorNameRaw: '아펠가모 공덕',
        contractTerms: '예식일 30일 이내 취소 시 총액의 50%를 위약금으로 한다.',
      })
    ).toEqual([]);
  });

  it('이름은 형태로 잡히지 않는다 — 그래서 사람이 본다', () => {
    // 이 함수는 사람을 대신하지 않는다. 걸리지 않았다고 깨끗한 것이 아니다.
    expect(findPiiHints({ contractTerms: '담당 실장 김민지' })).toEqual([]);
  });
});

describe('남들이 보는 면으로 갈 수 있는가', () => {
  it('검토를 받아야 간다', () => {
    expect(canShare({ piiReview: 'pending', affectsMarketPrice: true })).toEqual({
      ok: false,
      reason: '개인정보 재검토를 아직 받지 않았습니다.',
    });
  });

  it('등급이 낮으면 검토를 받아도 가지 않는다', () => {
    // 등급과 재검토는 서로 다른 질문에 답한다. 둘 다 통과해야 한다.
    expect(canShare({ piiReview: 'clean', affectsMarketPrice: false }).ok).toBe(false);
  });

  it('둘 다 통과하면 간다', () => {
    expect(canShare({ piiReview: 'clean', affectsMarketPrice: true })).toEqual({ ok: true });
    expect(canShare({ piiReview: 'redacted', affectsMarketPrice: true })).toEqual({ ok: true });
  });

  it('지우고 확인한 것도 본 것이다', () => {
    expect(isReviewed('redacted')).toBe(true);
    expect(isReviewed('pending')).toBe(false);
  });
});

describe('검토자에게 보여줄 한 줄', () => {
  it('조사는 앞말을 보고 고른다', () => {
    // '1곳가'가 되면 안 된다.
    expect(reviewSummary({ detectedKinds: [], hintCount: 1 })).toBe(
      '탐지된 개인정보 없음 · 구조화 데이터에서 1곳이 눈에 띔'
    );
  });

  it('탐지된 종류를 한글로 보여준다', () => {
    expect(reviewSummary({ detectedKinds: ['name', 'phone'], hintCount: 0 })).toBe(
      '탐지: 이름, 연락처'
    );
  });
});
