import '@weddingpick/ui/tokens.css';
import '@/global.css';

import { DefaultTheme, Stack, ThemeProvider, router, usePathname } from 'expo-router';
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
import { escapeInAppBrowser } from '@/features/inapp-browser/escape';
import { InAppWebShell } from '@/features/in-app-web/in-app-web-shell';
import { InAppBrowserNotice } from '@/features/inapp-browser/in-app-browser-notice';
import { resolveSessionEntry, sessionErrorKind, type SessionEntry } from '@/features/auth/session-recovery';
import { initializeWebShellSession, stripLegacyWebShellToken } from '@/api/web-shell-session';
import { SPLASH_MINIMUM_MS, SplashView } from '@/features/splash/splash-view';

SplashScreen.preventAutoHideAsync();

/** 소셜 인증과 가입 완료는 다르다. 미활성 계정은 기존 /setup 복구 흐름을 유지한다. */
type Entry = SessionEntry;
const ENTRY_ROUTE = { login: '/login', setup: '/setup' } as const;

export default function RootLayout() {
  // 외부 브라우저로 이동하거나 하위 화면을 그리기 전에 구버전 URL 자격증명을 제거한다.
  stripLegacyWebShellToken();
  if (isAuthPopup()) {
    completeAuthPopup();
    return null;
  }
  return <RootLayoutContent />;
}

function RootLayoutContent() {
  // Pretendard는 네이티브 빌드와 +html.tsx에서 싣는다. 인증 변경으로 서체를 바꾸지 않는다.
  const [entry, setEntry] = useState<Entry | null>(null);
  const [entryError, setEntryError] = useState<unknown>(null);
  const [entryAttempt, setEntryAttempt] = useState(0);
  const boot = useRef<{ attempt: number; promise: Promise<Entry> } | null>(null);
  const [signingIn] = useState(() => {
    const returning = hasKakaoReturn();
    if (returning) claimSigningInMessageForBoot();
    return returning;
  });
  const [minimumShown, setMinimumShown] = useState(() => hasKakaoReturn());
  const [inAppNotice] = useState(escapeInAppBrowser);
  const redirected = useRef(false);
  const isAdminPath = Platform.OS === 'web' && typeof window !== 'undefined' &&
    /^\/admin(?:\/|$)/.test(window.location.pathname);
  const theme = useTheme();
  const stackScreenOptions = useStackScreenOptions();
  const navigationTheme = useMemo(() => ({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors, primary: theme.tint, background: theme.background,
      card: theme.background, text: theme.text, border: theme.border,
    },
  }), [theme]);
  const pathname = usePathname();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) active.blur();
  }, [pathname]);

  useEffect(() => {
    // 관리자는 자체 인증을 사용한다. 소비자 부팅 조회로 세션을 만지지 않는다.
    if (isAdminPath) return;
    let cancelled = false;
    // StrictMode의 effect 재실행도 일회용 카카오 코드를 중복 교환하지 않는다.
    if (!boot.current || boot.current.attempt !== entryAttempt) {
      const promise = (async (): Promise<Entry> => {
        await initializeWebShellSession();
        if (hasKakaoReturn()) {
          try {
            const session = await completeKakaoRedirect();
            if (session) {
              const next = await entryAfterSignIn(session);
              void rememberSignedIn({ provider: 'kakao', email: null }, next === '/setup');
              return next === '/setup' ? 'setup' : 'app';
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
      (next) => { if (!cancelled) setEntry(next); },
      (error) => { if (!cancelled) setEntryError(error); }
    );
    return () => { cancelled = true; };
  }, [entryAttempt, isAdminPath]);

  useEffect(() => {
    if (signingIn) return;
    const timer = setTimeout(() => setMinimumShown(true), SPLASH_MINIMUM_MS);
    return () => clearTimeout(timer);
  }, [signingIn]);
  useEffect(() => { SplashScreen.hideAsync(); }, []);

  useEffect(() => {
    if (isAdminPath || entry === null || !minimumShown || redirected.current) return;
    redirected.current = true;
    if (entry !== 'app') { router.replace(ENTRY_ROUTE[entry]); return; }
    if (Platform.OS === 'web' && /^\/(login|setup)(\/|$)/.test(window.location.pathname)) {
      router.replace('/');
    }
  }, [entry, minimumShown, isAdminPath]);

  if (!isAdminPath && entryError) {
    return <FullScreenError kind={sessionErrorKind(entryError)} onRetry={() => {
      setEntryError(null);
      setEntryAttempt((attempt) => attempt + 1);
    }} />;
  }
  if (!isAdminPath && (entry === null || !minimumShown)) {
    return signingIn ? <SigningInView /> : <SplashView />;
  }
  return (
    <ThemeProvider value={navigationTheme}>
      <DocumentStoreProvider>
        <CaptureDraftProvider>
          <InAppBrowserNotice notice={inAppNotice} />
          <InAppWebShell />
          <Stack screenOptions={stackScreenOptions}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="setup" options={{ gestureEnabled: false }} />
            <Stack.Screen name="login" options={{ gestureEnabled: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
          </Stack>
        </CaptureDraftProvider>
      </DocumentStoreProvider>
    </ThemeProvider>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  console.error('화면을 그리다 죽었다.', error);
  return <FullScreenError kind="general" onRetry={() => void retry()} />;
}
