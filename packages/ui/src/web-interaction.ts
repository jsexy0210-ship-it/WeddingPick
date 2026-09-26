import { Platform, type PressableStateCallbackType, type ViewStyle } from 'react-native';

import { Motion } from './theme';

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

/**
 * 누름 반응을 한 번에 튀지 않고 `Motion.pressButton`(100ms)만큼 이어 준다 — 웹 전용.
 *
 * `pressed`로 바뀌는 `scale(.98)` · 투명도는 네이티브에서는 손가락이 닿는 순간 OS가 바로 그리는
 * 것이 자연스럽지만, 웹에서는 한 프레임에 뚝 바뀌어 «웹 페이지 단추»처럼 보였다(2026-09-26 대표
 * 「실제 앱처럼 자연스러운 … 부가요소」). react-native-web이 `transition*` 스타일을 CSS로 그대로
 * 옮기므로 transform · opacity만 이어 준다(합성 단계 — 레이아웃을 다시 계산하지 않는다).
 * 네이티브에서는 빈 객체다. RN 타입에 없는 웹 속성이라 `ViewStyle`로 한 번 감싼다.
 */
export const PRESS_TRANSITION: ViewStyle = Platform.OS === 'web'
  ? ({
      transitionProperty: 'transform, opacity, background-color',
      transitionDuration: `${Motion.pressButton.duration}ms`,
      transitionTimingFunction: 'ease-out',
    } as unknown as ViewStyle)
  : {};
