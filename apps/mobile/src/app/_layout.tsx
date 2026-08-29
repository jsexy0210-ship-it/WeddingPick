// Pretendard를 먼저 싣고, 그 위에 글꼴 변수를 얹는다. 순서가 아니라 두 줄인 것이
// 중요하다 — tokens.css는 자립해야 해서 글꼴을 직접 부르지 않는다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@weddingpick/ui/tokens.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';

import { CaptureDraftProvider } from '@/features/capture/capture-draft';
import { DocumentStoreProvider } from '@/features/documents/document-store';
import { getCurrentUser } from '@/api/client';
import { isOnboardingCompleted } from '@/features/onboarding/onboarding-state';

SplashScreen.preventAutoHideAsync();

/**
 * 첫 화면을 정한다.
 *
 * 순서가 정해져 있다: 온보딩 → 이름·예식일 등록 → 홈. 핸드오프 2번이 등록을
 * **스킵할 수 없는 화면**으로 정했으므로, 등록을 마치지 않은 사람은 로그인해도
 * 홈으로 가지 않는다.
 *
 * 로그인하지 않은 사람은 등록으로 보내지 않는다 — 게스트도 검색과 업체 상세를
 * 볼 수 있어야 하고(핸드오프 이용 등급), 그러려면 이름이 필요 없다.
 */
type Entry = 'onboarding' | 'setup' | 'app';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [entry, setEntry] = useState<Entry | null>(null);
  const redirected = useRef(false);

  useEffect(() => {
    void (async () => {
      const onboarded = await isOnboardingCompleted().catch(() => false);

      if (!onboarded) {
        setEntry('onboarding');

        return;
      }

      /*
       * 로그인한 사람만 등록 상태를 물어볼 수 있다. 못 물어보면(비로그인·서버
       * 없음) 앱으로 들여보낸다 — 첫 화면을 못 정해서 앱이 안 열리는 것이 가장 나쁘다.
       */
      const me = await getCurrentUser().catch(() => null);

      setEntry(me && !me.setupComplete ? 'setup' : 'app');
    })();
  }, []);

  useEffect(() => {
    if (entry === null) return;

    SplashScreen.hideAsync();

    if (entry !== 'app' && !redirected.current) {
      redirected.current = true;
      router.replace(entry === 'onboarding' ? '/onboarding' : '/setup');
    }
  }, [entry]);

  // 첫 화면을 모르는 동안은 스플래시를 그대로 둔다. 홈이 잠깐 스쳤다 사라지는 걸 막는다.
  if (entry === null) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DocumentStoreProvider>
        <CaptureDraftProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
            {/* 스킵할 수 없는 화면이라 제스처로도 나갈 수 없게 한다. */}
            <Stack.Screen name="setup" options={{ gestureEnabled: false }} />
            <Stack.Screen name="home-edit" options={{ presentation: 'modal' }} />
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
          </Stack>
        </CaptureDraftProvider>
      </DocumentStoreProvider>
    </ThemeProvider>
  );
}
