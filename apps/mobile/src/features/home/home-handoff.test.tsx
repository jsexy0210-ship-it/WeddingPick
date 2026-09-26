import React from 'react';
import { BackHandler } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';

import HomeScreen from '@/app/(tabs)/index';
import SetupScreen from '@/app/setup';
import { completeSetup, getAppBootstrap, getCurrentUser, getSignupState, listWeddingTasks } from '@/api/client';
import { loadToken } from '@/api/session';
import { listWeddingContent } from '@/features/home/content';
import { StepFrame } from '@/features/onboarding/step-frame';
import {
  clearOnboardingAnswers,
  clearWeddingDraft,
  loadOnboardingAnswers,
  saveOnboardingAnswers,
  saveWeddingDraft,
} from '@/features/onboarding/wedding-draft';
import {
  HOME_HANDOFF_FAILSAFE_MS,
  HomeHandoffHost,
  beginHomeHandoff,
  endHomeHandoff,
  isHomeHandoffActive,
} from './home-handoff';

/**
 * 온보딩 저장 → 홈 첫 자료까지 골격이 **한 번만** 서는가(2026-09-26 대표 감사 4).
 *
 * 설정 화면 · 홈 화면은 실제 컴포넌트다. 서버와 기기 저장소만 가짜이고, 라우터는
 * `dismissTo('/')`가 불리면 이 시험이 홈으로 갈아 끼운다(스택 교체와 같은 결과).
 *
 * 골격(`HomeSkeleton`)은 마운트될 때마다 새 번호를 받는다. 뿌리의 골격이 설정 저장부터
 * 홈 첫 자료까지 **같은 번호로 남아 있으면** 내려갔다 다시 선 일이 없다는 뜻이다.
 */
let mockSkeletonMounts = 0;
jest.mock('./home-skeleton', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    HomeSkeleton: () => {
      const [id] = ReactActual.useState(() => {
        mockSkeletonMounts += 1;
        return mockSkeletonMounts;
      });

      return ReactActual.createElement(View, { testID: `skeleton-${id}` });
    },
  };
});

let mockPathname = '/setup';
jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');

  return {
    router: { replace: jest.fn(), push: jest.fn(), dismissTo: jest.fn(), canGoBack: () => false },
    usePathname: () => mockPathname,
    useFocusEffect: (effect: () => void | (() => void)) => {
      ReactActual.useEffect(() => effect(), [effect]);
    },
  };
});
jest.mock('@/api/config', () => ({ isServerConfigured: true, API_URL: 'http://localhost' }));
jest.mock('@/api/session', () => ({ loadToken: jest.fn() }));
jest.mock('@/api/client', () => ({
  ApiError: class extends Error {},
  completeSetup: jest.fn(),
  completeSignup: jest.fn(),
  getAppBootstrap: jest.fn(),
  getCurrentUser: jest.fn(),
  getSignupState: jest.fn(),
  listWeddingTasks: jest.fn(),
}));
jest.mock('@/features/home/content', () => ({ listWeddingContent: jest.fn() }));
jest.mock('@/features/onboarding/wedding-draft', () => ({
  clearOnboardingAnswers: jest.fn(),
  clearWeddingDraft: jest.fn(),
  loadOnboardingAnswers: jest.fn(),
  saveOnboardingAnswers: jest.fn(),
  saveWeddingDraft: jest.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

function Root({ screen }: { screen: 'setup' | 'home' }) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      {screen === 'setup' ? <SetupScreen /> : <HomeScreen />}
      <HomeHandoffHost />
    </SafeAreaProvider>
  );
}

/** 뿌리 골격 안의 골격 번호. 없으면 null. */
function hostSkeletonId(tree: ReactTestRenderer): string | null {
  const host = tree.root.findAll((node) => node.props.testID === 'home-handoff' && typeof node.type === 'string');
  if (host.length === 0) return null;
  const inner = host[0]!.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('skeleton-'));
  return inner[0]?.props.testID ?? null;
}

let tree: ReactTestRenderer;
beforeEach(() => {
  mockSkeletonMounts = 0;
  mockPathname = '/setup';
  endHomeHandoff();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({ remove: () => undefined }));
  jest.mocked(loadToken).mockResolvedValue('session-token');
  for (const save of [clearOnboardingAnswers, clearWeddingDraft, saveOnboardingAnswers, saveWeddingDraft]) {
    jest.mocked(save).mockResolvedValue(undefined);
  }
  jest.mocked(router.dismissTo).mockImplementation(() => undefined);
  jest.mocked(loadOnboardingAnswers).mockResolvedValue({
    date: { value: null }, region: { region: '서울', district: null },
    prep: { categories: [] }, budget: { amount: null }, style: ['URBAN'],
  });
  jest.mocked(getSignupState).mockResolvedValue({ activated: true } as never);
  jest.mocked(getCurrentUser).mockResolvedValue({ styleTags: [] } as never);
  jest.mocked(listWeddingTasks).mockResolvedValue({ tasks: [] } as never);
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

it('설정 저장부터 홈 첫 자료까지 뿌리의 골격 하나가 내려가지 않고 이어진다', async () => {
  const save = deferred<Awaited<ReturnType<typeof completeSetup>>>();
  const boot = deferred<Awaited<ReturnType<typeof getAppBootstrap>>>();
  const content = deferred<Awaited<ReturnType<typeof listWeddingContent>>>();
  jest.mocked(completeSetup).mockReturnValue(save.promise);
  jest.mocked(getAppBootstrap).mockReturnValue(boot.promise);
  jest.mocked(listWeddingContent).mockReturnValue(content.promise);

  await act(async () => { tree = create(<Root screen="setup" />); });
  expect(tree.root.findByType(StepFrame).props.stepKey).toBe('style');
  await act(async () => { tree.root.findByType(StepFrame).props.onNext(); });
  expect(tree.root.findByType(StepFrame).props.stepKey).toBe('done');
  expect(hostSkeletonId(tree)).toBeNull();

  /* «웨딩픽 시작하기» — 저장이 시작되면 뿌리 골격이 선다. */
  await act(async () => { tree.root.findByType(StepFrame).props.onNext(); });
  const first = hostSkeletonId(tree);
  expect(first).not.toBeNull();
  expect(isHomeHandoffActive()).toBe(true);

  /* 저장 끝 — 홈 자료를 먼저 띄우고 홈으로 교체한다. */
  await act(async () => save.resolve({} as never));
  expect(getAppBootstrap).toHaveBeenCalledTimes(1);
  expect(router.dismissTo).toHaveBeenCalledWith('/');

  mockPathname = '/';
  await act(async () => { tree.update(<Root screen="home" />); });

  /* 설정이 내려가고 홈이 섰다. 홈 자료를 기다리는 동안에도 같은 골격이다. */
  expect(tree.root.findAllByType(StepFrame)).toHaveLength(0);
  expect(hostSkeletonId(tree)).toBe(first);

  await act(async () => boot.resolve({
    member: null, candidates: null, budget: null, bracketAnswered: false, partnerInvitePending: false,
  } as never));
  expect(hostSkeletonId(tree)).toBe(first);

  await act(async () => content.resolve([]));

  /* 홈이 첫 자료를 그린 순간 걷힌다. 그 사이 뿌리 골격은 단 한 번 섰다. */
  expect(isHomeHandoffActive()).toBe(false);
  expect(hostSkeletonId(tree)).toBeNull();
  expect(tree.root.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('skeleton-'))).toHaveLength(0);
});

it('홈이 첫 자료를 못 받으면 골격을 걷고 오류를 보인다', async () => {
  mockPathname = '/';
  jest.mocked(getAppBootstrap).mockRejectedValue(new Error('offline'));
  jest.mocked(listWeddingContent).mockResolvedValue([]);

  await act(async () => { tree = create(<Root screen="home" />); });
  act(() => { beginHomeHandoff(); });

  /* 이미 오류를 그린 홈 위에 골격이 서도 곧바로 걷는다 — 오류를 덮어 두지 않는다. */
  expect(isHomeHandoffActive()).toBe(false);
  expect(tree.root.findAll((node) => node.props.testID === 'home-handoff')).toHaveLength(0);
});

it('설정 · 홈이 아닌 화면에 닿으면 뿌리 골격은 스스로 걷힌다', async () => {
  mockPathname = '/login';
  await act(async () => { tree = create(<HomeHandoffHost />); });
  act(() => { beginHomeHandoff(); });
  expect(isHomeHandoffActive()).toBe(false);
});

it('어느 길로도 걷히지 않으면 안전줄 시간 뒤에 스스로 걷혀 앱을 잠그지 않는다', () => {
  jest.useFakeTimers();
  try {
    beginHomeHandoff();
    jest.advanceTimersByTime(HOME_HANDOFF_FAILSAFE_MS - 1);
    expect(isHomeHandoffActive()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(isHomeHandoffActive()).toBe(false);
  } finally {
    jest.useRealTimers();
  }
});

it('제때 걷히면 안전줄 타이머도 함께 치운다', () => {
  jest.useFakeTimers();
  try {
    beginHomeHandoff();
    endHomeHandoff();
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});
