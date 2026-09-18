import { Alert } from 'react-native';

import type { AlertButton } from './confirmation-queue';

/**
 * 네이티브 확인창도 09-dialogs의 핵심 순서를 따른다.
 *
 * - 취소는 왼쪽/먼저
 * - 일반 실행은 가운데
 * - 되돌릴 수 없는 실행은 마지막
 *
 * 웹은 confirm-alert.web.ts가 A/B/C/E를 직접 그린다. 네이티브 Alert는 플랫폼 UI를
 * 그대로 쓰되, 호출부마다 버튼 순서가 흔들리지 않게 여기서 한 번 정규화한다.
 */
export function orderNativeAlertButtons(
  buttons?: readonly AlertButton[]
): AlertButton[] | undefined {
  if (!buttons) return undefined;
  if (buttons.length < 2) return buttons.map((button) => ({ ...button }));

  const cancel = buttons.filter((button) => button.style === 'cancel');
  const normal = buttons.filter(
    (button) => button.style !== 'cancel' && button.style !== 'destructive'
  );
  const destructive = buttons.filter((button) => button.style === 'destructive');

  return [...cancel, ...normal, ...destructive].map((button) => ({ ...button }));
}

/** 네이티브 구현. 웹은 같은 경로의 confirm-alert.web.ts가 담당한다. */
export function confirmAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const ordered = orderNativeAlertButtons(buttons);
  const destructive = ordered?.some((button) => button.style === 'destructive') ?? false;

  Alert.alert(
    title,
    message,
    ordered,
    // DLG-C는 배경/뒤로가기로 닫히면 안 된다. 그 밖은 플랫폼 기본 취소 동작을 허용한다.
    destructive ? { cancelable: false } : undefined
  );
}
