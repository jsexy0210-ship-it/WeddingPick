import { Alert, Platform } from 'react-native';

export type ShowAlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

/**
 * react-native-web의 Alert.alert는 빈 함수다 — 웹에서는 메시지도 버튼도 뜨지 않고
 * onPress도 불리지 않는다(`node_modules/react-native-web/dist/exports/Alert`).
 * 확인/삭제 같은 동작이 웹에서 그냥 조용히 아무 일도 안 하게 된다 — 그래서 웹에서는
 * `window.alert`/`window.confirm`으로 대체한다.
 */
export function showAlert(title: string, message?: string, buttons?: ShowAlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);

    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length === 0) {
    window.alert(text);

    return;
  }

  const [onlyButton] = buttons;

  if (buttons.length === 1 && onlyButton) {
    window.alert(text);
    onlyButton.onPress?.();

    return;
  }

  const cancelButton = buttons.find((button) => button.style === 'cancel');
  const confirmButton = buttons.find((button) => button !== cancelButton) ?? onlyButton;

  if (window.confirm(text)) {
    confirmButton?.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
