import { useState } from 'react';

/**
 * 웹에서만 실제로 발생하는 hover·focus 상태. 터치 기기에서는 `hovered`/`focused`가
 * 항상 false로 남는다 — `Pressable`의 `onHoverIn`/`onHoverOut`/`onFocus`/`onBlur`는
 * 네이티브에서 호출되지 않기 때문이다.
 *
 * RN→웹 전환 화면에서 카드·행 같은 커스텀 `Pressable`에 최소한의 마우스·키보드
 * 피드백을 주기 위해 쓴다.
 */
export function useHoverFocus() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return {
    hovered,
    focused,
    hoverFocusHandlers: {
      onHoverIn: () => setHovered(true),
      onHoverOut: () => setHovered(false),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  };
}
