/**
 * 검색 필터 시트 — 공통 바텀시트 UX(2026-09-26 대표 지시 「검색 -> 필터도 공통 바텀시트 UX 적용한다」).
 *
 *   1. 머리는 공통 `SheetHeader`다 — 타이틀 «필터» · «전체 해제» · 우측 X. 끌어 닫기 손잡이도 머리다.
 *   2. 본문만 굴러간다 — CTA «{n}개 업체 보기»는 스크롤 밖에 있어 늘 보인다.
 *   3. 선택 상태 — 고른 칩은 selected, 서버가 못 거르는 칩(BACKEND_PENDING)은 disabled이고 눌러도 안 바뀐다.
 *   4. 적용 전 취소 — X · 딤 · 안드로이드 뒤로가기(Modal onRequestClose)로 닫으면 열 때 조건으로 되돌린다.
 *   5. 결과 반영 — CTA로 닫으면 바뀐 조건이 남는다.
 *   6. 웹 브라우저 뒤로가기는 시트만 닫는다 — 공통 시트에 `closeOnBrowserBack`을 준다.
 */
import { useState } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, Modal, Pressable, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomSheet } from '@/features/common/bottom-sheet';

import { FilterSheet, pickFilterValue, useFilterSheetSession, type SearchFilterValue } from './filter-sheet';

/* 애니메이션을 JS로 돌린다 — 네이티브 드라이버는 jest에서 끝 신호를 주지 않아 «닫힌 뒤 Modal이 내려간다»를 볼 수 없다. */
jest.mock('@weddingpick/ui', () => ({ ...jest.requireActual('@weddingpick/ui'), USE_NATIVE_DRIVER: false }));

let tree: ReactTestRenderer | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise<boolean>(() => undefined));
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: () => undefined } as never);
});

afterEach(() => {
  if (tree) act(() => tree?.unmount());
  tree = null;
  jest.useRealTimers();
});

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const INITIAL: SearchFilterValue & { q: string } = { q: '강남', category: null, region: '서울', budget: null, sort: 'data' };

/** 검색 화면과 같은 배선 — 칩이 곧바로 부모 조건을 바꾸고, 세션이 열 때 조건을 기억한다. */
function Harness({ onFilters }: { onFilters: (value: typeof INITIAL) => void }) {
  const [filters, setFilters] = useState(INITIAL);
  const sheet = useFilterSheetSession(
    () => pickFilterValue(filters),
    (before) => setFilters((current) => ({ ...current, ...before }))
  );
  onFilters(filters);

  return (
    <>
      <Pressable testID="open-filter" onPress={sheet.open} />
      <FilterSheet
        visible={sheet.visible}
        value={pickFilterValue(filters)}
        regions={['서울', '경기']}
        count={7}
        onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
        onApply={sheet.apply}
        onDismiss={sheet.dismiss}
      />
    </>
  );
}

function mount() {
  let latest = INITIAL;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Harness onFilters={(value) => (latest = value)} />
      </SafeAreaProvider>
    );
  });
  return { root: (tree as ReactTestRenderer).root, filters: () => latest };
}

const settle = () =>
  act(() => {
    jest.advanceTimersByTime(1000);
  });

function open(root: ReactTestInstance) {
  act(() => root.findByProps({ testID: 'open-filter' }).props.onPress());
  settle();
}

/** accessibilityLabel과 역할로 누를 수 있는 호스트 노드를 찾는다. */
function pressable(root: ReactTestInstance, label: string, role?: string): ReactTestInstance {
  return root.find(
    (node) =>
      typeof node.type !== 'string' &&
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function' &&
      (role === undefined || node.props.accessibilityRole === role)
  );
}

/** CTA — 글자 «{n}개 업체 보기»를 품은 버튼. */
function cta(root: ReactTestInstance, label: string): ReactTestInstance {
  return root.find(
    (node) =>
      typeof node.type !== 'string' &&
      node.props.accessibilityRole === 'button' &&
      typeof node.props.onPress === 'function' &&
      node.findAll((child) => child.props.children === label).length > 0
  );
}

function press(root: ReactTestInstance, label: string, role?: string) {
  act(() => pressable(root, label, role).props.onPress());
}

const header = (root: ReactTestInstance) => root.find((node) => node.props.testID === 'sheet-header' && typeof node.type !== 'string');
const sheetOpen = (root: ReactTestInstance) => root.findAll((node) => node.type === Modal).length > 0;

describe('필터 시트는 공통 바텀시트 모양이다', () => {
  it('머리에 타이틀 «필터» · «전체 해제» · X가 한 줄로 선다', () => {
    const { root } = mount();
    open(root);

    const head = header(root);
    expect(head.findAll((node) => node.props.children === '필터').length).toBeGreaterThan(0);
    expect(head.findAll((node) => node.props.accessibilityLabel === '전체 해제' && node.props.accessibilityRole === 'button').length).toBeGreaterThan(0);
    expect(head.findAll((node) => node.props.accessibilityLabel === '닫기' && node.props.accessibilityRole === 'button').length).toBeGreaterThan(0);
  });

  it('CTA «7개 업체 보기»는 스크롤 밖에 있다 — 본문만 굴러간다', () => {
    const { root } = mount();
    open(root);

    const body = root.find((node) => node.props.testID === 'search-filter-body' && node.type === ScrollView);
    expect(body.findAll((node) => node.props.children === '7개 업체 보기')).toHaveLength(0);
    expect(cta(root, '7개 업체 보기')).toBeTruthy();
  });

  it('공통 시트에 웹 브라우저 뒤로가기 닫기를 켠다', () => {
    const { root } = mount();
    open(root);

    const sheet = root.findByType(BottomSheet);
    expect(sheet.props.closeOnBrowserBack).toBe(true);
    expect(sheet.props.dismissible).not.toBe(false);
  });
});

describe('선택 상태', () => {
  it('고른 칩은 selected, 서버가 못 거르는 칩은 disabled이고 눌러도 조건이 안 바뀐다', () => {
    const { root, filters } = mount();
    open(root);

    expect(pressable(root, '서울 전체', 'radio').props.accessibilityState).toEqual({ selected: true, disabled: false });
    /* «전체»는 카테고리 · 예산 두 묶음에 있다 — 둘 다 켜져 있다. */
    const alls = root.findAll((node) => node.props.accessibilityLabel === '전체' && node.props.accessibilityRole === 'radio' && typeof node.type !== 'string' && typeof node.props.onPress === 'function');
    expect(alls.map((node) => node.props.accessibilityState.selected)).toEqual([true, true]);

    press(root, '웨딩홀', 'radio');
    expect(filters().category).toBe('hall');
    expect(pressable(root, '웨딩홀', 'radio').props.accessibilityState).toEqual({ selected: true, disabled: false });

    const pending = root.find((node) => node.props.accessibilityLabel === '스드메' && node.props.accessibilityRole === 'radio' && typeof node.type !== 'string');
    expect(pending.props.accessibilityState).toEqual({ selected: false, disabled: true });
    expect(pending.props.disabled).toBe(true);
    expect(filters().category).toBe('hall');
  });

  it('«전체 해제»는 카테고리 · 지역 · 예산만 비우고 정렬과 검색어는 둔다', () => {
    const { root, filters } = mount();
    open(root);
    press(root, '웨딩홀', 'radio');
    press(root, '금액 낮은순', 'radio');

    press(root, '전체 해제', 'button');
    expect(filters()).toEqual({ ...INITIAL, region: null, sort: 'price_low' });
  });
});

describe('적용 전 취소 · 결과 반영', () => {
  it('X로 닫으면 열 때 조건으로 되돌린다', () => {
    const { root, filters } = mount();
    open(root);
    press(root, '웨딩홀', 'radio');
    press(root, '경기 전체', 'radio');
    press(root, '금액 높은순', 'radio');
    expect(filters()).toEqual({ ...INITIAL, category: 'hall', region: '경기', sort: 'price_high' });

    act(() => header(root).find((node) => node.props.accessibilityLabel === '닫기' && typeof node.props.onPress === 'function').props.onPress());
    settle();
    expect(filters()).toEqual(INITIAL);
    expect(sheetOpen(root)).toBe(false);
  });

  it('딤을 눌러 닫아도 되돌린다', () => {
    const { root, filters } = mount();
    open(root);
    press(root, '웨딩홀', 'radio');

    /* 딤 — Modal 안 첫 «닫기» 단추(머리의 X가 아닌 쪽). */
    const scrim = root.find(
      (node) => node.props.accessibilityLabel === '닫기' && node.props.cancelable === false && typeof node.props.onPress === 'function'
    );
    act(() => scrim.props.onPress());
    settle();
    expect(filters()).toEqual(INITIAL);
  });

  it('안드로이드 뒤로가기(Modal onRequestClose)는 시트만 닫고 조건을 되돌린다', () => {
    const { root, filters } = mount();
    open(root);
    press(root, '웨딩홀', 'radio');

    act(() => root.findByType(Modal).props.onRequestClose());
    settle();
    expect(filters()).toEqual(INITIAL);
    expect(sheetOpen(root)).toBe(false);
  });

  it('CTA «{n}개 업체 보기»로 닫으면 바뀐 조건이 결과에 남는다', () => {
    const { root, filters } = mount();
    open(root);
    press(root, '웨딩홀', 'radio');
    press(root, '금액 낮은순', 'radio');

    act(() => cta(root, '7개 업체 보기').props.onPress());
    settle();
    expect(filters()).toEqual({ ...INITIAL, category: 'hall', sort: 'price_low' });
    expect(sheetOpen(root)).toBe(false);
  });

  it('적용한 뒤 다시 열어 취소하면 «적용한 조건»으로 돌아간다 — 처음 조건이 아니다', () => {
    const { root, filters } = mount();
    open(root);
    press(root, '웨딩홀', 'radio');
    act(() => cta(root, '7개 업체 보기').props.onPress());
    settle();

    open(root);
    press(root, '경기 전체', 'radio');
    act(() => root.findByType(Modal).props.onRequestClose());
    settle();
    expect(filters()).toEqual({ ...INITIAL, category: 'hall' });
  });
});
