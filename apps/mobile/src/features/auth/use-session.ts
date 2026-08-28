import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { getCurrentUser, signOut as apiSignOut } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';
import { registerForPushNotifications } from '@/features/notifications/register-device';

export type SessionState =
  | { status: 'loading' }
  /** 서버 주소가 없는 빌드. 촬영과 기기 저장까지만 된다. */
  | { status: 'offline' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; userId: string };

/**
 * 지금 로그인되어 있는지.
 *
 * 토큰이 있다고 로그인된 것은 아니다 — 만료됐거나 서버에서 지워졌을 수 있다.
 * 서버에 한 번 물어본 뒤에야 "로그인됨"이라고 말한다.
 */
export function useSession() {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  /*
   * 이 화면은 다시 보일 때마다 세션을 확인한다. 그때마다 기기를 등록하면 같은
   * 일을 계속 하게 되므로, 사람이 바뀌었을 때만 한 번 한다.
   */
  const registeredFor = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isServerConfigured) {
      setState({ status: 'offline' });
      return;
    }

    if (!(await loadToken())) {
      setState({ status: 'signedOut' });
      return;
    }

    try {
      const me = await getCurrentUser();
      setState({ status: 'signedIn', userId: me.userId });

      if (registeredFor.current !== me.userId) {
        registeredFor.current = me.userId;
        // 실패해도 앱은 계속 돈다. 푸시는 곁가지고, 여기서 막히면 로그인이 안
        // 되는 것처럼 보인다.
        void registerForPushNotifications();
      }
    } catch {
      // 토큰이 만료됐으면 client가 이미 지웠다.
      setState({ status: 'signedOut' });
    }
  }, []);

  // 로그인 화면에서 돌아왔을 수도 있다. 화면이 다시 보일 때마다 확인한다.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const signOut = useCallback(async () => {
    await apiSignOut();
    // 다른 사람으로 다시 로그인하면 이 기기는 그 사람 것이 된다.
    registeredFor.current = null;
    setState({ status: 'signedOut' });
  }, []);

  return { state, refresh, signOut };
}
