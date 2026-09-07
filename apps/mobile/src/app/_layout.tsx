// Pretendard를 먼저 싣고, 그 위에 글꼴 변수를 얹는다. 순서가 아니라 두 줄인 것이
// 중요하다 — tokens.css는 자립해야 해서 글꼴을 직접 부르지 않는다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@weddingpick/ui/tokens.css';
// 브라우저가 입력칸에 얹는 자기 규칙(자동완성 배경 등) 보정. 네이티브에서는 무시된다.
import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { useEffect, useRef, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { completeAuthPopup, isAuthPopup } from '@/features/auth/is-auth-popup';
import { CaptureDraftProvider } from '@/features/capture/capture-draft';
import { DocumentStoreProvider } from '@/features/documents/document-store';
import { getCurrentUser, getSignupState } from '@/api/client';
import { saveToken } from '@/api/session';
import { isOnboardingCompleted } from '@/features/onboarding/onboarding-state';
import { SPLASH_MINIMUM_MS, SplashView } from '@/features/splash/splash-view';

SplashScreen.preventAutoHideAsync();

/**
 * 첫 화면을 정한다.
 *
 * 순서가 정해져 있다: 온보딩(최초 실행 소개) → 로그인 → (가입 마무리) → 최소
 * 온보딩 → 홈.
 *
 * **2026-09-04 정책 변경 — 비회원 진입 삭제.** 로그인 없이는 앱을 못 쓴다.
 * 기기에 적어둔 예식 정보 초안만으로 로그인 없이 홈에 들여보내던 지연 로그인
 * 경로는 폐기했다 — 로그인이 안 된 사람은 무조건 로그인 화면으로 보낸다.
 * 최초 실행 소개(온보딩)만은 로그인보다 앞에 둔다 — 계정과 무관한 소개
 * 화면이라 로그인을 막을 이유가 없다.
 *
 * **로그인은 했는데 가입이 안 끝난 사람**은 다르다(v3.13 §N-2). 서버가
 * 그 계정의 다른 경로를 전부 막고 있어서, 그대로 두면 어느 화면을 열어도
 * 막혔다는 말만 듣는다. 마칠 수 있는 화면으로 보낸다.
 */
type Entry = 'onboarding' | 'login' | 'setup' | 'app';

const ENTRY_ROUTE = {
  onboarding: '/onboarding',
  login: '/login',
  setup: '/setup',
} as const;

export default function RootLayout() {
  if (isAuthPopup()) {
    // 훅을 하나도 부르지 않고 빈 화면을 돌려준다 — 부팅을 시작하지 않는다.
    // opener에게 결과를 넘기는 일은 completeAuthPopup()이 따로 한다(is-auth-popup.ts).
    completeAuthPopup();

    return null;
  }

  return <RootLayoutContent />;
}

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  /*
   * 웹에서는 이 TTF(약 3MB, 전체 웨이트를 다 담은 가변 폰트)를 부르지 않는다.
   * 이미 위에서 그 목적으로 부른 `pretendardvariable-dynamic-subset.css`가
   * 화면에 실제로 쓰인 글자만 필요할 때 WOFF2로 나눠 받아온다 — 여기서
   * useFonts로 전체 TTF를 또 불러 첫 화면을 막으면, 이미 CSS가 하고 있는 일을
   * 훨씬 무거운 형식으로 중복해서 기다리는 셈이 된다. 네이티브는 CSS가 없어
   * 이 경로가 유일한 글꼴 공급원이라 그대로 둔다.
   */
  const [fontsLoaded] = useFonts(
    Platform.OS === 'web'
      ? {}
      : { Pretendard: require('pretendard/dist/public/variable/PretendardVariable.ttf') }
  );
  const [entry, setEntry] = useState<Entry | null>(null);
  /**
   * 스플래시를 이만큼은 보여준다. 핸드오프 0번.
   *
   * 첫 화면을 빨리 정했다고 스플래시가 깜빡이고 사라지면, 사용자는 무언가
   * 잘못됐다고 느낀다. 애니메이션이 끝나기 전에 화면이 바뀌는 것도 마찬가지다.
   */
  const [minimumShown, setMinimumShown] = useState(false);
  const redirected = useRef(false);
  /*
   * 네이티브 쉘의 웹뷰가 최초 진입 URL에 `wp_token`을 한 번 실어 보낸다(하이브리드
   * 웹뷰 쉘, `features/webshell`). 웹 export는 이 값을 받아 저장하고 주소창에서
   * 지운다 — 네이티브에서는 애초에 필요 없는 단계라 곧장 완료로 둔다. 토큰이
   * 없는 경우도 초기 렌더 시점에 동기로 판정한다 — 있는 경우만 저장이 끝난 뒤
   * effect 콜백에서 완료로 표시한다.
   */
  const [tokenBootstrapped, setTokenBootstrapped] = useState(() => {
    if (Platform.OS !== 'web') return true;

    return !new URLSearchParams(window.location.search).has('wp_token');
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('wp_token');

    if (!token) return;

    params.delete('wp_token');

    void saveToken(token).then(() => {
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;

      window.history.replaceState(null, '', nextUrl);
      setTokenBootstrapped(true);
    });
  }, []);

  useEffect(() => {
    if (!tokenBootstrapped) return;

    void (async () => {
      const onboarded = await isOnboardingCompleted().catch(() => false);

      if (!onboarded) {
        setEntry('onboarding');

        return;
      }

      /* 로그인한 사람은 서버가 답한다. */
      const me = await getCurrentUser().catch(() => null);

      if (me) {
        setEntry(me.setupComplete ? 'app' : 'setup');

        return;
      }

      /*
       * 못 물어본 이유가 둘이다 — 토큰이 없거나(비로그인), 토큰은 있는데
       * 가입이 안 끝났거나. 앞의 경우 이 요청도 실패해 null이 되고, 뒤의
       * 경우에만 대기 상태가 돌아온다.
       */
      const signup = await getSignupState().catch(() => null);

      /*
       * 예전에는 여기서 별도 «가입 마무리» 화면으로 보냈다. 그 화면이 하던
       * 일(동의 기록·연령 확인)은 온보딩 1/4로 옮겼다 — 여기서 옛 화면으로
       * 계속 보내면 옮긴 게 소용없다. finish-sign-in.ts의 같은 판단과
       * 다르지 않게 둔다.
       */
      if (signup && !signup.activated) {
        setEntry('setup');

        return;
      }

      /* 비회원 진입 삭제 — 로그인이 안 된 사람은 무조건 로그인 화면으로. */
      setEntry('login');
    })();
  }, [tokenBootstrapped]);

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
  if (entry === null || !minimumShown || !fontsLoaded) {
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
            {/* 예식일·지역 없이는 개인화가 없다. 제스처로도 나갈 수 없게 한다. */}
            <Stack.Screen name="setup" options={{ gestureEnabled: false }} />
            {/* 로그인 없이는 앱을 쓸 수 없다. 제스처로 빠져나가면 뒤에 아무것도 없다. */}
            <Stack.Screen name="login" options={{ gestureEnabled: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
          </Stack>
        </CaptureDraftProvider>
      </DocumentStoreProvider>
    </ThemeProvider>
  );
}
