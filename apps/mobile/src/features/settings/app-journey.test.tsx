import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Switch } from 'react-native';
import { router } from 'expo-router';
import { listNotifications, readNotification, readAllNotifications, getSettings, updateSettings, searchVendors, listVendorRegions } from '@/api/client';
import NotificationsScreen from '@/app/(tabs)/my/notifications';
import NotificationSettingsScreen from '@/app/(tabs)/my/notification-settings';
import AccountScreen from '@/app/(tabs)/my/account';
import SettingsScreen from '@/app/(tabs)/my/settings';
import AutocompleteScreen from '@/app/(tabs)/search/autocomplete';
import PriceReportScreen from '@/app/(tabs)/search/[vendorId]/price-report';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Redirect: 'Redirect', useLocalSearchParams: () => ({ q: '검수' }) }));
jest.mock('@/api/client', () => ({
  listNotifications: jest.fn(), readNotification: jest.fn(), readAllNotifications: jest.fn(),
  getSettings: jest.fn(), updateSettings: jest.fn(), searchVendors: jest.fn(), listVendorRegions: jest.fn(),
}));
jest.mock('@/components/back-bar', () => ({ BackBar: 'BackBar' }));
jest.mock('@/features/auth/use-session', () => ({ useSession: () => ({ signOut: jest.fn() }) }));
jest.mock('@/features/settings/version', () => ({ APP_VERSION: '1.0.0' }));
jest.mock('@/features/common/bottom-sheet', () => ({ BottomSheet: 'BottomSheet', SHEET_PANEL: {} }));
jest.mock('@/features/wedding/screen-kit', () => ({ NavBar: 'NavBar' }));
jest.mock('@/features/loading/delayed-loader', () => ({ DelayedLoadingView: 'Loading' }));
jest.mock('@/features/settings/my-kit', () => ({
  EmptyBox: 'EmptyBox', NavAction: 'NavAction', Section: 'Section', SubScreen: 'SubScreen',
  NoteBox: 'NoteBox', Row: (props: { right?: React.ReactNode }) => props.right ?? null, Rows: 'Rows',
}));
jest.mock('@weddingpick/ui', () => ({
  ErrorView: 'ErrorView', ThemedText: 'ThemedText', Toast: 'Toast', ThemedView: 'ThemedView', ActionButton: 'ActionButton', Skeleton: 'Skeleton',
  Layout: {}, Radius: {}, Spacing: {}, useTheme: () => ({}), readWebInteractionState: () => ({}),
}));

const notice = { id: 'n-1', kind: 'partner', kindLabel: '배우자', title: '연결됐어요', body: '확인해주세요',
  targetId: null, createdAt: '2026-09-10T00:00:00Z', readAt: null };
const settings = { pushEnabled: true, priceChangeEnabled: true };
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
  jest.mocked(getSettings).mockResolvedValue(settings as never);
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

describe.each([['알림 설정', NotificationSettingsScreen], ['계정', AccountScreen], ['설정', SettingsScreen]] as const)('%s 저장 경합', (_name, Component) => {
  it('저장 응답 전 두 번째 토글을 차단하고 완료 후 다시 활성화한다', async () => {
    const pending = deferred();
    jest.mocked(updateSettings).mockReturnValue(pending.promise as never);
    await mount(<Component />);
    const switches = tree.root.findAllByType(Switch);
    await act(async () => { switches[0]!.props.onValueChange(false); switches[1]!.props.onValueChange(false); });
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(Switch).every((node) => node.props.disabled)).toBe(true);
    await act(async () => pending.resolve({ ...settings, pushEnabled: false }));
    expect(tree.root.findAllByType(Switch).every((node) => !node.props.disabled)).toBe(true);
  });

  it('저장 실패 시 원래 값으로 되돌리고 다시 시도할 수 있다', async () => {
    jest.mocked(updateSettings).mockRejectedValue(new Error('offline'));
    await mount(<Component />);
    await act(async () => tree.root.findAllByType(Switch)[0]!.props.onValueChange(false));
    const toggle = tree.root.findAllByType(Switch)[0]!;
    expect(toggle.props.value).toBe(true);
    expect(toggle.props.disabled).toBe(false);
  });
});

it('폐기된 수동 가격 제보 링크는 Pick 인증 동의로 연결한다', async () => {
  await mount(<PriceReportScreen />);
  expect(tree.root.findByType('Redirect' as never).props.href).toBe('/capture/payment/consent');
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
