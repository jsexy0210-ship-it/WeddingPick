import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Switch } from 'react-native';
import { router } from 'expo-router';
import { listNotifications, readNotification, readAllNotifications, getCurrentUser, getSettings, setDisplayName, updateSettings, searchVendors, listVendorRegions } from '@/api/client';
import NotificationsScreen from '@/app/(tabs)/my/notifications';
import ProfileScreen from '@/app/(tabs)/my/profile';
import AutocompleteScreen from '@/app/(tabs)/search/autocomplete';
import PriceReportScreen from '@/app/(tabs)/search/[vendorId]/price-report';

jest.mock('react-native', () => Object.setPrototypeOf({ Switch: 'Switch' }, jest.requireActual('react-native')));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Redirect: 'Redirect',
  useLocalSearchParams: () => ({ q: '검수', vendorId: 'vendor-1' }),
}));
jest.mock('@/api/client', () => ({
  listNotifications: jest.fn(), readNotification: jest.fn(), readAllNotifications: jest.fn(),
  getCurrentUser: jest.fn(), getSettings: jest.fn(), setDisplayName: jest.fn(), updateSettings: jest.fn(), searchVendors: jest.fn(), listVendorRegions: jest.fn(),
}));
jest.mock('@/components/back-bar', () => ({ BackBar: 'BackBar' }));
/*
 * 세션 상태를 시험마다 바꿔 끼운다. `jest.mock`은 끌어올려지므로 이름이 `mock`으로
 * 시작해야 밖의 값을 읽을 수 있다.
 *
 * 기본은 로그인된 상태다 — 아래 시험 대부분이 화면 내용을 보는 것이고, 로그아웃이면
 * 관문에 걸려 화면이 안 그려진다.
 */
const mockSession: { state: { status: string; kind?: string } } = { state: { status: 'signedIn' } };
jest.mock('@/features/auth/use-session', () => ({
  useSession: () => ({ state: mockSession.state, refresh: jest.fn(), signOut: jest.fn() }),
}));
jest.mock('@/features/settings/version', () => ({ APP_VERSION: '1.0.0' }));
jest.mock('@/features/common/bottom-sheet', () => ({ BottomSheet: 'BottomSheet', SHEET_PANEL: {} }));
jest.mock('@/features/wedding/screen-kit', () => ({ NavBar: 'NavBar' }));
jest.mock('@/features/loading/delayed-loader', () => ({ DelayedLoadingView: 'Loading' }));
jest.mock('@/features/settings/my-kit', () => ({
  Avatar: 'Avatar', EmptyBox: 'EmptyBox', NavAction: 'NavAction', Section: 'Section', SubScreen: 'SubScreen',
  NoteBox: 'NoteBox', Row: (props: { right?: React.ReactNode }) =>
    jest.requireActual('react').createElement('Row', props, props.right), Rows: 'Rows',
}));
jest.mock('@weddingpick/ui', () => ({
  ErrorView: 'ErrorView', ThemedText: 'ThemedText', Toast: 'Toast', ThemedView: 'ThemedView', ActionButton: 'ActionButton', Skeleton: 'Skeleton',
  Border: { hairline: 1 }, FontSize: {}, Layout: {}, Radius: {}, Spacing: {}, useTheme: () => ({}), readWebInteractionState: () => ({}),
}));

const notice = { id: 'n-1', kind: 'partner', kindLabel: '배우자', title: '연결됐어요', body: '확인해주세요',
  targetId: null, createdAt: '2026-09-10T00:00:00Z', readAt: null };
const settings = { pushEnabled: true, priceChangeEnabled: true, marketingEnabled: false, nightPushEnabled: false };
const currentUser = { userId: 'user-1', displayName: '지수' };
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let tree: ReactTestRenderer;
async function mount(element: React.ReactElement) { await act(async () => { tree = create(element); }); }
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
beforeEach(() => {
  jest.mocked(listNotifications).mockResolvedValue({ notifications: [notice], unread: 7, total: 7 } as never);
  jest.mocked(getCurrentUser).mockResolvedValue(currentUser as never);
  jest.mocked(getSettings).mockResolvedValue(settings as never);
  jest.mocked(setDisplayName).mockResolvedValue({ displayName: '지수' } as never);
});

describe('알림 이동과 읽음 복구', () => {
  it('읽음 응답을 기다리지 않고 목적지로 이동하며 중복 저장을 막는다', async () => {
    const pending = deferred();
    jest.mocked(readNotification).mockReturnValue(pending.promise as never);
    await mount(<NotificationsScreen />);
    const press = tree.root.findAll((node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0]!.props.onPress;
    await act(async () => { press(); press(); });
    expect(router.push).toHaveBeenCalledWith('/wedding/partner');
    expect(readNotification).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ unread: 6, total: 7 }));
  });

  it('개별 읽음 실패 뒤 다시 눌러 저장할 수 있다', async () => {
    jest.mocked(readNotification).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ unread: 6, total: 7 });
    await mount(<NotificationsScreen />);
    await act(async () => tree.root.findAll((node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0]!.props.onPress());
    expect(tree.root.findByType('Toast' as never).props.message).toBe('읽음 상태를 저장하지 못했어요');
    await act(async () => tree.root.findAll((node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0]!.props.onPress());
    expect(readNotification).toHaveBeenCalledTimes(2);
  });

  it('모두 읽음 실패 뒤 목록 밖 미확인 개수도 보존한다', async () => {
    jest.mocked(readAllNotifications).mockRejectedValueOnce(new Error('offline'));
    const pending = deferred();
    jest.mocked(readNotification).mockReturnValue(pending.promise as never);
    await mount(<NotificationsScreen />);
    const nav = tree.root.findByType('SubScreen' as never).props.right;
    await act(async () => { await nav.props.onPress(); });
    await act(async () => tree.root.findAll((node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0]!.props.onPress());
    // 복구 때 목록의 한 건만 세었으면 개별 읽음 후 모두 읽음 버튼이 사라진다.
    expect(tree.root.findByType('SubScreen' as never).props.right).not.toBeNull();
    await act(async () => pending.resolve({ unread: 6, total: 7 }));
  });
});

/*
 * v3.29 — 알림 설정은 별도 화면(옛 `my/notification-settings.tsx`, 시안 ID
 * 「13-my-sub WP-MY-007」)이 아니라 프로필(WP-MY-002 «알림» 섹션)이 흡수했다.
 * 그 화면은 어디서도 이동하지 않는 고아 라우트였다 — `대메뉴_MY.dc.html`의
 * `mySections`에도 독립 알림 화면이 없다. 지우면서 그 화면이 지키던 저장 경합 ·
 * 「서비스 알림 한 줄」 시험은 같은 로직을 쓰는 ProfileScreen으로 옮겨 그대로 둔다.
 */
describe('프로필 알림 저장 경합', () => {
  it('저장 응답 전 두 번째 토글을 차단하고 완료 후 다시 활성화한다', async () => {
    const pending = deferred();
    jest.mocked(updateSettings).mockReturnValue(pending.promise as never);
    await mount(<ProfileScreen />);
    const switches = tree.root.findAllByType(Switch);
    await act(async () => { switches[0]!.props.onValueChange(false); switches[1]!.props.onValueChange(false); });
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(Switch).every((node) => node.props.disabled)).toBe(true);
    await act(async () => pending.resolve({ ...settings, pushEnabled: false }));
    expect(tree.root.findAllByType(Switch).every((node) => !node.props.disabled)).toBe(true);
  });

  it('저장 실패 시 원래 값으로 되돌리고 다시 시도할 수 있다', async () => {
    jest.mocked(updateSettings).mockRejectedValue(new Error('offline'));
    await mount(<ProfileScreen />);
    await act(async () => tree.root.findAllByType(Switch)[0]!.props.onValueChange(false));
    const toggle = tree.root.findAllByType(Switch)[0]!;
    expect(toggle.props.value).toBe(true);
    expect(toggle.props.disabled).toBe(false);
  });
});

describe('정본 알림 설정', () => {
  it('서비스 알림 한 줄로 전체 푸시와 가격 변동 푸시를 함께 바꾼다', async () => {
    jest.mocked(updateSettings).mockResolvedValue({
      ...settings,
      pushEnabled: false,
      priceChangeEnabled: false,
    } as never);

    await mount(<ProfileScreen />);
    await act(async () => tree.root.findAllByType(Switch)[0]!.props.onValueChange(false));

    expect(updateSettings).toHaveBeenCalledWith({
      pushEnabled: false,
      priceChangeEnabled: false,
    });
    expect(tree.root.findAllByType(Switch)).toHaveLength(3);
  });

  it('서비스 알림은 실제 마스터 게이트인 전체 푸시 값을 표시한다', async () => {
    jest.mocked(getSettings).mockResolvedValueOnce({
      ...settings,
      pushEnabled: false,
      priceChangeEnabled: true,
    } as never);
    jest.mocked(updateSettings).mockResolvedValue({
      ...settings,
      pushEnabled: true,
      priceChangeEnabled: true,
    } as never);

    await mount(<ProfileScreen />);
    const service = tree.root.findAllByType(Switch)[0]!;
    expect(service.props.value).toBe(false);
    await act(async () => service.props.onValueChange(true));
    expect(updateSettings).toHaveBeenCalledWith({
      pushEnabled: true,
      priceChangeEnabled: true,
    });
  });
});

it('프로필은 알림 설정 조회가 실패해도 계정 기능을 계속 보여준다', async () => {
  jest.mocked(getSettings).mockRejectedValueOnce(new Error('offline'));

  await mount(<ProfileScreen />);

  expect(tree.root.findAllByType('ErrorView' as never)).toHaveLength(0);
  const rows = tree.root.findAllByType('Row' as never);
  expect(rows.some((node) => node.props.name === '로그아웃')).toBe(true);
  expect(rows.some((node) => node.props.name === '회원탈퇴')).toBe(true);
  expect(tree.root.findAllByType('ActionButton' as never).some((node) => node.props.label === '다시 불러오기')).toBe(true);
});

/*
 * v3.28 — 「이름 / 배우자에게 보이는 이름」 두 칸이 「닉네임」 한 칸이 됐다.
 * 두 칸 시절의 「연결 계정에서 확인」 줄이 되살아나지 않는지도 같이 센다.
 */
it('프로필의 닉네임 한 칸이 displayName 편집을 연다', async () => {
  await mount(<ProfileScreen />);
  const rows = tree.root.findAllByType('Row' as never);
  const nickname = rows.find((node) => node.props.name === '닉네임');
  expect(rows.some((node) => node.props.name === '배우자에게 보이는 이름')).toBe(false);
  expect(rows.some((node) => node.props.tail === '연결 계정에서 확인')).toBe(false);
  expect(nickname?.props.tail).toBe('지수');
  expect(nickname?.props.onPress).toEqual(expect.any(Function));
});

it('폐기된 수동 가격 제보 링크는 Pick 인증 동의로 연결한다', async () => {
  mockSession.state = { status: 'signedIn' };
  await mount(<PriceReportScreen />);
  expect(tree.root.findByType('Redirect' as never).props.href).toBe(
    '/capture/payment/consent?from=vendor/vendor-1'
  );
});

/*
 * 2026-09-17 전수 검수에서 잡힌 것. 넘기기만 하는 화면이 로그인을 안 보면, 앞서
 * `/login`으로 간 주소를 이 `<Redirect>`가 덮어써서 **로그아웃 상태로 안쪽 화면에
 * 들어간다.** `app/_layout.tsx`의 관문은 한 번만 돌기 때문에 되돌려 주지 않는다.
 *
 * 같은 모양이 `my/membership.tsx`에도 있고 그쪽이 실제로 새 나갔다 —
 * 만료 토큰으로 열면 미션 화면의 오류 화면에 멈췄다. 이쪽은 주소에 `[vendorId]`가
 * 들어가 검수 대상(정적 62장)에서 빠져 있었을 뿐이다.
 */
it('로그아웃 상태면 넘기지 않고 로그인으로 보낸다', async () => {
  mockSession.state = { status: 'signedOut' };
  try {
    await mount(<PriceReportScreen />);
    expect(tree.root.findByType('Redirect' as never).props.href).toBe('/login');
  } finally {
    mockSession.state = { status: 'signedIn' };
  }
});

it('자동완성 업체조회 실패는 검색결과 없음 대신 오류를 표시하고 재시도한다', async () => {
  jest.useFakeTimers();
  jest.mocked(searchVendors).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ vendors: [] } as never);
  jest.mocked(listVendorRegions).mockResolvedValue({ regions: [] });
  try {
    await mount(<AutocompleteScreen />);
    await act(async () => { jest.advanceTimersByTime(201); });
    const error = tree.root.findByType('ErrorView' as never);
    expect(error.props.title).toBe('제안을 불러오지 못했어요');
    await act(async () => error.props.onRetry());
    expect(searchVendors).toHaveBeenCalledTimes(2);
    expect(tree.root.findAllByType('ErrorView' as never)).toHaveLength(0);
  } finally { jest.useRealTimers(); }
});
