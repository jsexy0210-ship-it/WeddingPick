import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { CircleLoader, Motion } from '@weddingpick/ui';

import { SIGNING_IN_MESSAGE, SigningInBody } from './signing-in-view';

/**
 * **로그인 진행 표시는 로더 위 · 문구 아래가 «한 덩어리»다.**
 *
 * 2026-09-15 대표 지시 — 「로더는 텍스트 위에 가운데에 배치한다. 또 이상한데 배치하지
 * 말고」. 규칙 본문이 **이 시험을 붙이라고 적고 있다**(CLAUDE.md 「이것을 지키는 시험을
 * 붙인다 — 규칙을 글로만 적으면 또 깨진다」).
 *
 * **왜 시험이 필요한가.** 2026-09-11에 정확히 반대 규칙이 있었다 — 「하나만 보인다」.
 * 그때 그렇게 정한 이유가 지금도 함정이다: 문구는 즉시 그려지는데 로더는 700ms 뒤에
 * 끼어들어서, 문구가 먼저 자리를 잡았다가 로더가 나타나며 아래로 밀렸다. 한 자리에
 * 두 개가 겹쳐 나오는 것으로 읽혔다.
 *
 * 그래서 지금 규칙은 둘을 세우되 **따로 나타나지 않게** 한다. 이 시험이 보는 것은
 * 「둘 다 있다」가 아니라 **「하나만 있는 순간이 없다」**이다 — 700ms 전에는 둘 다 없고,
 * 그 뒤에는 둘 다 있다. 누군가 `DelayedLoader`처럼 제 안에서 또 시간을 재는 것으로
 * 바꾸면 로더만 늦게 나타나고, 그때 이 시험이 깨진다.
 */

/**
 * 그려진 트리에서 로더와 문구를 찾는다.
 *
 * 문구는 `toJSON()`의 문자열 자식만 모아 본다 — `props.children`을 통째로 훑으면
 * React 노드의 `_owner`가 자기 자신으로 돌아와 순환 참조에 걸린다(실제로 걸렸다).
 */
function collectText(node: unknown, out: string[]): void {
  if (typeof node === 'string') {
    out.push(node);

    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);

    return;
  }
  if (node && typeof node === 'object' && 'children' in node) {
    collectText((node as { children: unknown }).children, out);
  }
}

function countParts(tree: ReactTestRenderer) {
  const loaders = tree.root.findAllByType(CircleLoader).length;
  const texts: string[] = [];
  collectText(tree.toJSON(), texts);

  return { loaders, hasMessage: texts.some((text) => text.includes(SIGNING_IN_MESSAGE)) };
}

describe('로그인 진행 표시', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('700ms 전에는 로더도 문구도 그리지 않는다', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<SigningInBody size={40} />);
    });

    const parts = countParts(tree);

    expect(parts.loaders).toBe(0);
    expect(parts.hasMessage).toBe(false);
  });

  it('700ms 뒤에는 로더와 문구가 «함께» 나타난다', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<SigningInBody size={40} />);
    });

    act(() => {
      jest.advanceTimersByTime(Motion.loaderThreshold);
    });

    const parts = countParts(tree);

    /*
     * 이 두 줄이 이 시험의 전부다. 하나만 참이면 «하나만 보이는 순간»이 생긴 것이고,
     * 그것이 2026-09-11에 보고된 그 버그다.
     */
    expect(parts.loaders).toBe(1);
    expect(parts.hasMessage).toBe(true);
  });

  it('문구에 제공자 이름이 들어가지 않는다', () => {
    /*
     * 「카카오로 로그인하는 중이에요」 · 「Apple로 로그인하는 중이에요」를 하나로 합쳤다
     * (2026-09-15 대표 지시). `Apple`은 사용자 화면 영문 금지에도 걸린다.
     */
    expect(SIGNING_IN_MESSAGE).toBe('로그인 중이에요');
    expect(SIGNING_IN_MESSAGE).not.toMatch(/카카오|Apple|apple/);
  });

  it('active가 false면 시간이 지나도 그리지 않는다', () => {
    /* 부팅 화면이 말하는 중일 때 로그인 화면이 같은 덩어리를 겹쳐 그리지 않게 하는 길이다. */
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<SigningInBody size={28} active={false} />);
    });

    act(() => {
      jest.advanceTimersByTime(Motion.loaderThreshold * 2);
    });

    const parts = countParts(tree);

    expect(parts.loaders).toBe(0);
    expect(parts.hasMessage).toBe(false);
  });
});
