import { Tabs, useSegments } from 'expo-router';

import { OFF_TAB_ROUTES, ROOT_TABS } from '@/features/navigation/root-tabs';
import { RootTabBar } from '@/features/navigation/tab-bar';
import { useTabScreenOptions } from '@/features/navigation/screen-options';

/**
 * Bottom Navigation. 탭 목록은 이 파일이 아니라 `features/navigation/root-tabs.ts`
 * 하나가 정한다 — 여기는 그 목록을 라우터에 옮겨 놓기만 하고, 탭을 더하거나 빼는
 * 일은 그 파일 한 줄이다.
 *
 * 근거는 **2026-09-14 대표 확정**과 피그마 `weddingpick_figma`
 * `src/app/components/Root.tsx:26-32` `NAV_ITEMS`다. 예전 주석이 근거로 적던
 * 「통합정책 v3.2 §1 — 홈/검색/Pick/웨딩일정/MY」는 이 결정이 대체했다.
 *
 * ```
 * 홈 · 웨딩노트 · Pick · 라운지 · MY      (2026-09-14 대표 확정)
 * ```
 *
 * **검색은 탭에서 내렸지만 화면은 그대로 있다**(`OFF_TAB_ROUTES` 주석 참고) —
 * 초기 이미지가 없어서 임시로 숨긴 것이라 되돌리기 쉽게 두었다. 진입은 홈 상단
 * 검색바가 맡는다.
 *
 * **탭은 최상위 목적지에만 있다.** 상세 · 검색 · 로그인 · 온보딩에서는 탭 바가
 * 통째로 숨고 상단 뒤로가기만 남는다(`components/back-button.tsx` — `router.back()`
 * 이라 검색→상세→검색으로 돌아올 때 직전 맥락이 그대로 남는다). 로그인과 온보딩은
 * 애초에 `(tabs)` 밖이라 여기에 없다.
 */
export default function TabLayout() {
  /*
   * 카메라는 전체 화면을 써야 문서를 화면에 맞추기 쉽다.
   *
   * 조각들을 문자열 배열로 받는다. 타입 생성기가 만드는 조각 유니온은 라우트를
   * 더할 때마다 좁아져서, 어느 날 `includes`가 아무 값도 못 받는 상태가 된다 —
   * 여기서 알고 싶은 것은 "카메라 화면인가" 하나뿐이라 그 유니온이 필요 없다.
   */
  const segments: readonly string[] = useSegments();
  const onCamera = segments.includes('camera');
  /*
   * 탭 한 칸의 바탕. 이걸 비워두면 옮겨간 탭 아래로 지나온 탭이 비친다 —
   * 웹에서는 안 보이는 탭이 떼어지지도 않았다(features/navigation/screen-options).
   */
  const screenOptions = useTabScreenOptions();

  return (
    <Tabs
      tabBar={(props) => (onCamera ? null : <RootTabBar {...props} />)}
      screenOptions={screenOptions}>
      {ROOT_TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
      {/*
        탭에서 내린 화면들(검색 · 제보 · (home) 하위 스택). 화면은 그대로 살아 있고
        다른 화면에서 밀어 넣어 연다 — `href: null`이 없으면 라우터가 없는 탭을 만든다.
       */}
      {OFF_TAB_ROUTES.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
