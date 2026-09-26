import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import ConsentScreen from '@/app/login/consent';
import { completeSignup, getSignupState } from '@/api/client';
import { loadToken } from '@/api/session';
import {
  clearSignupPending,
  hasFreshSignupPending,
  noteSignupPending,
  takeFreshSignupActivated,
} from '@/features/auth/sign-in-handoff';
import { dismissToOrReplace } from '@/features/navigation/depth-back';

/**
 * 약관 동의(WP-AUTH-010) — 2026-09-26 대표 감사 5 · 8.
 *
 *   4  로그인이 방금 «가입 전»을 확인했으면 로더 없이 폼부터 서는가.
 *   5  가입 상태를 못 읽었을 때 «다시 시도»가 실제로 다시 묻는가.
 *      전에는 `setStatus('loading')`만 해서 effect가 다시 돌지 않았다 — 로더만 영영 떴다.
 *   8  체크한 여덟 칸이 전부 서버로 가는가. 전에는 셋(terms · privacy · marketing)만 갔다.
 *      옛 서버(셋만 아는)에는 셋만 보내 가입이 막히지 않는가.
 */
jest.mock('expo-router', () => {
  const navigation = { isFocused: () => true };
  return { router: { replace: jest.fn() }, useNavigation: () => navigation };
});
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
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
/* 로그인 · 온보딩 사이의 원형 고리 화면(2026-09-26) — 이 시험은 화면 흐름만 본다. */
jest.mock('@/features/auth/signing-in-view', () => ({ SigningInView: 'SigningInView', SigningInOverlay: 'SigningInOverlay' }));
jest.mock('@/features/loading/auth-progress', () => ({ beginAuthProgress: jest.fn() }));
jest.mock('@weddingpick/ui', () => ({
  ActionButton: 'ActionButton',
  CanonGray: {},
  ErrorView: 'ErrorView',
  Layout: {},
  LineHeight: {},
  MaxContentWidth: 600,
  ProductSymbol: 'ProductSymbol',
  Radius: {},
  Spacing: {},
  ThemedText: 'ThemedText',
  ThemedView: 'ThemedView',
  useTheme: () => ({}),
}));

const ALL_SERVER_ITEMS = [
  'age', 'terms', 'privacy', 'pick_certification', 'consultation_recording',
  'contact_share', 'marketing', 'night_alerts',
];

/** 새 서버의 가입 상태 — `items`는 옛 셋, `agreements`는 여덟 칸 전부. */
function pendingState(agreements: readonly string[] = ALL_SERVER_ITEMS) {
  const entry = (item: string) => ({ item, label: item, required: false, version: 'v', grantedAt: null });

  return {
    activated: false,
    ageVerified: true,
    minimumAge: 14,
    items: ['terms', 'privacy', 'marketing'].map(entry),
    agreements: agreements.map(entry),
    missingRequired: ['terms', 'privacy'],
  } as never;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

let tree: ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
beforeEach(() => {
  jest.mocked(loadToken).mockResolvedValue('session-token');
  clearSignupPending();
});

it('가입 상태를 못 읽은 뒤 «다시 시도»는 서버에 다시 묻고 동의 화면을 연다', async () => {
  jest.mocked(getSignupState)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(pendingState());

  await act(async () => { tree = create(<ConsentScreen />); });

  const error = tree.root.findByType('ErrorView' as never);
  expect(getSignupState).toHaveBeenCalledTimes(1);

  await act(async () => { error.props.onRetry(); });

  expect(getSignupState).toHaveBeenCalledTimes(2);
  expect(tree.root.findAllByType('ErrorView' as never)).toHaveLength(0);
  expect(tree.root.findAllByType('SigningInView' as never)).toHaveLength(0);
  expect(tree.root.findByType('ActionButton' as never).props.label).toBe('동의하고 시작하기');
});

it('다시 시도가 또 실패하면 오류 화면으로 돌아온다(로더에 머물지 않는다)', async () => {
  jest.mocked(getSignupState).mockRejectedValue(new Error('offline'));

  await act(async () => { tree = create(<ConsentScreen />); });
  await act(async () => { tree.root.findByType('ErrorView' as never).props.onRetry(); });

  expect(getSignupState).toHaveBeenCalledTimes(2);
  expect(tree.root.findAllByType('ErrorView' as never)).toHaveLength(1);
});

it('전체 동의 후 제출하면 여덟 칸 모두를 서버 키로 보낸다', async () => {
  jest.mocked(getSignupState).mockResolvedValue(pendingState());
  jest.mocked(completeSignup).mockResolvedValue({ activated: true } as never);

  await act(async () => { tree = create(<ConsentScreen />); });
  await act(async () => { tree.root.findByProps({ accessibilityLabel: '전체 동의' }).props.onPress(); });
  await act(async () => { tree.root.findByType('ActionButton' as never).props.onPress(); });

  expect(completeSignup).toHaveBeenCalledWith({
    consents: [
      'age', 'terms', 'privacy', 'pick_certification', 'consultation_recording',
      'contact_share', 'marketing', 'night_alerts',
    ],
  });
});

it('필수만 체크하면 선택 항목은 보내지 않는다', async () => {
  jest.mocked(getSignupState).mockResolvedValue(pendingState());
  jest.mocked(completeSignup).mockResolvedValue({ activated: true } as never);

  await act(async () => { tree = create(<ConsentScreen />); });
  for (const label of ['만 14세 이상이에요', '서비스 이용약관', '개인정보 수집 · 이용', 'Pick 인증 자료 수집 · 이용', '상담 녹음 수집 · 이용']) {
    await act(async () => {
      tree.root.findAll((node) => node.props.accessibilityRole === 'checkbox' && node.props.accessibilityLabel === label)[0]!.props.onPress();
    });
  }
  await act(async () => { tree.root.findByType('ActionButton' as never).props.onPress(); });

  expect(completeSignup).toHaveBeenCalledWith({
    consents: ['age', 'terms', 'privacy', 'pick_certification', 'consultation_recording'],
  });
});

it('옛 서버(셋만 아는)에는 서버가 아는 항목만 보낸다 — 모르는 키로 가입 전체가 거절되지 않게', async () => {
  /* 옛 서버의 응답에는 `agreements`가 없다(계약의 기본값 []). */
  jest.mocked(getSignupState).mockResolvedValue(pendingState([]));
  jest.mocked(completeSignup).mockResolvedValue({ activated: true } as never);

  await act(async () => { tree = create(<ConsentScreen />); });
  await act(async () => { tree.root.findByProps({ accessibilityLabel: '전체 동의' }).props.onPress(); });
  await act(async () => { tree.root.findByType('ActionButton' as never).props.onPress(); });

  expect(completeSignup).toHaveBeenCalledWith({ consents: ['terms', 'privacy', 'marketing'] });
});

describe('로그인 직후(감사 4 — 로더를 두 번 세우지 않는다)', () => {
  it('로그인이 «가입 전»을 확인했으면 가입 상태를 기다리지 않고 폼부터 그린다', async () => {
    const state = deferred<ReturnType<typeof pendingState>>();
    jest.mocked(getSignupState).mockReturnValue(state.promise as never);
    noteSignupPending();

    await act(async () => { tree = create(<ConsentScreen />); });

    /* 서버 답이 아직인데 폼이 서 있다 — 로더가 없다. */
    expect(tree.root.findAllByType('SigningInView' as never)).toHaveLength(0);
    expect(tree.root.findByType('ActionButton' as never).props.label).toBe('동의하고 시작하기');
    /* 다시 묻기는 한다 — 판정은 서버가 한다. 깃발은 한 번 쓰고 버렸다. */
    expect(getSignupState).toHaveBeenCalledTimes(1);
    expect(hasFreshSignupPending()).toBe(false);

    await act(async () => state.resolve(pendingState()));
    expect(tree.root.findAllByType('SigningInView' as never)).toHaveLength(0);
  });

  it('깃발이 없으면(재방문 · 직접 진입) 전처럼 서버 답을 기다리며 로더를 세운다', async () => {
    const state = deferred<ReturnType<typeof pendingState>>();
    jest.mocked(getSignupState).mockReturnValue(state.promise as never);

    await act(async () => { tree = create(<ConsentScreen />); });
    expect(tree.root.findAllByType('SigningInView' as never)).toHaveLength(1);

    await act(async () => state.resolve(pendingState()));
    expect(tree.root.findAllByType('SigningInView' as never)).toHaveLength(0);
  });

  it('로그인 직후 다시 묻기가 실패해도 그린 폼을 거두지 않는다', async () => {
    jest.mocked(getSignupState).mockRejectedValue(new Error('offline'));
    jest.mocked(completeSignup).mockResolvedValue({ activated: true } as never);
    noteSignupPending();

    await act(async () => { tree = create(<ConsentScreen />); });

    expect(tree.root.findAllByType('ErrorView' as never)).toHaveLength(0);
    await act(async () => { tree.root.findByProps({ accessibilityLabel: '전체 동의' }).props.onPress(); });
    await act(async () => { tree.root.findByType('ActionButton' as never).props.onPress(); });

    /* 서버가 아는 항목을 못 읽었으면 체크한 칸을 전부 보낸다. */
    expect(completeSignup).toHaveBeenCalledWith({ consents: ALL_SERVER_ITEMS });
  });

  it('동의 제출 — 기다리는 동안 원형 고리 덮개가 켜지고, 넘어가는 동안 걷지 않는다 · 온보딩에 «가입 완료»를 넘긴다', async () => {
    jest.mocked(getSignupState).mockResolvedValue(pendingState() as never);
    const signup = deferred<{ activated: boolean }>();
    jest.mocked(completeSignup).mockReturnValue(signup.promise as never);
    noteSignupPending();

    await act(async () => { tree = create(<ConsentScreen />); });
    expect(tree.root.findByType('SigningInOverlay' as never).props.active).toBe(false);

    await act(async () => { tree.root.findByProps({ accessibilityLabel: '전체 동의' }).props.onPress(); });
    await act(async () => { tree.root.findByType('ActionButton' as never).props.onPress(); });
    expect(tree.root.findByType('SigningInOverlay' as never).props.active).toBe(true);

    await act(async () => signup.resolve({ activated: true }));
    expect(dismissToOrReplace).toHaveBeenCalledWith('/setup');
    expect(tree.root.findByType('SigningInOverlay' as never).props.active).toBe(true);
    expect(takeFreshSignupActivated()).toBe(true);
  });

  it('동의 제출이 실패하면 덮개를 걷고 폼 아래 오류를 세운다', async () => {
    jest.mocked(getSignupState).mockResolvedValue(pendingState() as never);
    jest.mocked(completeSignup).mockRejectedValue(new Error('저장하지 못했어요'));
    noteSignupPending();

    await act(async () => { tree = create(<ConsentScreen />); });
    await act(async () => { tree.root.findByProps({ accessibilityLabel: '전체 동의' }).props.onPress(); });
    await act(async () => { tree.root.findByType('ActionButton' as never).props.onPress(); });

    expect(tree.root.findByType('SigningInOverlay' as never).props.active).toBe(false);
    expect(takeFreshSignupActivated()).toBe(false);
  });

  it('로그인 직후라도 이미 활성화된 계정이면 초기 설정으로 넘긴다', async () => {
    jest.mocked(getSignupState).mockResolvedValue({ activated: true } as never);
    noteSignupPending();

    await act(async () => { tree = create(<ConsentScreen />); });

    expect(dismissToOrReplace).toHaveBeenCalledWith('/setup');
  });
});
