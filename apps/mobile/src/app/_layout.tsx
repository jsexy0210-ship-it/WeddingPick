// 글꼴 변수(시스템 서체 스택)와 글자 크기 변수. 웹폰트는 싣지 않는다 — spec/tokens.json
// typography.$fontFamily · CLAUDE.md 「폰트는 시스템 서체 유지(Pretendard 미적용)」.
import '@weddingpick/ui/tokens.css';
// 브라우저가 입력칸에 얹는 자기 규칙(자동완성 배경 등) 보정. 네이티브에서는 무시된다.
import '@/global.css';

import { DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useTheme } from '@weddingpick/ui';
import { useStackScreenOptions } from '@/features/navigation/screen-options';

import { entryAfterSignIn, rememberSignedIn } from '@/features/auth/finish-sign-in';
import { completeAuthPopup, isAuthPopup } from '@/features/auth/is-auth-popup';
import { completeKakaoRedirect, hasKakaoReturn } from '@/features/auth/providers';
import { claimSigningInMessageForBoot, setPendingSignInError } from '@/features/auth/sign-in-handoff';
import { SigningInView } from '@/features/auth/signing-in-view';
import { CaptureDraftProvider } from '@/features/capture/capture-draft';
import { DocumentStoreProvider } from '@/features/documents/document-store';
import { FullScreenError } from '@/features/errors/full-screen-error';
import { getAppBootstrap, getCurrentUser, getSignupState } from '@/api/client';
import { loadToken, saveToken } from '@/api/session';
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
/*
 * 스플래시 다음은 바로 로그인이다(2026-09-04 · v3.11). 최초 실행 소개 5장
 * (WP-APP-003, `onboarding.tsx`)은 보류 — 화면 파일은 두되 어디서도 열지 않는다.
 * 기기 저장소의 «소개를 봤는가» 값으로 갈랐던 것을 없앴다: 카카오톡 인앱
 * 브라우저처럼 저장소가 새로 시작되는 곳에서 매번 소개가 먼저 떴다.
 */
type Entry = 'login' | 'setup' | 'app';

const ENTRY_ROUTE = {
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
  /*
   * 글꼴을 싣지 않는다 — 시스템 서체다(iOS Apple SD Gothic Neo · Android Roboto/Noto Sans KR ·
   * 웹 시스템 스택). 한때 Pretendard TTF를 useFonts로 받아 첫 화면을 그만큼 늦췄는데, 핸드오프
   * v3.24까지 「Pretendard 도입 보류」라 2026-09-09 감사에서 뺐다(packages/ui theme.ts Fonts 참고).
   */
  const [entry, setEntry] = useState<Entry | null>(null);
  /**
   * 스플래시를 이만큼은 보여준다. 핸드오프 0번.
   *
   * 첫 화면을 빨리 정했다고 스플래시가 깜빡이고 사라지면, 사용자는 무언가
   * 잘못됐다고 느낀다. 애니메이션이 끝나기 전에 화면이 바뀌는 것도 마찬가지다.
   */
  /*
   * 카카오에서 같은 창으로 돌아온 부팅인가. 이때는 스플래시가 아니라 «로그인하는
   * 중» 화면을 보이고, 스플래시 최소 노출도 기다리지 않는다 — 동의를 마치고
   * 돌아온 사람에게 앱이 다시 켜지는 것처럼 보이면 안 된다.
   */
  /*
   * 카카오에서 돌아왔는가. 여기서 한 번 붙잡아 두는 이유는 두 가지다 — 아래에서
   * `completeKakaoRedirect()`가 URL의 `code`를 지워 버리므로 나중에 다시 물어볼 수 없고,
   * 「로그인하는 중이에요」를 이 부팅이 맡는다는 것도 같은 순간에 정해야 한다.
   */
  const [signingIn] = useState(() => {
    const returning = hasKakaoReturn();

    if (returning) claimSigningInMessageForBoot();

    return returning;
  });
  const [minimumShown, setMinimumShown] = useState(() => hasKakaoReturn());
  const redirected = useRef(false);
  /*
   * 지금 열린 것이 관리자 콘솔인가. 관리자는 웹 전용이고(`admin/_layout.tsx`),
   * 커플 앱의 첫 화면 규칙 밖에 있다. 주소가 바뀌면 페이지가 다시 뜨는 정적
   * export라 매 렌더 계산해도 값이 흔들리지 않는다.
   */
  const isAdminPath =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/admin');
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
  const theme = useTheme();
  const stackScreenOptions = useStackScreenOptions();
  /*
   * 라우터가 화면 뒤에 까는 색. 기본값(react-navigation `DefaultTheme`)은
   * rgb(242,242,242)로 우리 토큰에 없는 회색이라, 화면이 그려지기 전 한 프레임과
   * 화면이 밀려나는 동안 그 회색이 보였다. 값은 전부 spec/tokens.json에서 온다.
   */
  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: theme.tint,
        background: theme.background,
        card: theme.background,
        text: theme.text,
        border: theme.border,
      },
    }),
    [theme]
  );

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
      /*
       * 카카오에서 같은 창으로 돌아온 직후다(웹). 로그인 화면을 거치지 않고
       * 스플래시에서 곧장 마무리한다 — 코드를 세션으로 바꾸고, 그 응답이 알려준
       * 값으로 온보딩/홈을 바로 첫 화면으로 정한다(2026-09-08). 실패한 이유는
       * 로그인 화면에 넘겨 시트로 띄운다.
       */
      if (hasKakaoReturn()) {
        try {
          const session = await completeKakaoRedirect();

          if (session) {
            const next = await entryAfterSignIn(session);

            void rememberSignedIn({ provider: 'kakao', email: null }, next === '/setup');
            setEntry(next === '/setup' ? 'setup' : 'app');

            return;
          }
        } catch (caught) {
          setPendingSignInError(caught instanceof Error ? caught.message : '로그인하지 못했어요.');
        }

        setEntry('login');

        return;
      }

      /*
       * 토큰이 없으면 물어볼 것도 없다. 예전에는 여기서도 `/v1/me`를 부르고 그게
       * 401로 돌아오기를 기다렸다 — 로그인 화면이 그만큼 늦게 떴다.
       */
      if (!(await loadToken())) {
        setEntry('login');

        return;
      }

      /*
       * 로그인한 사람은 서버가 답한다. **두 가지를 한꺼번에 묻는다**(2026-09-09).
       *
       * 첫 화면을 정하는 데는 `/v1/me`만 있으면 되지만, 홈으로 갈 사람은 그
       * 직후에 홈이 `/v1/app/bootstrap`을 다시 묻는다. 순서대로 두면 스플래시가
       * 끝난 뒤 빈 홈을 한 번 더 기다리게 된다 — 왕복 두 번이 줄줄이 이어진다.
       * 같이 보내면 스플래시를 보여주는 동안 둘 다 끝나고, 홈은 읽기 캐시에서
       * 곧바로 받아 그린다(api/client.ts). 실패는 어느 쪽도 부팅을 막지 않는다.
       */
      const [me] = await Promise.all([
        getCurrentUser().catch(() => null),
        getAppBootstrap().catch(() => undefined),
      ]);

      if (me) {
        setEntry(me.setupComplete ? 'app' : 'setup');

        return;
      }

      /*
       * 토큰은 있는데 «나»를 못 물었다. 가입이 안 끝난 계정이면 대기 상태가
       * 돌아온다.
       */
      const signup = await getSignupState().catch(() => null);

      /*
       * 예전에는 여기서 별도 «가입 마무리» 화면으로 보냈다. 만 14세 확인은
       * 로그인 화면 체크박스로 옮겼고(v3.13), 동의 기록은 온보딩(`/setup`)이
       * 마친다 — 여기서 옛 화면으로 계속 보내면 옮긴 게 소용없다.
       * finish-sign-in.ts의 같은 판단과 다르지 않게 둔다.
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
    if (signingIn) return;

    const timer = setTimeout(() => setMinimumShown(true), SPLASH_MINIMUM_MS);

    return () => clearTimeout(timer);
  }, [signingIn]);

  useEffect(() => {
    /*
     * 우리 스플래시가 뜨자마자 네이티브 스플래시를 내린다. 첫 화면을 정할 때까지
     * 기다리면 그동안 우리 것이 가려져 애니메이션을 아무도 못 본다.
     */
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    /*
     * **관리자 콘솔은 앱의 첫 화면 규칙을 타지 않는다.**
     *
     * 아래 규칙은 커플 앱을 위한 것이다 — 로그인했나, 온보딩을 마쳤나를 보고
     * 첫 화면을 정한다. 그런데 그 판단이 주소를 가리지 않아서 `/admin`으로 들어온
     * 운영자도 `/login`이나 `/setup`으로 밀려났다. **관리자 화면이 한 장도 안 뜨던
     * 원인이 이것이다**(2026-09-09).
     *
     * 관리자는 자체 인증이 있다 — `admin/_api.ts`가 토큰을 실어 보내고, 권한이
     * 없으면 서버가 401·403으로 답한다. 화면이 그 오류를 보여주는 것이 맞지,
     * 커플 앱 온보딩으로 보내는 것은 맞지 않다.
     */
    if (isAdminPath) return;

    if (entry === null || !minimumShown) return;

    if (redirected.current) return;

    redirected.current = true;

    if (entry !== 'app') {
      router.replace(ENTRY_ROUTE[entry]);

      return;
    }

    /*
     * 홈으로 갈 사람인데 지금 주소가 로그인·온보딩이면(웹 — 카카오가 등록된
     * redirect 경로로 돌려보낸 직후, 또는 그 주소로 직접 들어온 경우) 그 화면이
     * 그대로 그려진다. 홈으로 옮긴다.
     */
    if (Platform.OS === 'web' && /^\/(login|setup)(\/|$)/.test(window.location.pathname)) {
      router.replace('/');
    }
  }, [entry, minimumShown]);

  /*
   * 첫 화면을 정할 때까지, 그리고 스플래시를 충분히 보여줄 때까지 덮어둔다.
   * 홈이 잠깐 스쳤다 사라지는 것을 막는다.
   */
  if (!isAdminPath && (entry === null || !minimumShown)) {
    return signingIn ? <SigningInView /> : <SplashView />;
  }

  /* 항상 라이트 — 기기 다크 모드를 따르지 않는다(packages/ui use-color-scheme 참고). */
  return (
    <ThemeProvider value={navigationTheme}>
      <DocumentStoreProvider>
        <CaptureDraftProvider>
          <Stack screenOptions={stackScreenOptions}>
            <Stack.Screen name="(tabs)" />
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

/**
 * 앱 전체의 오류 경계. expo-router가 이 이름의 export를 찾아 쓴다.
 *
 * **없었다**(Release Audit 1차 P0-4, 2026-09-09). `ErrorBoundary` ·
 * `componentDidCatch` · `getDerivedStateFromError`가 저장소 전체에 0건이었다.
 * 개발 빌드에서는 expo-router의 기본 오류 화면이 떠서 눈에 띄지 않지만
 * **프로덕션 빌드에는 그 화면이 없다** — 그리다 죽으면 흰 화면만 남고
 * 사용자가 할 수 있는 일은 앱을 껐다 켜는 것뿐이었다.
 *
 * 뿌리에 두는 이유는 여기가 마지막 그물이기 때문이다. 화면 하나가 실패한 것은
 * 그 화면 안에서 말하는 것이 맞고(`ErrorView`), 여기까지 올라온 것은 그 화면이
 * 스스로 말할 수 없었던 실패다.
 *
 * `retry`는 expo-router가 준다 — 경계를 비우고 다시 그린다. 앱을 껐다 켜는 것과
 * 달리 스택이 남는다.
 *
 * **문구는 «잠시 문제가 생겼어요»다**(`error.general.*`). 오류 내용을 그대로
 * 보여주지 않는다 — 스택 트레이스에는 파일 경로와 내부 이름이 들어 있고,
 * 사용자가 그걸로 할 수 있는 일이 없다. 진단은 로그가 맡는다.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  console.error('화면을 그리다 죽었다.', error);

  return <FullScreenError kind="general" onRetry={() => void retry()} />;
}
