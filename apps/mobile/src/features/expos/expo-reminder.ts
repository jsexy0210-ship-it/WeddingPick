import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

/**
 * WP-EXPO-002 알림. 박람회 시작 하루 전, 기기 안에서만 울리는 로컬 알림이다.
 *
 * 서버 푸시가 아니다 — 박람회는 운영이 올리는 콘텐츠일 뿐 사용자별 상태가
 * 아니라서, "이 사람에게 언제 알릴지"를 서버가 따로 들고 있을 이유가 없다.
 * 기기에 예약해두면 서버도, 그걸 매일 스캔해 보낼 배치도 필요 없다.
 */
const STORAGE_PREFIX = 'weddingpick.expoReminder.';

export async function isExpoReminderSet(expoId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(STORAGE_PREFIX + expoId)) !== null;
}

export type ReminderResult =
  | { ok: true }
  | { ok: false; reason: 'permission_denied'; canAskAgain: boolean }
  | { ok: false; reason: 'too_late' }
  | { ok: false; reason: 'unknown'; message: string };

export async function scheduleExpoReminder(expo: {
  id: string;
  name: string;
  startsAt: string;
}): Promise<ReminderResult> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    const granted = existing.granted ? existing : await Notifications.requestPermissionsAsync();

    if (!granted.granted) {
      return { ok: false, reason: 'permission_denied', canAskAgain: granted.canAskAgain };
    }

    const date = new Date(new Date(expo.startsAt).getTime() - 24 * 60 * 60 * 1000);

    if (date.getTime() <= Date.now()) {
      return { ok: false, reason: 'too_late' };
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: { title: '내일 박람회가 시작해요', body: expo.name },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });

    await AsyncStorage.setItem(STORAGE_PREFIX + expo.id, identifier);

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'unknown', message: error instanceof Error ? error.message : '' };
  }
}

export async function cancelExpoReminder(expoId: string): Promise<void> {
  const identifier = await AsyncStorage.getItem(STORAGE_PREFIX + expoId);

  if (identifier) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    await AsyncStorage.removeItem(STORAGE_PREFIX + expoId);
  }
}
