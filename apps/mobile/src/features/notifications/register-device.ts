import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { registerDevice } from '@/api/client';

/**
 * 이 기기를 푸시 받을 곳으로 등록한다.
 *
 * 알림은 운영자에게만 간다 — 파기 예정 원본이 생겼다는 알림이다. 그런데 등록은
 * 누구나 한다. 앱이 자기가 운영자인지 판단하려 들면 그 판단이 앱에 들어가고,
 * 앱은 사용자가 고칠 수 있는 곳이다. 서버가 보낼 때 판단한다.
 *
 * 실패해도 앱은 계속 돌아간다. 푸시는 앱이 하는 일의 곁가지고, 여기서 막히면
 * 로그인이 안 되는 것처럼 보인다.
 *
 * `expo-notifications`는 정적으로 얹지 않는다 — 그 모듈은 실려 들어오는 순간
 * `DevicePushTokenAutoRegistration.fx.ts`가 `addPushTokenListener`를 전역으로
 * 건다. 웹은 그 리스너를 지원하지 않아 `console.warn`
 * (`[expo-notifications] Listening to push token changes is not yet fully
 * supported on web.`)이 뜨는데, 플랫폼을 먼저 가른 뒤에도 **`import` 자체가
 * 이미 그 부수효과를 실행한 뒤**라 함수 안에서 걸러도 소용없었다. 웹에서는
 * 아예 이 모듈을 부르지 않는다 — 걸어도 웹은 받지 않는다.
 */
export async function registerForPushNotifications(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { ok: false, reason: '이 플랫폼은 푸시를 받지 않습니다.' };
  }

  // 시뮬레이터는 푸시 토큰을 못 받는다. 실패로 남기면 로그가 지저분해진다.
  if (!Device.isDevice) {
    return { ok: false, reason: '실물 기기가 아닙니다.' };
  }

  const Notifications = await import('expo-notifications');

  try {
    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted || (await Notifications.requestPermissionsAsync()).granted;

    if (!granted) {
      return { ok: false, reason: '알림 권한이 없습니다.' };
    }

    const token = await Notifications.getExpoPushTokenAsync();

    await registerDevice({ token: token.data, platform: Platform.OS });

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
}
