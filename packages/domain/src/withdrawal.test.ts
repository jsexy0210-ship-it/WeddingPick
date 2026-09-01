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
    // 이 시험이 빨개지는 날이 방침 URL이 게시된 날이다.
    expect(privacyPolicyConfirmed()).toBe(false);
  });

  it('탈퇴 안내 문장이 확정됐다', () => {
    expect(WITHDRAWAL_NOTICE).not.toBeNull();
    expect(WITHDRAWAL_NOTICE).toContain('삭제되며');
  });

  it('문장이 확정됐으면 방침 URL 없이도 보여준다', () => {
    expect(withdrawalNotice()).toBe(WITHDRAWAL_NOTICE);
  });

  it('방침 URL이 없으면 출시 준비가 안 된 것이다', () => {
    // withdrawalReady()는 문장과 방침 URL 둘 다 요구한다.
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
