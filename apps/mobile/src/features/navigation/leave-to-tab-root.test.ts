import { router } from 'expo-router';

import { leaveToTabRoot } from './depth-back';

/**
 * 완료 · 안내 CTA가 Root 탭 뿌리로 보낼 때 — 스택 별칭(`stack-alias.ts`) 안에서 `replace('/pick')`를
 * 부르면 Pick 스택에 Pick 뿌리가 한 장 더 쌓인다. 같은 스택이면 꺼내고, 다른 탭이면 건너간다.
 */
jest.mock('expo-router', () => ({
  router: { dismissTo: jest.fn(), navigate: jest.fn(), replace: jest.fn(), push: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

describe('leaveToTabRoot', () => {
  it('Pick 스택의 상담 예약 → «나의 Pick 보기»는 Pick 뿌리까지 꺼낸다', () => {
    leaveToTabRoot('/pick', '/pick/vendor/v-1/consult');
    expect(router.dismissTo).toHaveBeenCalledWith('/pick');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('검색 스택(원래 주소 · 딥링크)의 상담 예약 → Pick 탭으로 건너간다', () => {
    leaveToTabRoot('/pick', '/search/v-1/consult');
    expect(router.navigate).toHaveBeenCalledWith('/pick');
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('상담 예약 완료 → 홈 · 웨딩노트는 그 탭으로 건너간다', () => {
    leaveToTabRoot('/', '/pick/vendor/v-1/consult-done');
    expect(router.navigate).toHaveBeenCalledWith('/');
    leaveToTabRoot('/wedding', '/pick/vendor/v-1/consult-done');
    expect(router.navigate).toHaveBeenCalledWith('/wedding');
  });
});
