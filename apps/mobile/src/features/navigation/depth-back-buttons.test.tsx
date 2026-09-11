import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';

import { getCurrentUser, listCandidates, completeSetup, createInquiry, listMyInquiries } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import ContactScreen from '@/app/(tabs)/my/contact';
import StyleScreen from '@/app/(tabs)/my/taste';
import PickCategoryScreen from '@/app/(tabs)/pick/category';

/**
 * journey-open-04 — 완료·오류 버튼이 Depth Back인지 못박는다.
 *
 * `router.back()`은 **방문 기록**을 되짚는다. 알림이나 링크로 그 화면에 곧장 떨어지면
 * 되짚을 기록이 없어 앱 밖으로 나가거나 아무 일도 일어나지 않았다. Depth Back은
 * 기록을 보지 않고 `depth-back-rules.ts`가 계산한 **부모**로 간다.
 *
 * 세 경우를 다 본다.
 *
 *   정상 진입   부모가 스택에 있다 → `dismissTo`가 그 화면으로 되돌린다.
 *   오류 상태   오류 화면의 나가는 길도 같은 부모로 간다.
 *   딥링크 진입 스택에 부모가 없다 → `dismissTo`가 서지 못하고 `replace`로 갈아끼운다.
 *
 * 마지막이 이 시험의 이유다. `router.back`이 한 번이라도 불리면 실패한다.
 */

let mockPathname = '/';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    dismissTo: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    canGoBack: jest.fn(() => false),
  },
  usePathname: () => mockPathname,
  useLocalSearchParams: () => ({ category: 'studio' }),
}));

jest.mock('@/api/client', () => ({
  ApiError: class ApiError extends Error {},
  getCurrentUser: jest.fn(),
  listCandidates: jest.fn(),
  removeCandidate: jest.fn(),
  completeSetup: jest.fn(),
  createInquiry: jest.fn(),
  listMyInquiries: jest.fn(),
}));
jest.mock('@/api/config', () => ({ isServerConfigured: true }));
jest.mock('@/components/back-bar', () => ({ BackBar: 'BackBar' }));
jest.mock('@/components/confirm-alert', () => ({ confirmAlert: jest.fn() }));
jest.mock('@/features/loading/delayed-loader', () => ({ DelayedLoadingView: 'Loading' }));
jest.mock('@/features/onboarding/inline-toast', () => ({
  InlineToast: 'InlineToast',
  useInlineToast: () => ({ toast: null, show: jest.fn(), hide: jest.fn() }),
}));
jest.mock('@/features/onboarding/style-grid', () => ({ StyleGrid: 'StyleGrid' }));
jest.mock('@/features/settings/my-kit', () => ({
  Hero: 'Hero', NavAction: 'NavAction', NoteBox: 'NoteBox', Section: 'Section', SubScreen: 'SubScreen',
}));
jest.mock('@weddingpick/ui', () => ({
  Accordion: 'Accordion', ActionButton: 'ActionButton', ErrorView: 'ErrorView', FilterChip: 'FilterChip',
  ListSkeleton: 'ListSkeleton', ThemedText: 'ThemedText', ThemedView: 'ThemedView', WeddingMark: 'WeddingMark',
  FontSize: {}, Layout: {}, MaxContentWidth: 390, Radius: {}, Spacing: {}, useTheme: () => ({}),
}));

let tree: ReactTestRenderer;

async function mount(element: React.ReactElement) {
  await act(async () => { tree = create(element); });
}

afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

/** 스택에 부모가 없는 상태 — 알림·링크로 화면에 곧장 떨어진 경우. */
function asDeepLink() {
  jest.mocked(router.dismissTo).mockImplementation(() => {
    throw new Error('nothing to dismiss to');
  });
}

/** 눌린 뒤 실제로 어디로 갔는지. History Back을 썼으면 여기서 걸린다. */
function landedOn(): string {
  expect(router.back).not.toHaveBeenCalled();

  const dismiss = jest.mocked(router.dismissTo).mock.calls[0]?.[0];
  const replaced = jest.mocked(router.replace).mock.calls[0]?.[0];

  return (dismiss ?? replaced) as string;
}

/** 화면 안 「돌아가기」 버튼. */
function backButtons() {
  return tree.root
    .findAllByType('ActionButton' as never)
    .filter((node) => node.props.label === '돌아가기');
}

describe('/my/contact — 문의 완료·목록 하단', () => {
  beforeEach(() => {
    jest.mocked(listMyInquiries).mockResolvedValue({ inquiries: [] } as never);
  });

  // 이 describe의 첫 시험이라 ContactScreen 모듈 적재 비용을 혼자 치른다. 로컬은 넉넉히
  // 통과하지만 CI 러너에서 6.2초가 나와 기본 5초를 두 번 넘겼다(2026-09-11 run 743 · 765).
  // 논리 실패가 아니라 시간 초과라 시험 내용은 그대로 두고 시간만 넓힌다.
  it('정상 진입: 「돌아가기」가 MY로 올라간다', async () => {
    mockPathname = '/my/contact';
    await mount(<ContactScreen />);
    await act(async () => backButtons()[0]!.props.onPress());
    expect(landedOn()).toBe('/my');
    expect(router.dismissTo).toHaveBeenCalledWith('/my');
  }, 15000);

  it('보낸 뒤 완료 화면에서도 MY로 올라간다', async () => {
    mockPathname = '/my/contact';
    jest.mocked(createInquiry).mockResolvedValue({ acknowledgement: '확인 후 알려드려요' } as never);
    await mount(<ContactScreen />);
    const send = tree.root
      .findAllByType('ActionButton' as never)
      .find((node) => node.props.label === '보내기')!;

    await act(async () => { await send.props.onPress(); });
    await act(async () => backButtons()[0]!.props.onPress());
    expect(landedOn()).toBe('/my');
  });

  it('딥링크 직접 진입: 되짚을 기록이 없어도 MY로 갈아끼운다', async () => {
    mockPathname = '/my/contact';
    asDeepLink();
    await mount(<ContactScreen />);
    await act(async () => backButtons()[0]!.props.onPress());
    expect(landedOn()).toBe('/my');
    expect(router.replace).toHaveBeenCalledWith('/my');
  });
});

describe('/my/taste — 저장 완료·불러오기 실패', () => {
  const me = { weddingDate: '2026-10-10', region: '서울', styleTags: ['URBAN'] };

  it('정상 진입: 저장 완료 알림의 「확인」이 MY로 올라간다', async () => {
    mockPathname = '/my/taste';
    jest.mocked(getCurrentUser).mockResolvedValue(me as never);
    jest.mocked(completeSetup).mockResolvedValue({} as never);
    await mount(<StyleScreen />);
    await act(async () => {
      await tree.root.findByType('SubScreen' as never).props.right.props.onPress();
    });

    const [, , buttons] = jest.mocked(confirmAlert).mock.calls[0]!;

    await act(async () => buttons![0]!.onPress!());
    expect(landedOn()).toBe('/my');
  });

  it('오류 상태: 불러오기 실패 화면도 MY로 올라간다', async () => {
    mockPathname = '/my/taste';
    jest.mocked(getCurrentUser).mockRejectedValue(new Error('offline'));
    await mount(<StyleScreen />);
    await act(async () => tree.root.findByType('ErrorView' as never).props.onBack());
    expect(landedOn()).toBe('/my');
  });

  it('딥링크 직접 진입: 오류 화면에서도 MY로 갈아끼운다', async () => {
    mockPathname = '/my/taste';
    asDeepLink();
    jest.mocked(getCurrentUser).mockRejectedValue(new Error('offline'));
    await mount(<StyleScreen />);
    await act(async () => tree.root.findByType('ErrorView' as never).props.onBack());
    expect(landedOn()).toBe('/my');
    expect(router.replace).toHaveBeenCalledWith('/my');
  });
});

describe('/pick/category — 후보 목록 하단·오류', () => {
  const me = { weddingId: 'w-1' };

  it('정상 진입: 「돌아가기」가 Pick 탭으로 올라간다', async () => {
    mockPathname = '/pick/category';
    jest.mocked(getCurrentUser).mockResolvedValue(me as never);
    jest.mocked(listCandidates).mockResolvedValue({ groups: [] } as never);
    await mount(<PickCategoryScreen />);
    await act(async () => backButtons()[0]!.props.onPress());
    expect(landedOn()).toBe('/pick');
  });

  it('오류 상태: 후보를 못 불러와도 Pick 탭으로 올라간다', async () => {
    mockPathname = '/pick/category';
    jest.mocked(getCurrentUser).mockRejectedValue(new Error('offline'));
    await mount(<PickCategoryScreen />);
    await act(async () => tree.root.findByType('ErrorView' as never).props.onBack());
    expect(landedOn()).toBe('/pick');
  });

  it('딥링크 직접 진입: 되짚을 기록이 없어도 Pick 탭으로 갈아끼운다', async () => {
    mockPathname = '/pick/category';
    asDeepLink();
    jest.mocked(getCurrentUser).mockResolvedValue(me as never);
    jest.mocked(listCandidates).mockResolvedValue({ groups: [] } as never);
    await mount(<PickCategoryScreen />);
    await act(async () => backButtons()[0]!.props.onPress());
    expect(landedOn()).toBe('/pick');
    expect(router.replace).toHaveBeenCalledWith('/pick');
  });
});
