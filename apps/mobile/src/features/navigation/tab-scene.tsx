import { useCallback, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
/* expo-router 본체를 부르지 않는 경로 — 같은 훅이다(expo-router `useIsFocused`가 이것을 다시 내보낸다). */
import { useIsFocused } from 'expo-router/build/useIsFocused';

/**
 * Root 탭 한 칸의 겉 — **지나온 탭을 전환이 끝나면 다시 떼어 둔다**(웹).
 *
 * 탭 전환에 움직임(`useTabScreenOptions` — Root 탭 겹침 · 탭에서 내린 화면 밀기)을 넣으면 하단 탭
 * (`BottomTabView`)은 지금 탭의 **왼쪽**에 있는 탭을 진행값 -1로 보내는데, 그 값의 활동 상태 보간이
 * `extend`라 «전환 중(보임)»에 머문다. `react-native-screens` 웹 판은 그 상태를 `display: flex`로
 * 그려서 지나온 탭이 투명한 채로 전부 배치에 남았다(2026-09-26 검수 반례) —
 *
 *   · 2026-09-09에 막았던 잔상 조건이 되살아났다(`screen-options.ts` 머리말 1번)
 *   · 키보드 Tab이 보이지 않는 홈의 단추로 들어가 Enter가 다른 화면으로 보냈다
 *   · 탭 바가 숨는 화면(피드 · 업체 상세)에 가면 뒤에 남은 홈이 72px 커지며 스크롤이 잘렸다
 *
 * 그래서 탭 한 칸마다 이 겉을 씌운다(`Tabs` `screenLayout`).
 *
 *   지금 탭                      그대로(flex 1) — 높이를 기억해 둔다
 *   막 떠난 탭(전환 중)          보이는 채로 **높이를 떠난 순간 값에 묶는다** — 탭 바가 숨어도 자라지
 *                                않아 스크롤이 잘리지 않는다
 *   전환이 끝난 뒤 지나온 탭     `display: none` — 배치 · 키보드 초점 · 스크린 리더에서 빠진다.
 *                                돌아오면 곧바로 다시 그린다(스크롤 위치는 브라우저가 지킨다)
 *
 * «전환이 끝났다»는 하단 탭이 새 탭에 보내는 `transitionEnd`로 안다(중간에 끊긴 전환도 보낸다).
 *
 * **네이티브는 씌우지 않는다.** 네이티브에서 `display: none`은 뷰를 떼어 내(Fabric) 스크롤 위치와
 * 이미지를 잃는다. 네이티브의 지나온 탭은 react-native-screens가 붙여 둔 채(투명 · 뒤) 두고,
 * 스크린 리더에서는 `@react-navigation/elements` Screen의 `aria-hidden`이 이미 뺀다(실기기 확인 전).
 */
export function useTabSceneGate(): {
  screenLayout?: (props: { route: { key: string }; children: ReactNode }) => React.ReactElement;
  screenListeners?: (props: { route: { key: string } }) => { transitionEnd: () => void };
} {
  /* 마지막으로 전환이 끝난 탭. 처음에는 없다 — 첫 전환이 끝나기 전에는 아무것도 떼지 않는다. */
  const [settledKey, setSettledKey] = useState<string | null>(null);

  const screenListeners = useCallback(
    ({ route }: { route: { key: string } }) => ({ transitionEnd: () => setSettledKey(route.key) }),
    []
  );

  const screenLayout = useCallback(
    ({ route, children }: { route: { key: string }; children: ReactNode }) => (
      <TabScene settledElsewhere={settledKey !== null && settledKey !== route.key}>{children}</TabScene>
    ),
    [settledKey]
  );

  if (Platform.OS !== 'web') return {};
  return { screenLayout, screenListeners };
}

export function TabScene({ settledElsewhere, children }: { settledElsewhere: boolean; children: ReactNode }) {
  /* 탭 내비게이터가 그리는 그 차례의 값이다(렌더 중 확정) — 이벤트를 기다리지 않는다. */
  const focused = useIsFocused();
  const [height, setHeight] = useState<number | null>(null);

  const hidden = !focused && settledElsewhere;
  const frozen = !focused && !hidden && height !== null;

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (focused) setHeight(event.nativeEvent.layout.height);
    },
    [focused]
  );

  return (
    <View
      onLayout={onLayout}
      style={frozen ? [styles.frozen, { height }] : [styles.scene, hidden ? styles.hidden : null]}
      testID="tab-scene">
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1 },
  /*
   * 높이를 묶을 때는 `flex`를 쓰지 않는다 — 웹에서 `flex: 0`은 flex-basis 0%라 적어 둔 높이를 이겨
   * 판이 0으로 접혔다(2026-09-26 실측: 떠나는 홈이 페이드 동안 빈 화면). 줄어들지만 않게 둔다.
   */
  frozen: { flexShrink: 0 },
  hidden: { display: 'none' },
});
