import { resetFullScreenLoadingForTest, takeFullScreenLoading } from './first-run';

describe('전체 화면 로딩 예산', () => {
  beforeEach(resetFullScreenLoadingForTest);

  it('앱 실행에서 한 번만 내준다', () => {
    expect(takeFullScreenLoading()).toBe(true);
    expect(takeFullScreenLoading()).toBe(false);
    expect(takeFullScreenLoading()).toBe(false);
  });

  /*
   * 앱을 다시 켜는 것이 예산을 되돌리는 유일한 길이다 — 모듈 변수라 새 실행이면
   * 자연히 처음으로 돌아간다. 저장소에 남기면 「재시작해도 안 나온다」가 되어
   * 사용자가 말한 「최초 또는 앱 재시작 시」와 어긋난다.
   */
  it('재시작하면 다시 쓸 수 있다', () => {
    expect(takeFullScreenLoading()).toBe(true);

    resetFullScreenLoadingForTest();

    expect(takeFullScreenLoading()).toBe(true);
  });
});
