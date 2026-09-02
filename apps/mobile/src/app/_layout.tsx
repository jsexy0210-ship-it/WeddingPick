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
import { getCurrentUser, getSignupState } from '@/api/client';
import { isOnboardingCompleted } from '@/features/onboarding/onboarding-state';
import { loadWeddingDraft } from '@/features/onboarding/wedding-draft';
import { SPLASH_MINIMUM_MS, SplashView } from '@/features/splash/splash-view';

SplashScreen.preventAutoHideAsync();

/**
 * 첫 화면을 정한다.
 *
 * 순서가 정해져 있다: 온보딩 → (로그인했다면) 가입 마무리 → 최소 온보딩 → 홈.
 *
 * **로그인은 여기서 묻지 않는다.** 통합정책 v3.10 §2가 최초 실행에 로그인을
 * 강제하지 않는다고 정했다. 그래서 예식일·지역을 아직 안 적은 사람은 로그인
 * 여부와 상관없이 그 화면으로 보낸다 — 로그인한 사람은 서버가, 로그인 전인
 * 사람은 기기에 적어둔 값이 그 판정을 준다.
 *
 * 다만 **로그인은 했는데 가입이 안 끝난 사람**은 다르다(v3.13 §N-2). 서버가
 * 그 계정의 다른 경로를 전부 막고 있어서, 그대로 두면 어느 화면을 열어도
 * 막혔다는 말만 듣는다. 마칠 수 있는 화면으로 보낸다.
 */
type Entry = 'onboarding' | 'signup' | 'setup' | 'app';

const ENTRY_ROUTE = {
  onboarding: '/onboarding',
  signup: '/signup',
  setup: '/setup',
} as const;

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [entry, setEntry] = useState<Entry | null>(null);
  /**
   * 스플래시를 이만큼은 보여준다. 핸드오프 0번.
   *
   * 첫 화면을 빨리 정했다고 스플래시가 깜빡이고 사라지면, 사용자는 무언가
   * 잘못됐다고 느낀다. 애니메이션이 끝나기 전에 화면이 바뀌는 것도 마찬가지다.
   */
  const [minimumShown, setMinimumShown] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    void (async () => {
      const onboarded = await isOnboardingCompleted().catch(() => false);

      if (!onboarded) {
        setEntry('onboarding');

        return;
      }

      /*
       * 로그인한 사람은 서버가 답한다. 못 물어보면(비로그인·서버 없음) 기기에
       * 적어둔 값을 본다 — 지연 로그인이라 로그인 전에도 이 값이 있을 수 있다.
       */
      const me = await getCurrentUser().catch(() => null);

      if (me) {
        setEntry(me.setupComplete ? 'app' : 'setup');

        return;
      }

      /*
       * 못 물어본 이유가 둘이다 — 토큰이 없거나(비로그인·서버 없음), 토큰은
       * 있는데 가입이 안 끝났거나. 앞의 경우 이 요청도 실패해 null이 되고,
       * 뒤의 경우에만 대기 상태가 돌아온다.
       */
      const signup = await getSignupState().catch(() => null);

      if (signup && !signup.activated) {
        setEntry('signup');

        return;
      }

      const draft = await loadWeddingDraft().catch(() => null);

      setEntry(draft ? 'app' : 'setup');
    })();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumShown(true), SPLASH_MINIMUM_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    /*
     * 우리 스플래시가 뜨자마자 네이티브 스플래시를 내린다. 첫 화면을 정할 때까지
     * 기다리면 그동안 우리 것이 가려져 애니메이션을 아무도 못 본다.
     */
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (entry === null || !minimumShown) return;

    if (entry !== 'app' && !redirected.current) {
      redirected.current = true;
      router.replace(ENTRY_ROUTE[entry]);
    }
  }, [entry, minimumShown]);

  /*
   * 첫 화면을 정할 때까지, 그리고 스플래시를 충분히 보여줄 때까지 덮어둔다.
   * 홈이 잠깐 스쳤다 사라지는 것을 막는다.
   */
  if (entry === null || !minimumShown) {
    return <SplashView />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DocumentStoreProvider>
        <CaptureDraftProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
            {/*
              가입이 끝나기 전에는 나갈 곳이 없다. 제스처로 빠져나가면 서버가
              전부 막아둔 계정으로 앱을 헤매게 된다(v3.13 §N-2).
            */}
            <Stack.Screen name="signup" options={{ gestureEnabled: false }} />
            {/* 예식일·지역 없이는 개인화가 없다. 제스처로도 나갈 수 없게 한다. */}
            <Stack.Screen name="setup" options={{ gestureEnabled: false }} />
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
          </Stack>
        </CaptureDraftProvider>
      </DocumentStoreProvider>
    </ThemeProvider>
  );
}
