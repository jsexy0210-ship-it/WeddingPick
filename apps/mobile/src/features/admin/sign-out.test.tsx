import { Alert, Platform, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { AdminTabShell } from '@/app/admin/_ui';
import { askSignOut, LOGOUT_CONFIRM_TITLE, signOutWithConfirm } from '@/features/admin/sign-out';

/**
 * 관리자 로그아웃은 OS 확인창으로 한 번 묻는다(2026-09-26 대표 지시).
 * 취소 → 세션도 화면도 그대로 · 확인 → 토큰을 지우고 로그인으로.
 */
const mockClear = jest.fn(async () => undefined);
jest.mock('@/app/admin/_session', () => ({
  clearAdminToken: () => mockClear(),
  loadAdminToken: jest.fn(async () => null),
  readAdminTokenSync: () => null,
  subscribeAdminToken: () => () => undefined,
}));

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** 시험 환경의 전역 창. 속성만 바꿔 끼우고 끝나면 되돌린다 — 창 자체를 갈아 끼우지 않는다. */
const win = globalThis as unknown as Record<string, unknown>;
const saved = { confirm: win.confirm, location: win.location };
function stubWindow(confirm: () => boolean, assign?: jest.Mock): void {
  win.confirm = confirm;
  Object.defineProperty(win, 'location', { value: { assign }, configurable: true, writable: true });
}
afterAll(() => {
  win.confirm = saved.confirm;
  Object.defineProperty(win, 'location', { value: saved.location, configurable: true, writable: true });
});

describe('signOutWithConfirm', () => {
  it('취소하면 토큰을 지우지 않고 이동하지 않는다', async () => {
    const clear = jest.fn(async () => undefined);
    const go = jest.fn();
    await expect(signOutWithConfirm({ ask: async () => false, clear, go })).resolves.toBe(false);
    expect(clear).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it('확인하면 토큰을 지운 뒤 로그인으로 간다', async () => {
    const order: string[] = [];
    const clear = jest.fn(async () => { order.push('clear'); });
    const go = jest.fn(() => { order.push('go'); });
    await expect(signOutWithConfirm({ ask: async () => true, clear, go })).resolves.toBe(true);
    expect(order).toEqual(['clear', 'go']);
  });
});

describe('askSignOut — OS 확인창', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  it('웹은 window.confirm으로 「로그아웃할까요?」를 묻는다', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const confirm = jest.fn(() => false);
    stubWindow(confirm);
    await expect(askSignOut()).resolves.toBe(false);
    expect(confirm).toHaveBeenCalledWith('로그아웃할까요?');
    expect(LOGOUT_CONFIRM_TITLE).toBe('로그아웃할까요?');
  });

  it('네이티브는 Alert.alert — 취소 · 로그아웃 두 단추', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style !== 'cancel')?.onPress?.();
    });
    await expect(askSignOut()).resolves.toBe(true);
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    expect(buttons.map((b) => b.text)).toEqual(['취소', '로그아웃']);
  });
});

describe('상단 로그아웃 단추', () => {
  function pressSignOut(): void {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <AdminTabShell tabs={[{ key: 'home', label: '요약' }]} active="home" onChange={() => undefined}>
          <Text>본문</Text>
        </AdminTabShell>
      );
    });
    const text = tree.root.findAllByType(Text).find((n) => n.props.children === '로그아웃');
    let node: ReactTestInstance | null = text?.parent ?? null;
    while (node && typeof node.props.onPress !== 'function') node = node.parent;
    if (!node) throw new Error('로그아웃 단추를 찾지 못했다.');
    act(() => node!.props.onPress());
  }

  let assign: jest.Mock;
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    assign = jest.fn();
    mockClear.mockClear();
  });

  it('취소를 누르면 세션이 남고 화면이 그대로다', async () => {
    stubWindow(() => false, assign);
    pressSignOut();
    await act(flush);
    expect(mockClear).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('확인을 누르면 토큰을 지우고 /admin/login으로 간다', async () => {
    stubWindow(() => true, assign);
    pressSignOut();
    await act(flush);
    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/admin/login');
  });
});
