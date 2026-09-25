import type { SeedIconName } from '@weddingpick/ui';

/**
 * Root 탭 — **이 배열 하나가 탭의 유일한 정의다.**
 *
 * 탭 레이아웃(`app/(tabs)/_layout.tsx`)과 탭 바(`tab-bar.tsx`)가 둘 다 여기를 읽는다.
 * 두 곳에 따로 적어 두면 한쪽만 고쳐서 «라우터는 여섯 탭인데 바에는 다섯»이 된다.
 *
 * ```
 * 홈 · 검색 · Pick · 웨딩노트 · MY      (2026-09-17 대표 지시 — 새 패키지)
 * ```
 *
 * **라운지가 내려가고 검색이 올라왔다.** 근거는 `docs/design/figma-export/README.md` —
 * 「라운지는 탭이 아닙니다. 초기에는 후기와 박람회가 몇 건뿐이라 탭 한 칸이 빈 화면을
 * 띄웁니다」. 검색은 2026-09-14에 「초기 이미지 데이터가 없어서」 임시로 내렸던 것이고
 * 그때부터 «차후에 되돌린다»고 적어 둔 자리다 — 지금이 그때다.
 *
 * **라운지를 없애는 것이 아니다.** 화면 `/community`는 그대로 살아 있고 진입만 둘로
 * 옮겼다 — 홈의 「웨딩 소식」 섹션 우측과 MY의 「라운지」 섹션 세 줄(v3.28 시안 1).
 * 주소를 바꾸지 않는 이유는 저장된 링크와 공유 주소가 깨지기 때문이다.
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
  /**
   * SEED 아이콘 켜짐 · 꺼짐 한 쌍(피그마 `Root.tsx` `IconActive` · `IconInactive`). Pick만
   * `'pick'` — 우리 Pick Mark다(보류 · 2026-09-15 MASTER. 대표님이 하트라 하기 전까지 그대로).
   */
  icon: { off: SeedIconName; on: SeedIconName } | 'pick';
  /**
   * 가운데 원형 강조. Pick 하나뿐이다 — 이 앱에서 가장 중요한 행동이라
   * 나머지 넷과 다른 모양으로 선다(Figma `Root.tsx` `isPick`).
   */
  emphasized?: boolean;
};

export const ROOT_TABS: readonly RootTabSpec[] = [
  { name: 'index', label: '홈', icon: { off: 'homeRegular', on: 'homeFill' } },
  { name: 'search', label: '검색', icon: { off: 'searchRegular', on: 'searchFill' } },
  { name: 'pick', label: 'Pick', icon: 'pick', emphasized: true },
  /* 라우트는 `/wedding` 그대로. 이름만 «웨딩노트»다. */
  { name: 'wedding', label: '웨딩노트', icon: { off: 'calendarRegular', on: 'calendarFill' } },
  { name: 'my', label: 'MY', icon: { off: 'profileRegular', on: 'profileFill' } },
];

/**
 * `(tabs)` 아래에 있지만 탭으로 세우지 않는 라우트. 화면은 그대로 살아 있고
 * 다른 화면에서 밀어 넣어 연다 — 탭 바는 이 화면들에서 통째로 숨는다.
 *
 * **`search`는 2026-09-17에 탭으로 돌아갔다.** 2026-09-14에 「초기 이미지 데이터가
 * 없어서 뒤로 숨긴다 · 차후에 탭으로 이관한다」로 임시로 내렸던 것이고, 그 자리에
 * 「되돌리는 방법은 한 줄」이라고 적어 뒀었다. 그 한 줄을 지금 썼다.
 *
 * **`community`(라운지)가 대신 내려왔다**(대표 지시 · 새 패키지). 화면은 그대로 살아
 * 있고 탭에서만 뺀다 — 후기와 박람회가 몇 건뿐이라 탭 한 칸이 빈 화면을 띄운다.
 * 진입은 홈 「웨딩 소식」 우측과 MY 「둘러보기」 둘이다. 주소 `/community`는 그대로다.
 *
 * `(home)`은 홈에서 파고드는 하위 스택이라 애초에 탭이 아니다 — 숨기지 않으면 라우터가
 * 없는 탭을 만든다. `capture`(Pick 인증 촬영)는 2026-09-25 폴더째 삭제했다.
 */
export const OFF_TAB_ROUTES = ['community', '(home)'] as const;

/** 이 라우트에 탭 바가 서는가. 다섯 탭 밖에서는 상단 뒤로가기만 쓴다. */
export function isRootTab(routeName: string | undefined): boolean {
  return ROOT_TABS.some((tab) => tab.name === routeName);
}

export function rootTab(routeName: string): RootTabSpec | undefined {
  return ROOT_TABS.find((tab) => tab.name === routeName);
}
