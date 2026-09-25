import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Switch } from 'react-native';
import { getCurrentUser, getSettings, setDisplayName, updateSettings } from '@/api/client';
import ProfileScreen from '@/app/(tabs)/my/profile';

jest.mock('react-native', () => Object.setPrototypeOf({ Switch: 'Switch' }, jest.requireActual('react-native')));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Redirect: 'Redirect',
  useLocalSearchParams: () => ({ q: '검수', vendorId: 'vendor-1' }),
}));
jest.mock('@/api/client', () => ({
  getCurrentUser: jest.fn(), getSettings: jest.fn(), setDisplayName: jest.fn(), updateSettings: jest.fn(),
}));
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
  jest.mocked(getCurrentUser).mockResolvedValue(currentUser as never);
  jest.mocked(getSettings).mockResolvedValue(settings as never);
  jest.mocked(setDisplayName).mockResolvedValue({ displayName: '지수' } as never);
});

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
  // 정본 docs/design/React_Native/my.jsx:157(frame-002) — 프로필 계정 행은 「회원 탈퇴」다.
  expect(rows.some((node) => node.props.name === '회원 탈퇴')).toBe(true);
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
