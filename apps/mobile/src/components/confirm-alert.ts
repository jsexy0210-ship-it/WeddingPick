import { Alert, Platform } from 'react-native';

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

/**
 * `Alert.alert`의 얇은 래퍼.
 *
 * `react-native-web`의 `Alert.alert`는 아무 것도 하지 않는 빈 구현이다 —
 * 웹(하이브리드 웹뷰)에서는 로그아웃·탈퇴·삭제 같은 확인창이 뜨지 않고
 * `onPress`도 절대 불리지 않는다. 네이티브에서는 원래 `Alert.alert` 그대로
 * 쓰고, 웹에서만 `window.confirm`/`window.alert`로 같은 확인 흐름을 만든다.
 */
export function confirmAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length === 0) {
    window.alert(text);
    return;
  }

  if (buttons.length === 1) {
    window.alert(text);
    buttons[0].onPress?.();
    return;
  }

  const cancelButton = buttons.find((button) => button.style === 'cancel');
  const confirmButton = buttons.find((button) => button !== cancelButton) ?? buttons[buttons.length - 1];

  if (window.confirm(text)) {
    confirmButton?.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
