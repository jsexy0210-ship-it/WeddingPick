import { Platform, ToastAndroid } from 'react-native';

import { showResultToast } from '@/features/navigation/result-toast';

/**
 * OS 토스트 — 2026-09-25 대표 지시(예산 한도 알림은 OS 토스트).
 *
 *   안드로이드  시스템 토스트(`ToastAndroid`).
 *   iOS · 웹    시스템 토스트가 없다 — 앱 토스트로 대신한다. 기본은 루트의 결과 토스트
 *               (`showResultToast`)인데, 바텀시트(Modal) 위에서 부르면 루트 토스트가 Modal
 *               아래에 깔려 안 보인다. 그럴 때는 시트 안에 둔 `<Toast>`의 setter를 `fallback`으로 넘긴다.
 */
export function showOsToast(message: string, fallback: (message: string) => void = showResultToast): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }

  fallback(message);
}
