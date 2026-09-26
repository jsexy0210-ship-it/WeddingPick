import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * 「움직임 줄이기」 — iOS · 안드로이드 접근성 설정, 웹은 `prefers-reduced-motion`.
 *
 * 켜져 있으면 화면 전환 · 시트 · 풀팝업 · 토스트가 이동 없이 페이드(또는 즉시)로 바뀐다.
 * 바텀시트에만 있던 것을 화면 전환(`features/navigation/screen-options`)과 토스트도
 * 같이 보도록 여기로 뗐다 — 자리마다 따로 읽으면 한 곳만 설정을 무시하게 된다.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (alive) setReduce(enabled);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
