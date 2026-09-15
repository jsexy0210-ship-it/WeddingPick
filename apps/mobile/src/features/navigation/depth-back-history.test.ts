import { router } from 'expo-router';

import { goDepthBack } from './depth-back';

/**
 * History 우선 정책(2026-09-15 대표 지시)의 핵심 분기만 잰다. 계층 fallback 값 자체는
 * `depth-back.test.ts`(`depthBackTarget`)가 이미 표로 잡고 있다 — 여기서는 "기록이
 * 있으면 그 표를 아예 보지 않는다"만 확인한다.
 */
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    dismissTo: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(),
  },
}));

describe('goDepthBack — History 우선, 없을 때만 Depth Back', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('현재 스택에 기록이 있으면 History Back이다 — 계층표를 보지 않는다', () => {
    jest.mocked(router.canGoBack).mockReturnValue(true);

    goDepthBack('/search/v-101');

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('기록이 없으면(딥링크 직접 진입) 계층 fallback으로 간다', () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);

    goDepthBack('/search/v-101');

    expect(router.back).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenCalledWith('/search');
  });

  it('기록이 없고 부모도 스택에 없으면(딥링크) dismissTo 실패 뒤 replace로 갈아끼운다', () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);
    jest.mocked(router.dismissTo).mockImplementation(() => {
      throw new Error('nothing to dismiss to');
    });

    goDepthBack('/my/rewards/npay');

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/my/rewards');
  });
});
