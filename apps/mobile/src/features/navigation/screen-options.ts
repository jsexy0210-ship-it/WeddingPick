import { useCallback } from 'react';
import { Dimensions, Easing } from 'react-native';
import { enableScreens } from 'react-native-screens';
import type {
  BottomTabNavigationOptions,
  BottomTabSceneStyleInterpolator,
} from 'expo-router/build/react-navigation/bottom-tabs/types';

import { useReduceMotion, useTheme } from '@weddingpick/ui';

import { isBackReplace } from './back-replace';
import { OFF_TAB_ROUTES } from './root-tabs';
import { StackMotion, stackTransitionFor } from './stack-motion';
import { stackScreenOptions, type StackScreenOptions } from './transition-options';

/**
 * 화면 하나가 다른 화면 위에 얹힐 때 아래가 비쳐 보이지 않게 하는 자리.
 *
 * **잔상의 원인은 두 가지였다**(2026-09-09 감사).
 *
 * 1. 탭 화면이 서로 겹친 채 남아 있었다. `react-native-screens`는 웹에서 스스로
 *    꺼져 있고(`core.ts` — `ENABLE_SCREENS = isNativePlatformSupported`), 그러면
 *    Bottom Tabs가 화면을 떼어내는 대신 그냥 `View`로 그린다. 지나온 탭이 전부
 *    화면 크기 그대로 계속 그려져 있어서, 위 화면이 조금이라도 비거나 늦게
 *    그려지면 그 아래 것이 그대로 보인다. 홈 → 검색으로 옮긴 뒤에도 홈의 글자가
 *    같이 읽혔다(스크린 리더도 그것을 읽는다).
 * 2. 스택·탭 어디에도 배경색을 준 적이 없다. 배경이 없는 화면은 투명이라
 *    밀려나는 화면이 그 사이로 비친다 — 네이티브의 밀어넣기 애니메이션 동안
 *    특히 그렇다.
 *
 * 그래서 여기서 둘 다 막는다 — 웹에서도 화면을 떼어내게 켜두고, 모든 스택·탭에
 * 토큰 배경을 깐다. 색은 `packages/ui` 테마(spec/tokens.json `color.surface`)에서만
 * 가져온다.
 */

/*
 * 네이티브에서는 이미 켜져 있고(기본값), 웹에서만 달라진다. 켜두면 Bottom Tabs가
 * 보이지 않는 탭을 `display: none`으로 접는다(`react-native-screens`
 * `Screen.web.tsx`) — 잔상이 사라지고, 안 보이는 화면의 배치·그리기 비용도 함께
 * 사라진다. 어떤 내비게이터가 만들어지기 전에 정해져야 해서 모듈을 읽는 순간
 * 부른다.
 *
 * **탭 전환에 움직임을 넣으면 이것만으로는 모자란다**(2026-09-26 검수 반례). 하단 탭은 지금 탭
 * 왼쪽의 탭을 «전환 중» 상태로 남겨 `display: flex`로 그린다 — 지나온 탭이 투명한 채 배치 ·
 * 키보드 초점에 남았다. 전환이 끝나면 그 탭을 다시 접는 일은 `tab-scene.tsx`(`screenLayout`)가 한다.
 */
enableScreens(true);

/**
 * 스택 화면의 기본값. 헤더는 화면이 직접 그린다 — 라우터의 것을 쓰지 않는다.
 *
 * **전환도 여기서 정한다**(2026-09-26 대표 지시 「모든 전체 화면 라우터 단위로 싹다 적용해」).
 * 라우트마다 `stack-motion.ts`의 표로 push · modal · sheet · fade · none을 고르고, 플랫폼별 옵션은
 * `transition-options(.web).ts`가 만든다 — 모든 `_layout.tsx`가 이 함수 하나를 넘기므로 화면을
 * 새로 만들어도 따로 할 일이 없다. 「움직임 줄이기」가 켜지면 이동 대신 페이드다.
 */
export function useStackScreenOptions(): (props: { route: { name: string; key?: string } }) => StackScreenOptions {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();

  return useCallback(
    ({ route }: { route: { name: string; key?: string } }) =>
      stackScreenOptions(stackTransitionFor(route.name), {
        background: theme.background,
        reduceMotion,
        /* 부모가 스택에 없어 Depth Back · X가 갈아끼운 라우트 — 웹은 뒤로 움직인다(`back-replace.ts`). */
        replacedByBack: isBackReplace(route.key),
      }),
    [reduceMotion, theme.background]
  );
}

/**
 * Root 탭 겹침 — 탭 막대로 옮겨 갈 때는 밀지 않는다(iOS · 안드로이드 탭 막대가 그렇다).
 * 짧게 겹쳐 바뀐다(`StackMotion.tabFade`). 하단 탭의 `forFade`와 같은 모양이다.
 *
 * 탭에서 내린 화면(홈 하위 피드 · 라운지)으로 들어갈 때도 홈은 이 겹침으로 옅어지고, 그 위로 상세가
 * 밀려 들어온다. **돌아올 때는 밀려 나가는 상세 위로 홈이 겹쳐 나타난다** — 하단 탭은 늘 «지금 탭»을
 * 맨 위에 그려서(`BottomTabView` zIndex) 나가는 상세를 홈 위에 둘 수 없다. 스택 안의 Back은
 * 온전히 거꾸로 밀린다.
 */
const forTabFade: BottomTabSceneStyleInterpolator = ({ current }) => ({
  sceneStyle: { opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }) },
});

/**
 * 탭에서 내린 화면(`OFF_TAB_ROUTES` — 홈 하위 스택 · 라운지). 라우터로는 탭 한 칸이지만 사용자에게는
 * 홈에서 «들어가는» 상세다 — 탭처럼 겹치면 들어간 느낌이 없다. 오른쪽에서 밀려 들어오고 나올 때
 * 오른쪽으로 빠진다. 탭 목록에서 이 칸들은 Root 탭 뒤에 있어 들어올 때 progress 1 → 0이다.
 */
const forOffTabPush: BottomTabSceneStyleInterpolator = ({ current }) => ({
  sceneStyle: {
    transform: [
      {
        translateX: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [0, 0, Dimensions.get('window').width],
          extrapolate: 'clamp',
        }),
      },
    ],
  },
});

const TAB_FADE_SPEC = {
  animation: 'timing' as const,
  config: { duration: StackMotion.tabFade, easing: Easing.out(Easing.quad) },
};

const OFF_TAB_SPEC = {
  animation: 'timing' as const,
  config: { duration: StackMotion.pushOpen, easing: Easing.bezier(0.2, 0.8, 0.2, 1) },
};

/**
 * 탭 화면의 기본값. `sceneStyle`이 탭 한 칸의 바탕이다.
 *
 * nested Stack을 버릴지는 여기서 전역으로 정하지 않는다. 검색 상세 → Pick 인증처럼
 * 아직 끝나지 않은 교차 흐름은 이전 상세로 돌아갈 수 있어야 한다. 완료성 숨은 흐름만
 * `app/(tabs)/_layout.tsx`에서 route별로 `popToTopOnBlur`를 켠다.
 *
 * 전환 — Root 탭끼리는 짧게 겹치고(`forTabFade`), 탭에서 내린 화면은 밀려 들어온다
 * (`forOffTabPush`). 하단 탭은 네이티브도 JS로 그리므로 두 플랫폼이 같은 값을 쓴다.
 */
export function useTabScreenOptions(): (props: { route: { name: string } }) => BottomTabNavigationOptions {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();

  return useCallback(
    ({ route }: { route: { name: string } }) => {
      const base: BottomTabNavigationOptions = { headerShown: false, sceneStyle: { backgroundColor: theme.background } };

      if (reduceMotion) return { ...base, animation: 'none' };

      if ((OFF_TAB_ROUTES as readonly string[]).includes(route.name)) {
        return { ...base, animation: 'shift', sceneStyleInterpolator: forOffTabPush, transitionSpec: OFF_TAB_SPEC };
      }

      return { ...base, animation: 'fade', sceneStyleInterpolator: forTabFade, transitionSpec: TAB_FADE_SPEC };
    },
    [reduceMotion, theme.background]
  );
}
