import { Tabs, useGlobalSearchParams, usePathname, useSegments } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { Toast } from '@weddingpick/ui';
import { withBackOrigin } from '@/features/navigation/depth-back';
import { useHardwareBackPolicy } from '@/features/navigation/hardware-back';
import { OFF_TAB_ROUTES, ROOT_TABS } from '@/features/navigation/root-tabs';
import { RootTabBar } from '@/features/navigation/tab-bar';
import { useTabScreenOptions } from '@/features/navigation/screen-options';
import { useTabSceneGate } from '@/features/navigation/tab-scene';

/**
 * Bottom Navigation. 탭 목록은 이 파일이 아니라 `features/navigation/root-tabs.ts`
 * 하나가 정한다 — 여기는 그 목록을 라우터에 옮겨 놓기만 하고, 탭을 더하거나 빼는
 * 일은 그 파일 한 줄이다.
 *
 * 2026-09-18 정본의 Root 5탭은 **홈 · 검색 · Pick · 웨딩노트 · MY**다.
 * 라운지(`community`)는 탭에서만 내렸고 화면과 딥링크는 그대로 유지한다.
 * 목록의 실제 값은 `features/navigation/root-tabs.ts`가 단일 정본이다.
 *
 * **탭은 최상위 목적지에만 있다.** 상세 · 로그인 · 온보딩에서는 탭 바가 숨고,
 * 직접 진입한 상세는 Depth Back 규칙으로 정해진 부모로 돌아간다. 로그인과 온보딩은
 * 애초에 `(tabs)` 밖이라 여기에 없다.
 */
/**
 * 탭 전환의 방문 기록. **웹만 `fullHistory`다.**
 *
 * `firstRoute`면 탭 기록이 늘 [홈, 지금 탭] 두 칸이라 다른 탭으로 건너가는 이동(Pick → 업체 상세 ·
 * MY → 연결관리 · MY → 리얼후기 → 업체 상세)이 브라우저 기록을 **덮어쓴다**(replaceState) — 그 화면에서
 * 브라우저 Back을 누르면 출처가 아니라 앱 밖(빈 화면)으로 나갔다(2026-09-26 웹 빌드 실측). `fullHistory`는
 * 건너갈 때마다 기록을 쌓아 브라우저 Back이 들어온 자리로 돌아온다.
 *
 * 네이티브는 그대로 둔다 — 안드로이드 하드웨어 Back은 `hardware-back.ts`가 먼저 받아 Root 탭 → 홈을
 * 정하고, iOS 탭에는 Back이 없다. 거기서 `canGoBack`의 뜻을 바꿀 까닭이 없다.
 */
const TAB_BACK_BEHAVIOR = Platform.OS === 'web' ? 'fullHistory' : 'firstRoute';

export default function TabLayout() {
  /*
   * 카메라는 전체 화면을 써야 문서를 화면에 맞추기 쉽다.
   *
   * 조각들을 문자열 배열로 받는다. 타입 생성기가 만드는 조각 유니온은 라우트를
   * 더할 때마다 좁아져서, 어느 날 `includes`가 아무 값도 못 받는 상태가 된다 —
   * 여기서 알고 싶은 것은 "카메라 화면인가" 하나뿐이라 그 유니온이 필요 없다.
   */
  const segments: readonly string[] = useSegments();
  const pathname = usePathname();
  /*
   * 레이아웃의 local params는 레이아웃 자신의 것이라 하위 화면의 `from`이 없다 — 그러면 안드로이드
   * Back이 출처(MY · 리얼후기)를 잃고 계층 부모(웨딩노트 · 검색)로 간다. 지금 보이는 화면의
   * 주소 값을 읽는다.
   */
  const { from } = useGlobalSearchParams<{ from?: string | string[] }>();
  const backPathname = withBackOrigin(pathname, from);
  const [exitToast, setExitToast] = useState<string | null>(null);
  const onCamera = segments.includes('camera');

  /* 안드로이드 하드웨어 Back은 앱 전체에서 여기 한 곳만 듣는다(features/navigation/hardware-back). */
  useHardwareBackPolicy(backPathname, setExitToast);
  /*
   * 탭 한 칸의 바탕. 이걸 비워두면 옮겨간 탭 아래로 지나온 탭이 비친다 —
   * 웹에서는 안 보이는 탭이 떼어지지도 않았다(features/navigation/screen-options).
   */
  const screenOptions = useTabScreenOptions();
  /* 전환이 끝나면 지나온 탭을 배치 · 키보드 초점에서 뺀다(웹) — features/navigation/tab-scene. */
  const sceneGate = useTabSceneGate();

  return (
    <>
      <Tabs
      backBehavior={TAB_BACK_BEHAVIOR}
      tabBar={(props) => (onCamera ? null : <RootTabBar {...props} />)}
      screenOptions={screenOptions}
      {...sceneGate}>
      {ROOT_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            popToTopOnBlur: false,
          }}
        />
      ))}
      {/*
        탭에서 내린 화면들(라운지 · (home) 하위 스택). 화면은 그대로 살아 있고
        다른 화면에서 밀어 넣어 연다 — `href: null`이 없으면 라우터가 없는 탭을 만든다.
       */}
      {OFF_TAB_ROUTES.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            href: null,
            /* (home)·community를 접으면 아직 끝나지 않은 탐색의 Back 문맥이 깨진다. */
            popToTopOnBlur: false,
          }}
        />
      ))}
      </Tabs>
      <Toast message={exitToast} onHidden={() => setExitToast(null)} />
    </>
  );
}
