import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';

import { getCurrentUser, completeSetup, createInquiry, listFaq, listMyInquiries } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import ContactScreen from '@/app/(tabs)/my/contact';
import StyleScreen from '@/app/(tabs)/my/taste';

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
  /* 문의 화면은 자주 묻는 것을 위에 띄운다 — 2026-09-16부터 서버에서 받아 온다. */
  listFaq: jest.fn(),
}));
jest.mock('@/api/config', () => ({ isServerConfigured: true }));
jest.mock('@/components/back-bar', () => ({ BackBar: 'BackBar' }));
jest.mock('@/components/confirm-alert', () => ({ confirmAlert: jest.fn() }));
jest.mock('@/features/loading/delayed-loader', () => ({ DelayedLoadingView: 'Loading' }));
jest.mock('@/features/onboarding/inline-toast', () => ({
  InlineToast: 'InlineToast',
  useInlineToast: () => ({ toast: null, show: jest.fn(), hide: jest.fn() }),
}));
jest.mock('@/features/onboarding/option-row', () => ({ OptionRow: 'OptionRow' }));
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

/** 문의 화면 헤더 Back. 현재 화면은 BackBar가 기본 출구다. */
function contactBack() {
  return tree.root.findByType('BackBar' as never).props.onBack as () => void;
}

describe('/my/contact — 문의 완료·목록 하단', () => {
  beforeEach(() => {
    jest.mocked(listMyInquiries).mockResolvedValue({ inquiries: [] } as never);
    /* `resetMocks: true`가 매번 구현을 지운다 — 여기서 다시 붙여야 한다. */
    jest.mocked(listFaq).mockResolvedValue({ items: [] } as never);
  });

  it('정상 진입: 「돌아가기」가 MY로 올라간다', async () => {
    mockPathname = '/my/contact';
    await mount(<ContactScreen />);
    await act(async () => contactBack()());
    expect(landedOn()).toBe('/my');
    expect(router.dismissTo).toHaveBeenCalledWith('/my');
  });

  it('보낸 뒤 완료 화면에서도 MY로 올라간다', async () => {
    mockPathname = '/my/contact';
    jest.mocked(createInquiry).mockResolvedValue({ acknowledgement: '확인 후 알려드려요' } as never);
    await mount(<ContactScreen />);
    const send = tree.root
      .findAllByType('ActionButton' as never)
      .find((node) => node.props.label === '문의 보내기')!;

    await act(async () => { await send.props.onPress(); });
    await act(async () => contactBack()());
    expect(landedOn()).toBe('/my');
  });

  it('딥링크 직접 진입: 되짚을 기록이 없어도 MY로 갈아끼운다', async () => {
    mockPathname = '/my/contact';
    asDeepLink();
    await mount(<ContactScreen />);
    await act(async () => contactBack()());
    expect(landedOn()).toBe('/my');
    expect(router.replace).toHaveBeenCalledWith('/my');
  });

  it('기록이 있어도 MY 문의의 논리 부모인 MY 홈으로 간다', async () => {
    mockPathname = '/my/contact';
    jest.mocked(router.canGoBack).mockReturnValueOnce(true);
    await mount(<ContactScreen />);
    await act(async () => contactBack()());
    expect(router.back).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenCalledWith('/my');
    expect(router.replace).not.toHaveBeenCalled();
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
