/**
 * 로그인 화면의 기다림 — **원형 고리 하나**(2026-09-26 대표 지시 「스플래시 → 카카오 로그인 →
 * 로더가 두 번 돈다. 로더 써클만 돌도록 통합한다」).
 *
 *   제공자 목록을 읽는 동안   단추 자리에 원형 고리 28(700ms 넘으면) — 숨쉬는 원형 뼈대가 아니다
 *   단추를 누른 뒤            화면 전체 «로그인하는 중»(`SigningInView`) — 카카오에서 돌아온 부팅과
 *                              같은 화면이라 약관 동의가 설 때까지 로더가 한 번만 선다
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import LoginScreen from '@/app/login/index';
import { useAuthProviders } from '@/features/auth/providers';
import { useSignIn } from '@/features/auth/use-sign-in';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@/features/auth/age-confirm-sheet', () => ({ AgeConfirmSheet: 'AgeConfirmSheet' }));
jest.mock('@/features/auth/login-failure-sheet', () => ({ LoginFailureSheet: 'LoginFailureSheet' }));
jest.mock('@/features/auth/sign-in-handoff', () => ({ takePendingSignInError: () => null }));
jest.mock('@/features/auth/signing-in-view', () => ({
  SigningInView: 'SigningInView',
  signingInMessage: () => '카카오로 로그인하는 중이에요',
}));
jest.mock('@/features/auth/providers', () => ({
  canSignInWith: () => true,
  providerLabel: () => '카카오로 시작하기',
  providerTone: () => undefined,
  useAuthProviders: jest.fn(),
}));
jest.mock('@/features/auth/use-sign-in', () => ({ useSignIn: jest.fn() }));
jest.mock('@weddingpick/ui', () => {
  const { useEffect, useState } = jest.requireActual('react');

  return {
    Border: {}, CanonGray: {}, Layout: {}, LetterSpacing: {}, LineHeight: {}, MaxContentWidth: 0, Radius: {},
    SocialLogo: 'SocialLogo', Spacing: {}, ThemedText: 'ThemedText', ThemedView: 'ThemedView', WeddingMark: 'WeddingMark',
    CircleLoader: 'CircleLoader',
    useTheme: () => ({}),
    /* 실제 700ms 규칙 그대로 — 가짜 타이머로 넘긴다. */
    useDelayedVisible: (active: boolean) => {
      const [elapsed, setElapsed] = useState(false);
      useEffect(() => {
        if (!active) return undefined;
        const timer = setTimeout(() => setElapsed(true), 700);
        return () => clearTimeout(timer);
      }, [active]);
      return active && elapsed;
    },
  };
});

const KAKAO = { provider: 'kakao', isDevelopmentStandIn: false };

function signIn(busy: boolean) {
  jest.mocked(useSignIn).mockReturnValue({
    signIn: jest.fn(), busy, busyProvider: busy ? KAKAO : null, error: null, retry: jest.fn(),
    dismissError: jest.fn(), reportError: jest.fn(), needsAgeConfirm: false, dismissAgeConfirm: jest.fn(),
  } as never);
}

let tree: ReactTestRenderer | null = null;

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
  jest.useRealTimers();
});

it('제공자 목록을 읽는 동안 단추 자리는 700ms 뒤 원형 고리 28이다', () => {
  jest.mocked(useAuthProviders).mockReturnValue({ providers: null, error: null } as never);
  signIn(false);
  act(() => { tree = create(<LoginScreen />); });
  expect(tree!.root.findAllByType('CircleLoader' as never)).toHaveLength(0);

  act(() => { jest.advanceTimersByTime(700); });
  const circles = tree!.root.findAllByType('CircleLoader' as never);
  expect(circles).toHaveLength(1);
  expect(circles[0]!.props.size).toBe(28);
  expect(tree!.root.findAllByType('SigningInView' as never)).toHaveLength(0);
});

it('단추를 누른 뒤에는 화면 전체 «로그인하는 중» 하나만 선다 — 단추 자리에 문구·고리를 따로 세우지 않는다', () => {
  jest.mocked(useAuthProviders).mockReturnValue({ providers: [KAKAO], error: null } as never);
  signIn(true);
  act(() => { tree = create(<LoginScreen />); });
  act(() => { jest.advanceTimersByTime(1000); });

  const views = tree!.root.findAllByType('SigningInView' as never);
  expect(views).toHaveLength(1);
  expect(views[0]!.props.message).toBe('카카오로 로그인하는 중이에요');
  expect(tree!.root.findAllByType('CircleLoader' as never)).toHaveLength(0);
});
