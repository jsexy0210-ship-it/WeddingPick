import {
  claimPaymentProofFields,
  claimablePaymentProofFields,
  type PaymentProofClaimTarget,
} from './payment-proof';

/**
 * 못 읽은 칸을 사람이 채우는 규칙 — WP-RPT-004. 0240.
 *
 * 여기서 지키는 것은 셋이다. **증빙이 있는 줄에만 열리고**(폐기된 WP-RPT-010과
 * 갈리는 자리), **못 읽은 칸만 받고**(기계가 읽은 값을 사람이 덮어쓰지 못하게),
 * **받았다고 반영되지 않는다**(검수 관문은 이 함수 밖에 있다).
 */

const NOW = new Date('2026-09-14T03:00:00Z');

/** 금액만 못 읽은 줄. 나머지는 자료에서 읽혔다. */
function target(over: Partial<PaymentProofClaimTarget> = {}): PaymentProofClaimTarget {
  return {
    reviewState: 'pending_review',
    pendingFields: ['paidAmount'],
    merchantName: '가온예식홀',
    paidAmount: null,
    paidAt: '2026-05-20T05:23:00Z',
    method: 'card',
    hasOriginal: true,
    ...over,
  };
}

describe('사람이 채울 수 있는 칸', () => {
  it('못 읽은 칸만 묻는다', () => {
    expect(claimablePaymentProofFields({ pendingFields: ['paidAmount'] })).toEqual(['paidAmount']);
  });

  it('순서는 늘 같다 — 화면마다 칸 차례가 달라지지 않게', () => {
    expect(
      claimablePaymentProofFields({ pendingFields: ['paidAt', 'merchantName', 'paidAmount'] })
    ).toEqual(['merchantName', 'paidAmount', 'paidAt']);
  });

  it('지불 수단은 묻지 않는다 — pending_fields에 오지 않는 칸이다', () => {
    expect(claimablePaymentProofFields({ pendingFields: [] })).toEqual([]);
  });
});

describe('사람이 적은 값 받기', () => {
  it('못 읽은 칸을 채우면 받고, 그 칸이 사람 손으로 적힌다', () => {
    const result = claimPaymentProofFields(target(), { paidAmount: 3_000_000 }, NOW);

    expect(result).toEqual({
      ok: true,
      fields: ['paidAmount'],
      merchantName: '가온예식홀',
      paidAmount: 3_000_000,
      paidAt: '2026-05-20T05:23:00Z',
    });
  });

  /* 폐기된 WP-RPT-010을 되살리지 않는다. 0240의 CHECK와 같은 규칙이다. */
  it('증빙이 없으면 받지 않는다', () => {
    const result = claimPaymentProofFields(
      target({ hasOriginal: false }),
      { paidAmount: 3_000_000 },
      NOW
    );

    expect(result).toEqual({
      ok: false,
      reason: '올려주신 자료가 없어 직접 적을 수 없어요. 사진을 다시 올려주세요.',
    });
  });

  it('읽어낸 칸은 고치지 못한다', () => {
    const result = claimPaymentProofFields(
      target(),
      { paidAmount: 3_000_000, merchantName: '다른 곳' },
      NOW
    );

    expect(result).toEqual({ ok: false, reason: '가맹점 이름은 자료에서 읽은 값이라 고칠 수 없어요.' });
  });

  it('물어본 칸을 비워두면 받지 않는다', () => {
    const result = claimPaymentProofFields(
      target({ pendingFields: ['merchantName', 'paidAmount'], merchantName: null }),
      { paidAmount: 3_000_000 },
      NOW
    );

    expect(result).toEqual({ ok: false, reason: '가맹점 이름이 아직 비어 있어요.' });
  });

  /* 사람이 적었다고 값이 말이 되는 것은 아니다. 읽은 값과 같은 자를 댄다. */
  it('말이 안 되는 값은 사람이 적어도 받지 않는다', () => {
    expect(claimPaymentProofFields(target(), { paidAmount: 1_000 }, NOW)).toEqual({
      ok: false,
      reason: '금액을 읽지 못했어요. 다시 찍어주세요.',
    });
  });

  it('앞으로의 날짜는 사람이 적어도 받지 않는다', () => {
    const result = claimPaymentProofFields(
      target({ pendingFields: ['paidAt'], paidAt: null, paidAmount: 3_000_000 }),
      { paidAt: '2027-01-01T00:00:00Z' },
      NOW
    );

    expect(result).toEqual({ ok: false, reason: '낸 날짜가 오늘보다 뒤예요. 잘못 읽은 것 같아요.' });
  });

  it('이미 검수가 끝난 줄에는 적지 못한다', () => {
    const result = claimPaymentProofFields(
      target({ reviewState: 'accepted', paidAmount: 3_000_000 }),
      { paidAmount: 9_000_000 },
      NOW
    );

    expect(result).toEqual({ ok: false, reason: '이미 확인이 끝난 제보예요.' });
  });
});
