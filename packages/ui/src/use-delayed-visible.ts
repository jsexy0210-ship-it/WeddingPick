import { useEffect, useState } from 'react';

import { Motion } from './theme';

/**
 * 700ms 규칙(`motion.loaderThreshold`). 응답이 700ms를 넘으면 화면 성격과 무관하게
 * 로더를 띄우고, 700ms 안에 오면 아무것도 띄우지 않는다.
 *
 * `active`가 `delay` ms 동안 계속 true였을 때만 true를 돌려준다. `active`가 꺼지면
 * 즉시 false다.
 *
 * ```tsx
 * const showLoader = useDelayedVisible(isLoading);
 * {showLoader ? <CategoryCycleLoader size={28} /> : null}
 * ```
 */
export function useDelayedVisible(active: boolean, delay: number = Motion.loaderThreshold): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) {
      setElapsed(false);
      return;
    }
    const timer = setTimeout(() => setElapsed(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);

  return active && elapsed;
}
