import { Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { AdminRoleProvider, WritePressable, type AdminRole } from '@/app/admin/_role';
import { ConfirmCard, Rows, Toggle } from '@/app/admin/_ui';

/**
 * 뷰어는 조회만 한다(2026-09-25 대표 지시 — 「관리자 계정 뷰어 권한은 모든 등록,
 * 수정, 삭제 버튼 비활성화다」). 쓰기 단추는 **보이되 눌리지 않는다.**
 *
 * 막는 것은 서버다(`apps/api/src/test/admin-write-guard.test.ts`). 여기서 보는 것은
 * 화면이 그 사실을 누르기 전에 보여주는가 — 공용 부품(확인 카드 · 토글 · 행 단추)과
 * `WritePressable`이 등급을 따라 잠기는가다.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

function render(role: AdminRole | null, node: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<AdminRoleProvider value={role}>{node}</AdminRoleProvider>);
  });
  return tree;
}

/** 글자에서 위로 올라가 처음 만나는 눌리는 자리. */
function pressableAbove(node: ReactTestInstance): ReactTestInstance {
  let current: ReactTestInstance | null = node;
  while (current && typeof current.props.onPress !== 'function') current = current.parent;
  if (!current) throw new Error('눌리는 자리를 찾지 못했다.');
  return current;
}

/** 이름이 `label`인 단추가 눌리지 않게 잠겼는가. */
function lockedButton(tree: ReactTestRenderer, label: string): boolean {
  const text = tree.root.findAllByType(Text).find((node) => node.props.children === label);
  if (!text) throw new Error(`「${label}」 단추를 찾지 못했다.`);
  return pressableAbove(text).props.disabled === true;
}

describe('관리자 뷰어 — 쓰기 단추 잠금', () => {
  const save = (
    <WritePressable onPress={() => undefined}>
      <Text>저장</Text>
    </WritePressable>
  );

  it('뷰어에게는 쓰기 단추가 잠기고 운영자 · 슈퍼에게는 열린다', () => {
    expect(lockedButton(render('viewer', save), '저장')).toBe(true);
    expect(lockedButton(render('operator', save), '저장')).toBe(false);
    expect(lockedButton(render('super', save), '저장')).toBe(false);
  });

  it('등급을 아직 모르면 막지 않는다 — 서버가 마지막 관문이다', () => {
    expect(lockedButton(render(null, save), '저장')).toBe(false);
  });

  it('확인 카드의 확인 단추는 잠기고 취소는 눌린다', () => {
    const tree = render(
      'viewer',
      <ConfirmCard title="지울까요?" body="되돌릴 수 없어요." items={['업체 한 곳']} cta="삭제" danger onConfirm={() => undefined} onCancel={() => undefined} />
    );
    expect(lockedButton(tree, '삭제')).toBe(true);
    expect(lockedButton(tree, '취소')).toBe(false);
  });

  it('켜기 · 끄기 토글과 쓰기 행 단추가 잠긴다 — 읽기 행 단추는 그대로다', () => {
    const toggle = render('viewer', <Toggle on onPress={() => undefined} />);
    // 첫 줄은 `Toggle` 자신이고, 그 아래 실제로 눌리는 자리가 잠겨 있어야 한다.
    const switches = toggle.root.findAll((node) => node.props.accessibilityRole === 'switch');
    expect(switches.some((node) => node.props.disabled === true)).toBe(true);

    const rows = render(
      'viewer',
      <Rows
        items={[
          { key: 'a', name: '규칙', btn: { label: '수정', onPress: () => undefined, write: true } },
          { key: 'b', name: '기록', btn: { label: '열기', onPress: () => undefined } },
        ]}
      />
    );
    expect(lockedButton(rows, '수정')).toBe(true);
    expect(lockedButton(rows, '열기')).toBe(false);
  });
});
