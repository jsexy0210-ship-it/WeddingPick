import { router } from 'expo-router';

import { dismissToOrReplace } from './depth-back';

jest.mock('expo-router', () => ({
  router: {
    canGoBack: jest.fn(),
    back: jest.fn(),
    dismissTo: jest.fn(),
    replace: jest.fn(),
  },
  usePathname: jest.fn(() => '/'),
}));

describe('dismissToOrReplace', () => {
  it('대상이 현재 Stack에 있으면 그 화면까지 dismiss한다', () => {
    dismissToOrReplace('/search/vendor-1/reviews');

    expect(router.dismissTo).toHaveBeenCalledWith('/search/vendor-1/reviews');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('딥링크 직접 진입처럼 대상이 Stack에 없으면 현재 화면을 교체한다', () => {
    jest.mocked(router.dismissTo).mockImplementationOnce(() => {
      throw new Error('target is not in this stack');
    });

    dismissToOrReplace('/search/vendor-1/reviews');

    expect(router.replace).toHaveBeenCalledWith('/search/vendor-1/reviews');
  });
});
