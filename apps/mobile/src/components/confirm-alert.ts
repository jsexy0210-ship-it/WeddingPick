import { Alert } from 'react-native';

import type { AlertButton } from './confirmation-queue';

/** 네이티브 구현. 웹은 같은 경로의 confirm-alert.web.ts가 담당한다. */
export function confirmAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  Alert.alert(title, message, buttons);
}
