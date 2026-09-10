import { verificationDecisionRequest } from './review-decision';

/**
 * 서버가 실제로 받는 모양과 맞는지를 본다. 반대편 계약은
 * `apps/api/src/routes/admin.ts`의 `approveVerificationBodySchema`(note는 선택,
 * 적었으면 공백만은 안 됨) · `rejectVerificationBodySchema`(reason 필수)다.
 */
describe('인증 심사 결정 요청', () => {
  it('반려는 사유 없이 보내지 않는다', () => {
    expect(verificationDecisionRequest('reject', '   ')).toEqual({
      ok: false,
      message: '반려 사유를 입력해주세요.',
    });
  });

  it('반려 사유는 앞뒤 공백을 떼고 reason으로 보낸다', () => {
    expect(verificationDecisionRequest('reject', '  증빙이 계약서가 아니다  ')).toEqual({
      ok: true,
      body: { reason: '증빙이 계약서가 아니다' },
    });
  });

  it('승인 메모가 비면 빈 문자열이 아니라 null이다', () => {
    expect(verificationDecisionRequest('approve', '  ')).toEqual({
      ok: true,
      body: { note: null },
    });
  });

  it('승인 메모를 적었으면 그대로 보낸다', () => {
    expect(verificationDecisionRequest('approve', '계약서 3면 도장 확인')).toEqual({
      ok: true,
      body: { note: '계약서 3면 도장 확인' },
    });
  });
});
