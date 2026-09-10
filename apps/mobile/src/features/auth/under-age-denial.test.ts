import { isUnderAgeDenial } from '@/features/auth/providers';

/**
 * 카카오 앱 설정의 「만 14세 미만 이용 불가」가 켜져 있으면 14세 미만은 동의
 * 화면까지 가지 못하고 `access_denied`로 돌아온다. 사용자가 스스로 취소한 것과
 * **같은 코드**라, 코드만 보고 취소로 처리하면 그 사람은 아무 안내도 못 받고
 * 로그인 화면에 남는다.
 */
describe('카카오가 나이로 막은 것과 사용자가 취소한 것', () => {
  it('나이로 막힌 것은 안내 화면으로 보낸다', () => {
    expect(isUnderAgeDenial('access_denied', 'Not allowed under age 14')).toBe(true);
    // 문구는 카카오가 정하고 바뀔 수 있어 낱말로 느슨하게 본다.
    expect(isUnderAgeDenial('access_denied', 'not allowed UNDER AGE 14')).toBe(true);
    expect(isUnderAgeDenial('access_denied', '만 14세 미만은 이용할 수 없습니다')).toBe(true);
    expect(isUnderAgeDenial('access_denied', '연령 제한으로 로그인할 수 없습니다')).toBe(true);
  });

  it('그냥 취소한 것은 취소로 남긴다', () => {
    expect(isUnderAgeDenial('access_denied', null)).toBe(false);
    expect(isUnderAgeDenial('access_denied', 'User denied access')).toBe(false);
  });

  it('다른 오류는 나이 문제가 아니다', () => {
    // 이유에 나이 낱말이 있어도 access_denied가 아니면 다른 실패다.
    expect(isUnderAgeDenial('invalid_request', 'under age 14')).toBe(false);
    expect(isUnderAgeDenial('server_error', null)).toBe(false);
  });
});
