import type { PressableStateCallbackType } from 'react-native';

/**
 * `react-native`의 `PressableStateCallbackType`은 `pressed`만 정의한다.
 * `react-native-web`은 같은 콜백에 `hovered`·`focused`도 실제로 넘겨주지만
 * (마우스 오버·키보드 포커스), 타입 선언은 네이티브 쪽만 따라간다 — 웹 전용
 * 필드라 타입에 없다. 네이티브에서는 항상 `false`로 읽힌다.
 */
export type WebInteractionState = PressableStateCallbackType & {
  hovered?: boolean;
  focused?: boolean;
};

export function readWebInteractionState(state: PressableStateCallbackType): Required<WebInteractionState> {
  const web = state as WebInteractionState;
  return { pressed: web.pressed, hovered: web.hovered === true, focused: web.focused === true };
}
