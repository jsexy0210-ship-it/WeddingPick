import {
  REWARD_PAYOUT_COPY,
  REWARD_PAYOUT_STATUS_NOTE,
  formatMobilePhoneInput,
  maskMobilePhone,
  normalizeMobilePhone,
} from './reward-payout';

describe('Npay 리워드 수령', () => {
  it('휴대폰 번호는 010 열한 자리만 받고 하이픈 꼴로 정리한다', () => {
    expect(normalizeMobilePhone('01012345678')).toBe('010-1234-5678');
    expect(normalizeMobilePhone('010-1234-5678')).toBe('010-1234-5678');
    expect(normalizeMobilePhone('010 1234 5678')).toBe('010-1234-5678');
    expect(normalizeMobilePhone('0111234567')).toBeNull();
    expect(normalizeMobilePhone('021234567')).toBeNull();
    expect(normalizeMobilePhone('')).toBeNull();
  });

  it('입력 중에는 치는 대로 하이픈을 넣는다', () => {
    expect(formatMobilePhoneInput('010')).toBe('010');
    expect(formatMobilePhoneInput('01012')).toBe('010-12');
    expect(formatMobilePhoneInput('010123456789')).toBe('010-1234-5678');
  });

  it('가운데 네 자리를 가린다', () => {
    expect(maskMobilePhone('01012345678')).toBe('010-****-5678');
    expect(maskMobilePhone('bad')).toBe('***');
  });

  it('문구에 운영 기간과 «~않아요» 종결이 없다', () => {
    const all = [...Object.values(REWARD_PAYOUT_STATUS_NOTE), REWARD_PAYOUT_COPY.consentBody, REWARD_PAYOUT_COPY.noteBody];
    for (const text of all) {
      expect(text).not.toMatch(/하루 안에|매달|까지|30일|마감|확률/);
      expect(text).not.toMatch(/않아요\.?$/);
    }
  });
});
