import { useMemo } from 'react';
import { enableScreens } from 'react-native-screens';

import { useTheme } from '@weddingpick/ui';

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
 */
enableScreens(true);

/** 스택 화면의 기본값. 헤더는 화면이 직접 그린다 — 라우터의 것을 쓰지 않는다. */
export function useStackScreenOptions(): {
  headerShown: false;
  contentStyle: { backgroundColor: string };
} {
  const theme = useTheme();

  return useMemo(
    () => ({ headerShown: false, contentStyle: { backgroundColor: theme.background } }),
    [theme.background]
  );
}

/** 탭 화면의 기본값. `sceneStyle`이 탭 한 칸의 바탕이다. */
export function useTabScreenOptions(): {
  headerShown: false;
  sceneStyle: { backgroundColor: string };
} {
  const theme = useTheme();

  return useMemo(
    () => ({ headerShown: false, sceneStyle: { backgroundColor: theme.background } }),
    [theme.background]
  );
}
