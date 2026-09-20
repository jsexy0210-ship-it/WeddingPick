import { router, Tabs, useLocalSearchParams, usePathname, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

import { Toast } from '@weddingpick/ui';
import {
  dismissToOrReplace,
  resolveBackAction,
  withBackOrigin,
} from '@/features/navigation/depth-back';
import { OFF_TAB_ROUTES, ROOT_TABS } from '@/features/navigation/root-tabs';
import { RootTabBar } from '@/features/navigation/tab-bar';
import { useTabScreenOptions } from '@/features/navigation/screen-options';

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
  const { from } = useLocalSearchParams<{ from?: string | string[] }>();
  const backPathname = withBackOrigin(pathname, from);
  const lastExitBackAt = useRef(0);
  const [exitToast, setExitToast] = useState<string | null>(null);
  const onCamera = segments.includes('camera');

  useEffect(() => {
    lastExitBackAt.current = 0;
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const action = resolveBackAction(backPathname, router.canGoBack());

      /* 같은 목록 안에서만 History를 허용한다. 기본 처리에 맡겨 스크롤·탭 상태를 살린다. */
      if (action.kind === 'history') return false;

      /* 하위 화면은 논리 부모로, 홈이 아닌 Root 탭은 홈으로 간다. */
      if (action.kind === 'depth') {
        dismissToOrReplace(action.target);
        return true;
      }

      const now = Date.now();
      if (now - lastExitBackAt.current <= 2_000) {
        BackHandler.exitApp();
        return true;
      }

      lastExitBackAt.current = now;
      setExitToast('뒤로가기를 한 번 더 누르면 앱이 종료돼요');
      return true;
    });

    return () => subscription.remove();
  }, [backPathname]);
  /*
   * Pick 완료는 transient route다. 이 화면을 떠날 때만 Pick nested Stack을 root로 접는다.
   * category/compare → search 상세처럼 아직 진행 중인 교차 탐색에서는 false라 Back 문맥을 보존한다.
   */
  const onPickDone =
    segments[segments.length - 2] === 'pick' && segments[segments.length - 1] === 'done';
  /*
   * 탭 한 칸의 바탕. 이걸 비워두면 옮겨간 탭 아래로 지나온 탭이 비친다 —
   * 웹에서는 안 보이는 탭이 떼어지지도 않았다(features/navigation/screen-options).
   */
  const screenOptions = useTabScreenOptions();

  return (
    <>
      <Tabs
      backBehavior="firstRoute"
      tabBar={(props) => (onCamera ? null : <RootTabBar {...props} />)}
      screenOptions={screenOptions}>
      {ROOT_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            popToTopOnBlur: tab.name === 'pick' && onPickDone,
          }}
        />
      ))}
      {/*
        탭에서 내린 화면들(라운지 · 제보 · (home) 하위 스택). 화면은 그대로 살아 있고
        다른 화면에서 밀어 넣어 연다 — `href: null`이 없으면 라우터가 없는 탭을 만든다.
       */}
      {OFF_TAB_ROUTES.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            href: null,
            /*
             * capture는 가입/탐색 탭이 아니라 제출을 위해 잠깐 들어오는 one-shot 흐름이다.
             * 완료 뒤 다른 탭으로 빠졌다면 내부 register/done Stack을 버린다. 반면
             * (home)·community까지 같이 접으면 아직 끝나지 않은 탐색의 Back 문맥이 깨진다.
             */
            popToTopOnBlur: name === 'capture',
          }}
        />
      ))}
      </Tabs>
      <Toast message={exitToast} onHidden={() => setExitToast(null)} />
    </>
  );
}
