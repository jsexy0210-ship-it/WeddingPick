import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useEffect } from 'react';
import { ApiError, getCurrentUser } from '@/api/client';
import { loadToken } from '@/api/session';
import { useSession } from './use-session';

let mockFocus: () => () => void;
jest.mock('expo-router', () => ({ useFocusEffect: (callback: typeof mockFocus) => { mockFocus = callback; } }));
jest.mock('@/api/config', () => ({ isServerConfigured: true }));
jest.mock('@/api/client', () => ({
  ApiError: class extends Error {
    constructor(code: string, message: string, status: number | null) { super(message); Object.assign(this, { code, status }); }
  },
  getCurrentUser: jest.fn(), signOut: jest.fn(),
}));
jest.mock('@/api/session', () => ({ loadToken: jest.fn() }));
jest.mock('@/features/notifications/register-device', () => ({ registerForPushNotifications: jest.fn() }));

let session: ReturnType<typeof useSession>;
let tree: ReactTestRenderer;
function Probe() {
  const value = useSession();
  useEffect(() => { session = value; }, [value]);
  return null;
}
beforeEach(async () => {
  jest.mocked(loadToken).mockResolvedValue('fixture-session');
  jest.mocked(getCurrentUser).mockResolvedValue({ userId: 'fixture-member' } as never);
  await act(async () => { tree = create(<Probe />); });
});
afterEach(() => { act(() => tree.unmount()); });

it.each([null, 500, 503])('처음 확인이 %s로 실패하면 복구 상태를 보여주고 다시 확인할 수 있다', async (status) => {
  jest.mocked(getCurrentUser).mockRejectedValueOnce(new ApiError('internal', 'fixture error', status));
  await act(async () => { await session.refresh(); });
  expect(session.state).toMatchObject({ status: 'error' });
  await act(async () => { await session.refresh(); });
  expect(session.state).toEqual({ status: 'signedIn', userId: 'fixture-member' });
});

it('같은 세션의 일시 실패는 이미 확인한 회원 상태를 지우지 않는다', async () => {
  await act(async () => { await session.refresh(); });
  jest.mocked(getCurrentUser).mockRejectedValue(new ApiError('internal', 'fixture error', 500));
  await act(async () => { await session.refresh(); });
  expect(session.state).toEqual({ status: 'signedIn', userId: 'fixture-member' });
});

it('401이 확인되면 이전 회원 상태도 지운다', async () => {
  await act(async () => { await session.refresh(); });
  jest.mocked(getCurrentUser).mockRejectedValue(new ApiError('unauthenticated', 'expired', 401));
  await act(async () => { await session.refresh(); });
  expect(session.state).toEqual({ status: 'signedOut' });
});

it('다른 계정의 확인이 실패하면 이전 회원 상태를 재사용하지 않는다', async () => {
  await act(async () => { await session.refresh(); });
  jest.mocked(loadToken).mockResolvedValue('new-session');
  jest.mocked(getCurrentUser).mockRejectedValue(new ApiError('internal', 'fixture error', 500));
  await act(async () => { await session.refresh(); });
  expect(session.state).toMatchObject({ status: 'error' });
});

it('focus를 떠난 뒤 도착한 응답은 세션 상태를 바꾸지 않는다', async () => {
  let finish!: (value: never) => void;
  jest.mocked(getCurrentUser).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  let cleanup!: () => void;
  await act(async () => { cleanup = mockFocus(); });
  await act(async () => { cleanup(); finish({ userId: 'late-member' } as never); });
  expect(session.state).toEqual({ status: 'loading' });
});
