/**
 * 약관 동의(`/login/consent`) — 기다린 확인이 끝났을 때 **이 화면이 이미 앞에 없으면 옮기지 않는다**
 * (2026-09-26 검수 반례).
 *
 * 웹 JS 스택은 갈아끼워진 카드를 전환이 끝날 때까지 그려 둔다(언마운트가 늦다). 온보딩을 마친
 * 사용자가 옛 주소로 `/login/consent`를 열면 루트가 홈으로 갈아끼우는 사이 이 화면의 가입 상태
 * 확인이 끝나, 언마운트 전이라 `alive`가 참인 채로 `/setup`(온보딩 1/5)으로 되돌려 보냈다.
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';

import ConsentScreen from '@/app/login/consent';
import { getSignupState } from '@/api/client';
import { loadToken } from '@/api/session';
import { dismissToOrReplace } from '@/features/navigation/depth-back';

const mockNavigation = { isFocused: jest.fn(() => true) };

jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, useNavigation: () => mockNavigation }));
jest.mock('@/api/session', () => ({ loadToken: jest.fn() }));
jest.mock('@/api/client', () => ({
  ApiError: class extends Error {},
  completeSignup: jest.fn(),
  getSignupState: jest.fn(),
}));
jest.mock('@/features/navigation/depth-back', () => ({ dismissToOrReplace: jest.fn() }));
jest.mock('@/features/auth/terms-detail-modal', () => ({ TermsDetailModal: 'TermsDetailModal' }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
/* 로그인 · 온보딩 사이의 원형 고리 화면(2026-09-26) — 이 시험은 화면 흐름만 본다. */
jest.mock('@/features/auth/signing-in-view', () => ({ SigningInView: 'SigningInView', SigningInOverlay: () => null }));
jest.mock('@/features/loading/auth-progress', () => ({ beginAuthProgress: jest.fn() }));
jest.mock('@weddingpick/ui', () => ({
  ActionButton: 'ActionButton', ErrorView: 'ErrorView', ProductSymbol: 'ProductSymbol', ThemedText: 'ThemedText', ThemedView: 'ThemedView',
  CanonGray: {}, Layout: {}, LineHeight: {}, MaxContentWidth: 0, Radius: {}, Spacing: {}, ProductSymbolName: {},
  useTheme: () => ({}),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

let tree: ReactTestRenderer | null = null;

beforeEach(() => {
  mockNavigation.isFocused.mockReturnValue(true);
});

afterEach(async () => {
  if (tree) await act(async () => tree?.unmount());
  tree = null;
});

async function mount() {
  await act(async () => {
    tree = create(<ConsentScreen />);
  });
}

describe('약관 동의 — 앞에 없는 화면은 옮기지 않는다', () => {
  it('가입 상태 확인이 끝났을 때 이미 홈으로 갈아끼워졌다면 /setup으로 보내지 않는다', async () => {
    jest.mocked(loadToken).mockResolvedValue('token' as never);
    const signup = deferred<{ activated: boolean }>();
    jest.mocked(getSignupState).mockReturnValue(signup.promise as never);

    await mount();
    /* 루트가 /login을 (tabs)로 갈아끼웠다 — 이 카드는 아직 그려지지만 앞에 있지 않다. */
    mockNavigation.isFocused.mockReturnValue(false);
    await act(async () => signup.resolve({ activated: true }));

    expect(dismissToOrReplace).not.toHaveBeenCalled();
  });

  it('화면이 앞에 있으면 이미 동의한 계정은 그대로 초기 설정으로 넘긴다', async () => {
    jest.mocked(loadToken).mockResolvedValue('token' as never);
    jest.mocked(getSignupState).mockResolvedValue({ activated: true } as never);

    await mount();

    expect(dismissToOrReplace).toHaveBeenCalledWith('/setup');
  });

  it('토큰이 없어도 앞에 없는 화면은 로그인으로 되돌리지 않는다', async () => {
    const token = deferred<string | null>();
    jest.mocked(loadToken).mockReturnValue(token.promise as never);

    await mount();
    mockNavigation.isFocused.mockReturnValue(false);
    await act(async () => token.resolve(null));

    expect(router.replace).not.toHaveBeenCalled();
  });
});
