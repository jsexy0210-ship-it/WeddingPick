import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const subscribe = () => () => {};

/**
 * 웹 정적 렌더링을 지원하려면 이 값을 클라이언트에서 다시 계산해야 한다.
 * 서버 스냅샷은 false, 클라이언트 스냅샷은 true이므로 hydration 이후에만 실제 색상 스킴을 쓴다.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const colorScheme = useRNColorScheme();

  return hasHydrated ? colorScheme : 'light';
}
