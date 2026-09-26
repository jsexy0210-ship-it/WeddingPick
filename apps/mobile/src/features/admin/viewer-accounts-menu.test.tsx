import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { apiFetch } from '@/app/admin/_api';
import { adminDocumentTitle, Sidebar } from '@/app/admin/_layout';
import { AdminRoleProvider, AdminRoleSettledProvider, type AdminRole } from '@/app/admin/_role';
import UsersShell from '@/app/admin/users';

/**
 * 뷰어에게 관리자 계정 목록을 열지 않는다(2026-09-25 대표 지시 — 「뷰어에게 관리자
 * 계정 목록은 열지 마」 · 「메뉴에서도 빼」).
 *
 * 계정·권한 화면에서 관리자 계정 탭을 숨기고, `?tab=admins`로 들어와도 앱 회원을
 * 그린다. 사이드바 줄 이름과 문서 제목도 뷰어에게는 「앱 회원」이다 — 한 화면에
 * 이름 하나. 목록 자체는 서버가 슈퍼 전용으로 막는다(`requireSuperAdmin`).
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

let mockTab: string | undefined;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => (mockTab === undefined ? {} : { tab: mockTab }),
  Redirect: () => null,
  /* `asChild` 링크 — 자식(`Pressable`)을 그대로 그린다. */
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/app/admin/_api', () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

/** `settled`는 레이아웃의 등급 읽기가 끝났는가 — 기본은 끝난 상태다. */
function withRole(role: AdminRole | null, node: React.ReactElement, settled = true): React.ReactElement {
  return (
    <AdminRoleProvider value={role}>
      <AdminRoleSettledProvider value={settled}>{node}</AdminRoleSettledProvider>
    </AdminRoleProvider>
  );
}

/** 그린 트리는 시험마다 내린다 — 로더의 지연 타이머가 파일이 끝난 뒤에 돌지 않게. */
const mounted: ReactTestRenderer[] = [];

function render(role: AdminRole | null, node: React.ReactElement, settled = true): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(withRole(role, node, settled));
  });
  mounted.push(tree);
  return tree;
}

function texts(tree: ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .filter((child): child is string => typeof child === 'string');
}

/** 상단 탭 줄(`role="tab"`)에 뜬 이름. */
function tabLabels(tree: ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => node.props.role === 'tab' && typeof node.props.onPress === 'function')
    .map((tab) => tab.findAllByType(Text)[0]?.props.children as string);
}

function requestedPaths(): string[] {
  return mockApiFetch.mock.calls.map(([path]) => path);
}

beforeEach(() => {
  mockTab = undefined;
  /* 응답은 돌려주지 않는다 — 어느 패널이 무엇을 부르는지만 본다. */
  mockApiFetch.mockImplementation(() => new Promise(() => undefined));
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
});

describe('계정·권한 화면 — 관리자 계정 탭', () => {
  it('뷰어에게는 관리자 계정 탭이 없고 앱 회원만 보인다', () => {
    const tree = render('viewer', <UsersShell />);
    expect(tabLabels(tree)).toEqual(['앱 회원']);
    expect(requestedPaths()).toEqual(['/v1/admin/users']);
  });

  it('슈퍼 · 운영자에게는 두 탭이 그대로다', () => {
    expect(tabLabels(render('super', <UsersShell />))).toEqual(['앱 회원', '관리자 계정']);
    expect(tabLabels(render('operator', <UsersShell />))).toEqual(['앱 회원', '관리자 계정']);
  });

  it('뷰어가 `?tab=admins`로 들어와도 권한 오류 대신 앱 회원을 그린다 — 목록 요청이 나가지 않는다', () => {
    mockTab = 'admins';
    const tree = render('viewer', <UsersShell />);
    expect(tabLabels(tree)).toEqual(['앱 회원']);
    expect(requestedPaths()).toEqual(['/v1/admin/users']);
    expect(requestedPaths()).not.toContain('/v1/admin/accounts');
    expect(texts(tree)).not.toContain('관리자 계정');
  });

  it('등급을 읽는 중에는 관리자 계정 목록을 요청하지 않는다 — 뷰어로 확인되면 앱 회원을 그린다', () => {
    mockTab = 'admins';
    const tree = render(null, <UsersShell />, false);
    // 403이 등급보다 먼저 와서 권한 오류가 스치던 자리 — 요청 자체가 없다.
    expect(requestedPaths()).toEqual([]);

    act(() => {
      tree.update(withRole('viewer', <UsersShell />));
    });
    expect(tabLabels(tree)).toEqual(['앱 회원']);
    expect(requestedPaths()).toEqual(['/v1/admin/users']);
  });

  it('등급 읽기가 실패로 끝나면 평소대로 관리자 계정을 연다 — 막는 것은 서버다', () => {
    mockTab = 'admins';
    render(null, <UsersShell />, true);
    expect(requestedPaths()).toEqual(['/v1/admin/accounts']);
  });

  it('슈퍼가 `?tab=admins`로 들어오면 관리자 계정 목록을 연다', () => {
    mockTab = 'admins';
    const tree = render('super', <UsersShell />);
    expect(requestedPaths()).toEqual(['/v1/admin/accounts']);
    expect(texts(tree)).toContain('관리자 계정');
  });
});

describe('사이드바 · 문서 제목 — 한 화면에 이름 하나', () => {
  it('뷰어의 사이드바 줄은 「앱 회원」, 슈퍼는 「앱 회원 · 관리자 계정」이다', () => {
    const viewer = texts(render('viewer', <Sidebar pathname="/admin/users" compact={false} />));
    expect(viewer).toContain('앱 회원');
    expect(viewer).not.toContain('앱 회원 · 관리자 계정');

    const superAdmin = texts(render('super', <Sidebar pathname="/admin/users" compact={false} />));
    expect(superAdmin).toContain('앱 회원 · 관리자 계정');
    expect(superAdmin).not.toContain('앱 회원');
  });

  it('등급을 아직 모르면 기본 이름이다', () => {
    expect(texts(render(null, <Sidebar pathname="/admin/home" compact={false} />))).toContain('앱 회원 · 관리자 계정');
  });

  it('문서 제목은 그 등급이 보는 사이드바 이름을 쓴다', () => {
    expect(adminDocumentTitle('/admin/users', 'viewer')).toBe('앱 회원 — 웨딩픽 관리자');
    expect(adminDocumentTitle('/admin/users', 'super')).toBe('앱 회원 · 관리자 계정 — 웨딩픽 관리자');
    expect(adminDocumentTitle('/admin/users', 'operator')).toBe('앱 회원 · 관리자 계정 — 웨딩픽 관리자');
    expect(adminDocumentTitle('/admin/users')).toBe('앱 회원 · 관리자 계정 — 웨딩픽 관리자');
    // 다른 메뉴는 등급과 무관하다.
    expect(adminDocumentTitle('/admin/home', 'viewer')).toBe('대시보드 — 웨딩픽 관리자');
  });
});
