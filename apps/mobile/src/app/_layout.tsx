import '@weddingpick/ui/tokens.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';

import { CaptureDraftProvider } from '@/features/capture/capture-draft';
import { DocumentStoreProvider } from '@/features/documents/document-store';
import { isOnboardingCompleted } from '@/features/onboarding/onboarding-state';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const redirected = useRef(false);

  useEffect(() => {
    isOnboardingCompleted()
      .then(setOnboarded)
      // 저장소를 못 읽으면 온보딩을 한 번 더 보여주는 쪽이 낫다.
      .catch(() => setOnboarded(false));
  }, []);

  useEffect(() => {
    if (onboarded === null) return;

    SplashScreen.hideAsync();

    if (!onboarded && !redirected.current) {
      redirected.current = true;
      router.replace('/onboarding');
    }
  }, [onboarded]);

  // 온보딩 여부를 모르는 동안은 스플래시를 그대로 둔다. 홈이 잠깐 스쳤다 사라지는 걸 막는다.
  if (onboarded === null) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DocumentStoreProvider>
        <CaptureDraftProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
          </Stack>
        </CaptureDraftProvider>
      </DocumentStoreProvider>
    </ThemeProvider>
  );
}
