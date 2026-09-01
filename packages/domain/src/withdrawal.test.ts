import { checkRelease } from './release-gate';
import {
  WITHDRAWAL_NOTICE,
  WITHDRAWAL_PENDING,
  privacyPolicyConfirmed,
  withdrawalNotice,
  withdrawalReady,
} from './withdrawal';

describe('탈퇴 안내', () => {
  it('개인정보처리방침이 아직 확정되지 않았다', () => {
    // 이 시험이 빨개지는 날이 방침이 확정된 날이다. 그때 문장을 옮겨 적는다.
    expect(privacyPolicyConfirmed()).toBe(false);
  });

  it('확정 전에는 문장을 짓지 않는다', () => {
    /*
     * 여기에 그럴듯한 초안을 넣어두면 초안과 확정본을 화면이 구분하지 못하고,
     * 구분하지 못하면 초안이 그대로 나간다.
     */
    expect(WITHDRAWAL_NOTICE).toBeNull();
  });

  it('확정 전에는 아직 안내할 수 없다고 말한다', () => {
    // 모르는 것을 아는 척하지 않는다.
    expect(withdrawalNotice()).toBe(WITHDRAWAL_PENDING);
  });

  it('안내가 없으면 출시 준비가 안 된 것이다', () => {
    expect(withdrawalReady()).toBe(false);
  });
});

describe('문서가 막는 출시', () => {
  const FILLED = {
    businessName: '가온컴퍼니',
    representative: '김지선',
    registrationNumber: '000-00-00000',
    address: '서울특별시 강남구',
    supportContact: 'help@example.test',
    privacyOfficer: '개인정보 보호책임자 김지선',
    termsEffectiveOn: '2026-10-01',
    privacyEffectiveOn: '2026-10-01',
  };

  it('사업자 정보를 다 채워도 문서가 안 되면 막는다', () => {
    const check = checkRelease(FILLED);

    expect(check.missing).toEqual([]);
    expect(check.releasable).toBe(false);
    expect(check.blockingDocuments).toContain('이용약관');
    expect(check.blockingDocuments).toContain('개인정보처리방침');
    expect(check.blockingDocuments).toContain('탈퇴 안내');
  });

  it('무엇이 막는지 한 줄로 말한다', () => {
    expect(checkRelease(FILLED).note).toContain('아직 확정되지 않은 문서');
  });
});
