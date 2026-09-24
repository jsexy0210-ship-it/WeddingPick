// 글꼴 변수(시스템 서체 스택)와 글자 크기 변수. 웹폰트는 싣지 않는다 — spec/tokens.json
// typography.$fontFamily · CLAUDE.md 「폰트는 시스템 서체 유지(Pretendard 미적용)」.
import '@weddingpick/ui/tokens.css';
// 브라우저가 입력칸에 얹는 자기 규칙(자동완성 배경 등) 보정. 네이티브에서는 무시된다.
import '@/global.css';

import { DefaultTheme, Stack, ThemeProvider, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useTheme } from '@weddingpick/ui';
import { useStackScreenOptions } from '@/features/navigation/screen-options';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { ResultToastHost } from '@/features/navigation/result-toast-host';

import { entryAfterSignIn, rememberSignedIn } from '@/features/auth/finish-sign-in';
import { completeAuthPopup, isAuthPopup } from '@/features/auth/is-auth-popup';
import { completeKakaoRedirect, hasKakaoReturn } from '@/features/auth/providers';
import { claimSigningInMessageForBoot, setPendingSignInError } from '@/features/auth/sign-in-handoff';
import { SigningInView } from '@/features/auth/signing-in-view';
import { CaptureDraftProvider } from '@/features/capture/capture-draft';
import { ConfirmationDialogHost } from '@/components/confirmation-dialog-host';
import { DocumentStoreProvider } from '@/features/documents/document-store';
import { FullScreenError } from '@/features/errors/full-screen-error';
import { escapeInAppBrowser } from '@/features/inapp-browser/escape';
import { InAppWebShell } from '@/features/in-app-web/in-app-web-shell';
import { InAppBrowserNotice } from '@/features/inapp-browser/in-app-browser-notice';
import { resolveSessionEntry, sessionErrorKind, type SessionEntry } from '@/features/auth/session-recovery';
import { initializeWebShellSession, stripLegacyWebShellToken } from '@/api/web-shell-session';
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
 * 스플래시 다음은 바로 로그인이다(2026-09-04 · v3.11). 최초 실행 소개 4장
 * (WP-APP-003)은 **2026-09-15 대표 지시로 전면 폐기했다** — 「인트로 전면 폐기한다.
 * 온보딩만 유지한다」. `onboarding.tsx`와 `features/onboarding/steps.ts`를 지웠고
 * `/onboarding` 라우트도 `depth-back-rules.ts`에서 내렸다. 남은 온보딩은 `/setup`
 * 세 질문뿐이다.
 *
 * 그전에도 이미 아무도 열지 않는 화면이었다. 기기 저장소의 «소개를 봤는가» 값으로
 * 갈랐던 것을 없앴기 때문이다 — 카카오톡 인앱 브라우저처럼 저장소가 새로 시작되는
 * 곳에서 매번 소개가 먼저 떴다.
 */
type Entry = SessionEntry;

const ENTRY_ROUTE = {
  login: '/login',
  /* v3.29 — 가입이 안 끝난 계정은 온보딩보다 약관 동의(WP-AUTH-010)가 먼저다. */
  consent: '/login/consent',
  setup: '/setup',
} as const;

export default function RootLayout() {
  /*
   * 웹 정적 export의 첫 HTML과 브라우저의 첫 렌더는 반드시 같은 답을 내야 한다.
   * OAuth query · window.opener · userAgent는 서버에 없으므로 render 중 읽지 않는다.
   * 첫 hydration은 기존 스플래시를 그대로 쓰고, effect에서만 브라우저 상태를 읽는다.
   */
  const [browserReady, setBrowserReady] = useState(Platform.OS !== 'web');
  const [authPopup, setAuthPopup] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // 구버전 웹뷰가 URL에 남긴 자격증명은 제품 화면을 열기 전에 제거한다.
    stripLegacyWebShellToken();

    if (isAuthPopup()) {
      // opener에게 결과를 넘긴 뒤 이 창에서는 소비자 부팅을 시작하지 않는다.
      completeAuthPopup();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration이 끝난 뒤에만 팝업 상태를 확정한다
      setAuthPopup(true);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버 snapshot과 첫 브라우저 render를 맞춘 뒤 전환한다
    setBrowserReady(true);
  }, []);

  if (authPopup) return null;

  return <RootLayoutContent browserReady={browserReady} />;
}

function RootLayoutContent({ browserReady }: { browserReady: boolean }) {
  /*
   * **글꼴은 Pretendard이고, 여기서 싣지 않는다.** 이 주석은 2026-09-17까지
   * 「글꼴을 싣지 않는다 — 시스템 서체다」라고 적고 있었는데 **사실과 달랐다.**
   *
   * 2026-09-15에 실제로 실었다. 다만 `useFonts`로 받지 않는다 — 두 길이 따로다.
   *
   *   네이티브   `app.json`의 `expo-font` 플러그인이 TTF 넷을 **빌드 때 앱에 박는다.**
   *              첫 화면에서 기다릴 것이 없다.
   *   웹        `+html.tsx`의 `@font-face`가 `PretendardVariable.woff2`를 받는다.
   *              `font-display: swap`이라 글자가 먼저 뜨고 나중에 바뀐다.
   *
   * 옛 주석이 남은 이유는 **`useFonts`를 뺀 것과 글꼴을 뺀 것을 같은 일로 적었기**
   * 때문이다. 부르는 코드가 없다고 글꼴이 없는 것이 아니다 — 싣는 자리가 옮겨 갔다.
   */
  const [entry, setEntry] = useState<Entry | null>(null);
  const [entryError, setEntryError] = useState<unknown>(null);
  const [entryAttempt, setEntryAttempt] = useState(0);
  const boot = useRef<{ attempt: number; promise: Promise<Entry> } | null>(null);
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
  /*
   * hydration 중에는 브라우저 query를 읽지 않는다. 서버와 브라우저 모두
   * signingIn=false · minimumShown=false로 시작한 뒤 browserReady 이후 판정한다.
   */
  const [signingIn, setSigningIn] = useState(false);
  const [minimumShown, setMinimumShown] = useState(false);
  /*
   * 카카오톡·인스타그램 등의 인앱 브라우저로 열렸으면 바깥 브라우저로 넘긴다
   * (`features/inapp-browser`). 부팅의 첫 순간에 한 번만 한다 — 화면을 그리고
   * 서버를 묻기 시작한 뒤에 창이 바뀌면 그 일이 전부 헛일이 된다.
   *
   * 돌려주는 값은 화면 맨 위에 남길 한 줄이다 — 자동 이동이 막혔을 때 누를
   * 자리이거나(카카오톡·안드로이드), 넘길 방법이 없어 사람에게 맡기는
   * 안내다(iOS의 인스타그램·페이스북·라인 — 사파리를 강제로 띄우는 공개 API가
   * 없다).
   */
  const [inAppNotice, setInAppNotice] = useState<ReturnType<typeof escapeInAppBrowser>>({ kind: 'none' });
  const redirected = useRef(false);
  /** 웹 OAuth 복귀에서 pending Pick을 끝낸 뒤 돌아갈 실제 제품 화면. */
  const postSignInRoute = useRef<string | null>(null);
  const pathname = usePathname();
  /*
   * 지금 열린 것이 관리자 콘솔인가. 관리자는 웹 전용이고(`admin/_layout.tsx`),
   * 커플 앱의 첫 화면 규칙 밖에 있다. 주소가 바뀌면 페이지가 다시 뜨는 정적
   * export라 매 렌더 계산해도 값이 흔들리지 않는다.
   */
  const isAdminPath = Platform.OS === 'web' && (pathname === '/admin' || pathname.startsWith('/admin/'));
  const theme = useTheme();
  const stackScreenOptions = useStackScreenOptions();

  useEffect(() => {
    // 관리자 콘솔은 소비자 OAuth·인앱 브라우저 판정을 하지 않는다.
    if (isAdminPath || !browserReady) return;

    const returning = hasKakaoReturn();

    if (returning) {
      claimSigningInMessageForBoot();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- OAuth query는 hydration 뒤에만 상태로 승격한다
      setSigningIn(true);
      // OAuth 복귀는 스플래시 최소 노출을 다시 기다리지 않는다.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 같은 bootstrap 전환의 최소 노출 상태다
      setMinimumShown(true);
    }

    // userAgent/window.location도 hydration 뒤에만 읽는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 환경 판정 결과를 hydration 뒤에만 반영한다
    setInAppNotice(escapeInAppBrowser());
  }, [browserReady, isAdminPath]);
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
    /*
     * 화면을 넘길 때마다(push · replace) 방금 있던 화면의 `View`가
     * `aria-hidden="true"`로 감춰진다 — expo-router가 포크해 쓰는 Stack의
     * `CardA11yWrapper`가 `focused`가 아닌 카드에 무조건 그렇게 건다
     * (`node_modules/expo-router/build/react-navigation/stack/views/Stack/CardA11yWrapper.js`).
     * 그런데 화면을 넘긴 단추(Pressable)는 그 순간까지도 DOM 포커스를 쥐고 있다 —
     * `aria-hidden`이 걸린 조상 안에 포커스가 그대로 남은 상태가 되고, Chrome이
     * 「Blocked aria-hidden on an element because its descendant retained focus」를
     * 찍는다. `/pick` · `/search` · `/wedding/<id>/events/new` ·
     * `/my/reports` 등 여러 화면에서 났던 이유가 이것이다 — 화면 하나의 문제가
     * 아니라 모든 push·replace가 지나는 Stack 자체의 문제다.
     *
     * 화면마다 누르는 단추에서 따로 blur하지 않는다 — 어느 화면이 다음에 이걸
     * 겪을지 알 수 없고, 화면마다 고치면 빠진 화면에서 또 난다. 경로가 바뀔 때마다
     * (모든 내비게이션이 지나는 단 하나의 자리) 여기서 포커스를 놓는다.
     */
    if (Platform.OS !== 'web' || !browserReady) return;

    const active = document.activeElement;

    if (active instanceof HTMLElement && active !== document.body) active.blur();
  }, [browserReady, pathname]);

  useEffect(() => {
    // 관리자 콘솔은 자체 인증을 사용한다. hydration 전에도 소비자 부팅을 시작하지 않는다.
    if (isAdminPath || !browserReady) return;

    let cancelled = false;

    // React StrictMode가 effect를 다시 실행해도 일회용 OAuth 코드를 두 번 교환하지 않는다.
    if (!boot.current || boot.current.attempt !== entryAttempt) {
      const promise = (async (): Promise<Entry> => {
        await initializeWebShellSession();

        if (hasKakaoReturn()) {
          try {
            const session = await completeKakaoRedirect();

            if (session) {
              const next = await entryAfterSignIn(session);
              /* v3.29 — 가입 전(활성화 전) 계정은 약관 동의(`/login/consent`)나 온보딩(`/setup`) 둘 중 하나로 간다. */
              const pending = next === '/setup' || next === '/login/consent';

              void rememberSignedIn({ provider: 'kakao', email: null }, pending);

              // 웹 카카오 복귀는 RootLayout이 최종 라우팅을 맡는다. 몇 값으로
              // 뭉개기 전에 pending Pick의 실제 복귀 목적지를 한 번 보존한다.
              postSignInRoute.current = !pending && next !== '/(tabs)' ? next : null;

              if (next === '/setup') return 'setup';
              if (next === '/login/consent') return 'consent';
              return 'app';
            }
          } catch (caught) {
            setPendingSignInError(caught instanceof Error ? caught.message : '로그인하지 못했어요.');
          }

          return 'login';
        }

        return resolveSessionEntry();
      })();

      boot.current = { attempt: entryAttempt, promise };
    }

    void boot.current.promise.then(
      (next) => {
        if (!cancelled) setEntry(next);
      },
      (error) => {
        if (!cancelled) setEntryError(error);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [browserReady, entryAttempt, isAdminPath]);

  useEffect(() => {
    if (isAdminPath || !browserReady || signingIn) return;

    const timer = setTimeout(() => setMinimumShown(true), SPLASH_MINIMUM_MS);

    return () => clearTimeout(timer);
  }, [browserReady, isAdminPath, signingIn]);

  useEffect(() => {
    /*
     * 웹은 hydration이 끝난 뒤에만 브라우저 상태를 확정한다. 그 전에는 정적 HTML과
     * 같은 스플래시를 유지한다. 네이티브는 browserReady=true로 바로 들어온다.
     */
    if (!browserReady) return;
    SplashScreen.hideAsync();
  }, [browserReady]);

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

    const pendingRoute = postSignInRoute.current;
    if (pendingRoute) {
      postSignInRoute.current = null;
      dismissToOrReplace(pendingRoute);

      return;
    }

    /*
     * 홈으로 갈 사람인데 지금 주소가 로그인·온보딩이면(웹 — 카카오가 등록된
     * redirect 경로로 돌려보낸 직후, 또는 그 주소로 직접 들어온 경우) 그 화면이
     * 그대로 그려진다. 홈으로 옮긴다.
     */
    if (Platform.OS === 'web' && /^\/(login|setup)(\/|$)/.test(window.location.pathname)) {
      dismissToOrReplace('/');
    }
  }, [entry, minimumShown, isAdminPath]);

  /*
   * 첫 화면을 정할 때까지, 그리고 스플래시를 충분히 보여줄 때까지 덮어둔다.
   * 홈이 잠깐 스쳤다 사라지는 것을 막는다.
   */
  if (!isAdminPath && entryError) {
    return <FullScreenError kind={sessionErrorKind(entryError)} onRetry={() => {
      setEntryError(null);
      setEntryAttempt((attempt) => attempt + 1);
    }} />;
  }

  if (!isAdminPath && (!browserReady || entry === null || !minimumShown)) {
    return signingIn ? <SigningInView /> : <SplashView />;
  }

  /* 항상 라이트 — 기기 다크 모드를 따르지 않는다(packages/ui use-color-scheme 참고). */
  return (
    <ThemeProvider value={navigationTheme}>
      <DocumentStoreProvider>
        <CaptureDraftProvider>
          <InAppBrowserNotice notice={inAppNotice} />
          <ConfirmationDialogHost />
          {/*
            바깥 주소를 앱 «안»에 띄우는 껍데기(웹). 뿌리에 한 장만 둔다 — 화면 안에
            두면 탭바·헤더 아래에 갇혀서 앱을 덮지 못한다(2026-09-15 대표 지시 ·
            CLAUDE.md 「앱 밖으로 나가지 않는다」). 네이티브에서는 아무것도 그리지
            않는다 — 거기서는 expo-web-browser의 시스템 시트가 앱 위에 뜬다.
          */}
          <InAppWebShell />
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
          <ResultToastHost />
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
