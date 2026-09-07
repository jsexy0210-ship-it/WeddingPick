import { nextAfterSignIn } from './finish-sign-in';

/**
 * 로그인·가입 뒤 어디로 가는가.
 *
 * `signup.tsx`가 이 결정을 따로 적어두고 `'/'`로 굳어 있었다. 그래서 가입을 마치면
 * 온보딩을 통째로 건너뛰고 홈에 도착했고, 예식일·지역·예산·분위기를 한 번도 묻지
 * 않았다. 결정을 한 곳으로 모았으니 그 한 곳을 지킨다.
 */
describe('로그인 뒤 다음 화면', () => {
  it('온보딩을 마치지 않았으면 온보딩으로 보낸다', () => {
    expect(nextAfterSignIn({ setupComplete: false, savedWedding: false })).toBe('/setup');
  });

  it('아무것도 모르는 상태에서도 온보딩으로 보낸다', () => {
    // 서버를 못 읽어 undefined가 와도 홈으로 흘려보내지 않는다 —
    // 그렇게 흘려보내면 빈 홈을 보여주고 다시 물어볼 자리가 없다.
    expect(nextAfterSignIn({})).toBe('/setup');
  });

  it('온보딩을 마쳤으면 홈으로 보낸다', () => {
    expect(nextAfterSignIn({ setupComplete: true, savedWedding: false })).toBe('/(tabs)');
  });

  it('기기에 적어둔 예식일을 방금 올렸으면 홈으로 보낸다', () => {
    expect(nextAfterSignIn({ setupComplete: false, savedWedding: true })).toBe('/(tabs)');
  });
});
