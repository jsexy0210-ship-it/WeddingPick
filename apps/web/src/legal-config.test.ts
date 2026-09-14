import { legalEffectiveDate } from './legal-config';

describe('법적 문서 시행일', () => {
  it('날짜를 배포 설정에서 읽는다', () => {
    expect(legalEffectiveDate('LEGAL_TERMS_EFFECTIVE_ON', { LEGAL_TERMS_EFFECTIVE_ON: '2028-02-29' })).toBe('시행일 2028년 2월 29일');
    expect(legalEffectiveDate('LEGAL_PRIVACY_EFFECTIVE_ON', { LEGAL_PRIVACY_EFFECTIVE_ON: '2027-10-03' })).toBe('시행일 2027년 10월 3일');
  });
  it.each(['2026-02-29', '2026-09-31', '2026-1-1', '미정'])('잘못된 날짜 %s를 거부한다', value => {
    expect(() => legalEffectiveDate('LEGAL_TERMS_EFFECTIVE_ON', { LEGAL_TERMS_EFFECTIVE_ON: value })).toThrow();
  });
  it('로컬 검토에서는 미설정을 허용하되 운영 배포에서는 차단한다', () => {
    expect(legalEffectiveDate('LEGAL_PRIVACY_EFFECTIVE_ON', {})).toBeNull();
    expect(() => legalEffectiveDate('LEGAL_PRIVACY_EFFECTIVE_ON', { RENDER: 'true' })).toThrow();
    expect(() => legalEffectiveDate('LEGAL_PRIVACY_EFFECTIVE_ON', { NODE_ENV: 'production' })).toThrow();
  });
});
