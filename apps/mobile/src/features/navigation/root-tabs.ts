import type { ProductSymbolName } from '@weddingpick/ui';

/**
 * Root 탭 — **이 배열 하나가 탭의 유일한 정의다.**
 *
 * 탭 레이아웃(`app/(tabs)/_layout.tsx`)과 탭 바(`tab-bar.tsx`)가 둘 다 여기를 읽는다.
 * 두 곳에 따로 적어 두면 한쪽만 고쳐서 «라우터는 여섯 탭인데 바에는 다섯»이 된다.
 *
 * ```
 * 홈 · 웨딩노트 · Pick · 라운지 · MY      (2026-09-14 대표 확정)
 * ```
 *
 * **보이는 이름과 라우트를 같이 바꾸지 않는다.** 이 자리는 «우리웨딩 → 웨딩일정 →
 * 웨딩플랜 → 웨딩노트»로 이름이 네 번 바뀌는 동안 라우트가 계속 `/wedding`이었다 —
 * 저장된 링크·딥링크·공유 주소가 이름을 따라 깨지지 않게 한다. 문구는
 * `spec/strings.ko.json` `common.nav.*`와 같은 말을 쓴다.
 */
export type RootTabSpec = {
  /** `app/(tabs)` 아래 라우트 이름. 화면 이름이 바뀌어도 이 값은 그대로다. */
  name: string;
  label: string;
  icon: ProductSymbolName | 'pick';
  /**
   * 가운데 원형 강조. Pick 하나뿐이다 — 이 앱에서 가장 중요한 행동이라
   * 나머지 넷과 다른 모양으로 선다(Figma `Root.tsx` `isPick`).
   */
  emphasized?: boolean;
};

export const ROOT_TABS: readonly RootTabSpec[] = [
  { name: 'index', label: '홈', icon: 'house' },
  /* 라우트는 `/wedding` 그대로. 이름만 «웨딩노트»다. */
  { name: 'wedding', label: '웨딩노트', icon: 'calendar' },
  { name: 'pick', label: 'Pick', icon: 'pick', emphasized: true },
  { name: 'community', label: '라운지', icon: 'twoPeople' },
  { name: 'my', label: 'MY', icon: 'person' },
];

/**
 * `(tabs)` 아래에 있지만 탭으로 세우지 않는 라우트. 화면은 그대로 살아 있고
 * 다른 화면에서 밀어 넣어 연다 — 탭 바는 이 화면들에서 통째로 숨는다.
 *
 * **`search`는 임시로 내린 것이다(2026-09-14 대표 지시).** 「검색은 차후에 탭으로
 * 이관한다. 초기 이미지 데이터가 없어서 뒤로 숨긴다」 — 영구 결정이 아니다.
 * 되돌리는 방법은 한 줄이다: 여기서 `'search'`를 빼고 `ROOT_TABS`에
 * `{ name: 'search', label: '검색', icon: 'magnifier' }`를 넣으면 된다.
 * 그동안 진입은 홈 상단 검색바가 맡는다(`app/(tabs)/index.tsx` — 다른 담당).
 *
 * `capture`(제보)는 v3.2 §1이 루트에서 뺀 것이고, `(home)`은 홈에서 파고드는
 * 하위 스택이라 애초에 탭이 아니다 — 숨기지 않으면 라우터가 없는 탭을 만든다.
 */
export const OFF_TAB_ROUTES = ['search', 'capture', '(home)'] as const;

/** 이 라우트에 탭 바가 서는가. 다섯 탭 밖에서는 상단 뒤로가기만 쓴다. */
export function isRootTab(routeName: string | undefined): boolean {
  return ROOT_TABS.some((tab) => tab.name === routeName);
}

export function rootTab(routeName: string): RootTabSpec | undefined {
  return ROOT_TABS.find((tab) => tab.name === routeName);
}
