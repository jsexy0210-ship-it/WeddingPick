import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getCurrentUser, signOut as apiSignOut } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';

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
    setState({ status: 'signedOut' });
  }, []);

  return { state, refresh, signOut };
}
