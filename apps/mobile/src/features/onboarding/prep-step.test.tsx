import React, { useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { searchVendors } from '@/api/client';

import { preparedChoicesPayload, preparedVendorIds, summarizePrep, type Answers } from './flow';
import { PrepStep } from './prep-step';

jest.mock('@/api/client', () => ({ searchVendors: jest.fn() }));

const search = searchVendors as jest.MockedFunction<typeof searchVendors>;

/* 시트는 하단 안전영역을 더해 그린다 — 재 줄 사람이 없으면 훅이 던진다. iPhone 14 값. */
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const HALL = { id: 'v-hall', name: '강남 A 웨딩홀', category: 'hall', region: '서울' };
const STUDIO = { id: 'v-studio', name: '강남 E 스튜디오', category: 'studio', region: '서울' };

/**
 * 준비 현황(3/5) 카드 → 업체 검색 시트 → 줄에 업체 이름(2026-09-26 대표 지시).
 *
 * 화면이 정말 그 길을 지나는지 본다 — 카드를 누르면 켜고 끄지 않고 시트가 열리고,
 * 검색은 카드 업종으로만 부르고, 고른 업체 이름이 카드 부제 자리에 서고,
 * «아직 정한 곳이 없어요»는 카드를 미정으로 돌린다.
 */
describe('준비 현황 카드 → 업체 검색 시트', () => {
  let latest: Answers['prep'] = null;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    latest = null;
    search.mockImplementation(async (input) => ({
      vendors: [HALL, STUDIO].filter((vendor) => vendor.category === input.category),
      sponsored: [],
      nextCursor: null,
      total: 1,
    }) as unknown as Awaited<ReturnType<typeof searchVendors>>);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function Harness({ initial }: { initial: Answers['prep'] }) {
    const [prep, setPrep] = useState<Answers['prep']>(initial);

    return (
      <PrepStep
        value={prep}
        onChange={(next) => {
          latest = next;
          setPrep(next);
        }}
      />
    );
  }

  function render(initial: Answers['prep'] = null) {
    let tree!: ReactTestRenderer;

    act(() => {
      tree = create(
        <SafeAreaProvider initialMetrics={METRICS}>
          <Harness initial={initial} />
        </SafeAreaProvider>
      );
    });

    return tree;
  }

  /** 누를 수 있는 것 하나를 `accessibilityLabel`로 찾는다. */
  function pressable(tree: ReactTestRenderer, label: string): ReactTestInstance {
    return tree.root.find(
      (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
    );
  }

  function press(tree: ReactTestRenderer, label: string) {
    act(() => {
      pressable(tree, label).props.onPress();
    });
  }

  /** 글자로 찾아 그 글자를 감싼 누를 수 있는 것을 누른다 — 공용 단추는 이름을 글자로만 가진다. */
  function pressText(tree: ReactTestRenderer, label: string) {
    let node: ReactTestInstance | null = tree.root.find((one) => one.props.children === label);

    while (node && typeof node.props.onPress !== 'function') node = node.parent;

    act(() => {
      node!.props.onPress();
    });
  }

  function texts(tree: ReactTestRenderer): string[] {
    return tree.root
      .findAll((node) => typeof node.props.children === 'string')
      .map((node) => node.props.children as string);
  }

  async function type(tree: ReactTestRenderer, text: string) {
    const input = tree.root.find(
      (node) => node.props.accessibilityLabel === '업체 이름 검색' && typeof node.props.onChangeText === 'function'
    );

    act(() => {
      input.props.onChangeText(text);
    });
    /* 250ms 뒤에 부르고, 응답을 받아 그린다. */
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('웨딩홀을 누르면 웨딩홀 검색 시트가 열리고, 고른 업체 이름이 줄에 선다', async () => {
    const tree = render();

    press(tree, '웨딩홀. 예식장 · 식대 · 대관');

    expect(texts(tree)).toEqual(expect.arrayContaining(['웨딩홀 검색', '아직 정한 곳이 없어요']));

    await type(tree, '강남');

    /* 카드 업종(웨딩홀)으로만 부른다. */
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith({ q: '강남', category: 'hall', limit: 10 });

    press(tree, '강남 A 웨딩홀');

    expect(latest).toEqual({
      categories: ['hall'],
      vendors: { hall: { id: 'v-hall', name: '강남 A 웨딩홀', category: 'hall' } },
    });
    expect(preparedVendorIds(latest)).toEqual(['v-hall']);

    /* 카드 부제 자리에 업체 이름 — 정본 부제는 이 카드에서 빠진다. */
    const card = pressable(tree, '웨딩홀. 강남 A 웨딩홀');

    expect(card.props.accessibilityState).toEqual({ checked: true });
    expect(texts(tree)).not.toContain('예식장 · 식대 · 대관');
  });

  it('스드메 카드는 업종 넷으로 찾고 다른 업종 업체는 섞지 않는다', async () => {
    const tree = render();

    press(tree, '스드메. 스튜디오 · 드레스 · 메이크업');
    await type(tree, '강남');

    expect(search.mock.calls.map(([input]) => input.category)).toEqual(['studio', 'dress', 'makeup', 'hair']);
    expect(texts(tree)).toContain('강남 E 스튜디오');
    expect(texts(tree)).not.toContain('강남 A 웨딩홀');
  });

  it('«아직 정한 곳이 없어요»는 카드를 미정으로 돌리고 보낼 업체가 없다', () => {
    const tree = render({
      categories: ['hall'],
      vendors: { hall: { id: 'v-hall', name: '강남 A 웨딩홀', category: 'hall' } },
    });

    press(tree, '웨딩홀. 강남 A 웨딩홀');
    pressText(tree, '아직 정한 곳이 없어요');

    expect(latest).toEqual({ categories: [], none: ['hall'] });
    expect(preparedVendorIds(latest)).toEqual([]);
    expect(preparedChoicesPayload(latest)).toEqual({});
    /* 카드는 꺼진 채로, 부제 자리에 고른 것 «아직 정한 곳이 없어요»가 선다(2026-09-26 대표 지시). */
    expect(pressable(tree, '웨딩홀. 아직 정한 곳이 없어요').props.accessibilityState).toEqual({ checked: false });
    expect(texts(tree)).not.toContain('예식장 · 식대 · 대관');
    expect(search).not.toHaveBeenCalled();
  });

  it('«정한 곳 없음» 카드에서 다시 업체를 고르면 표시가 빠지고 업체 이름이 선다', async () => {
    const tree = render({ categories: [], none: ['hall'] });

    press(tree, '웨딩홀. 아직 정한 곳이 없어요');
    await type(tree, '강남');
    pressText(tree, '강남 A 웨딩홀');

    expect(latest?.none).toBeUndefined();
    expect(preparedChoicesPayload(latest)).toEqual({ preparedVendorIds: ['v-hall'] });
    /* 카드 부제가 업체 이름으로 바뀐다 — 닫히는 시트의 단추 글자는 남아 있을 수 있어 카드 이름으로 본다. */
    expect(pressable(tree, '웨딩홀. 강남 A 웨딩홀').props.accessibilityState).toEqual({ checked: true });
  });

  it('X로 닫으면 아무것도 바꾸지 않는다', () => {
    const tree = render();

    press(tree, '웨딩홀. 예식장 · 식대 · 대관');
    /* 시트 머리의 X — 딤(스크림)도 같은 이름이라 버튼 역할로 가른다. */
    const close = tree.root.find(
      (node) =>
        node.props.accessibilityLabel === '닫기' &&
        node.props.accessibilityRole === 'button' &&
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityState !== undefined
    );

    act(() => {
      close.props.onPress();
    });

    expect(latest).toBeNull();
  });

  /* ───── 2026-09-26 대표 지시 「직접입력하는 방법 고안하라」 ───── */

  async function openManual(tree: ReactTestRenderer, query: string) {
    press(tree, '웨딩홀. 예식장 · 식대 · 대관');
    search.mockResolvedValue({ vendors: [], sponsored: [], nextCursor: null, total: 0 } as never);
    await type(tree, query);
    press(tree, '직접 입력');
  }

  function manualInput(tree: ReactTestRenderer): ReactTestInstance {
    return tree.root.find(
      (node) => node.props.accessibilityLabel === '업체 이름 입력' && typeof node.props.onChangeText === 'function'
    );
  }

  function manualCta(tree: ReactTestRenderer): ReactTestInstance {
    let node: ReactTestInstance | null = tree.root.find((one) => one.props.children === '이 이름으로 정하기');

    while (node && typeof node.props.onPress !== 'function') node = node.parent;

    return node!;
  }

  it('찾는 곳이 없으면 «직접 입력»으로 이름을 적어 그 카드의 결정으로 남긴다', async () => {
    const tree = render();

    await openManual(tree, '  우리동네 웨딩컨벤션 ');

    /* 같은 시트가 입력 모드로 바뀐다 — 머리 «웨딩홀 직접 입력», 치던 글자가 칸에 그대로 있다. */
    expect(texts(tree)).toEqual(expect.arrayContaining(['웨딩홀 직접 입력', '이 이름으로 정하기']));
    expect(manualInput(tree).props.value).toBe('우리동네 웨딩컨벤션');

    act(() => {
      manualCta(tree).props.onPress();
    });

    expect(latest).toEqual({ categories: ['hall'], vendors: { hall: { manual: true, name: '우리동네 웨딩컨벤션' } } });
    /* 업체가 없어 Pick 담기(업체 id)는 없고, 결정으로 남길 이름만 간다. */
    expect(preparedVendorIds(latest)).toEqual([]);
    expect(preparedChoicesPayload(latest)).toEqual({
      preparedManualVendors: [{ group: 'start', name: '우리동네 웨딩컨벤션' }],
    });
    /* 카드 줄 부제 자리에 적은 이름 · 완료 요약에도 이름. */
    expect(pressable(tree, '웨딩홀. 우리동네 웨딩컨벤션').props.accessibilityState).toEqual({ checked: true });
    expect(summarizePrep(latest)).toBe('웨딩홀(우리동네 웨딩컨벤션)');
  });

  it('결과가 있어도 결과 아래 조용한 줄로 «직접 입력»이 선다', async () => {
    const tree = render();

    press(tree, '웨딩홀. 예식장 · 식대 · 대관');
    await type(tree, '강남');

    expect(texts(tree)).toEqual(expect.arrayContaining(['강남 A 웨딩홀', '직접 입력']));
  });

  it('이름이 비었으면 «이 이름으로 정하기»가 잠긴다', async () => {
    const tree = render();

    await openManual(tree, '우리동네');

    act(() => {
      manualInput(tree).props.onChangeText('   ');
    });

    expect(manualCta(tree).props.disabled).toBe(true);
    expect(latest).toBeNull();
  });
});
