import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Layout, MaxContentWidth, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { clearTokenIfMatches, loadToken, subscribeToken } from '@/api/session';

import { WEB_SHELL_URL } from './config';
import { isTrustedWebShellUrl, parseWebShellMessage, sessionInjection, webShellTarget } from './session-protocol';

type Props = { path: string };

/** 세션은 신뢰한 메인 프레임의 일회성 요청에만 전달한다. source URI에는 토큰이 없다. */
export function WebShellView({ path }: Props) {
  // react-native-webview 14.0.1의 기본 제네릭(undefined)이 props를 never로 만드는 타입 버그 우회.
  // 업스트림 수정이 안정판에 들어오면 명시 제네릭을 제거해도 된다.
  const web = useRef<WebView<Record<never, never>>>(null);
  const generation = useRef(0);
  const offered = useRef<{ channel: string; token: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);
  const target = useMemo(() => {
    try { return WEB_SHELL_URL ? webShellTarget(WEB_SHELL_URL, path) : null; }
    catch { return null; }
  }, [path]);

  useEffect(() => {
    const invalidateSessionOffer = () => {
      generation.current += 1;
      offered.current = null;
    };
    const unsubscribe = subscribeToken(() => {
      invalidateSessionOffer();
      setRevision((value) => value + 1);
    });
    return () => {
      invalidateSessionOffer();
      unsubscribe();
    };
  }, []);

  async function onMessage(event: WebViewMessageEvent): Promise<void> {
    if (!target) return;
    const message = parseWebShellMessage(event.nativeEvent.data, event.nativeEvent.url, target.origin);
    if (!message) return;
    const current = generation.current;
    try {
      if (message.type === 'session:clear') {
        const previous = offered.current;
        if (!previous || previous.channel !== message.channel) return;
        if (await clearTokenIfMatches(previous.token)) router.replace('/login');
        return;
      }
      const token = await loadToken();
      if (current !== generation.current) return;
      if (token !== await loadToken() || current !== generation.current) return;
      if (token === null) {
        router.replace('/login');
        return;
      }
      const script = sessionInjection(target.origin, message.channel, token);
      offered.current = { channel: message.channel, token };
      web.current?.injectJavaScript(script);
    } catch {
      if (current === generation.current) setError(true);
    }
  }

  function openExternal(url: string): void {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password ||
          parsed.searchParams.has('wp_token')) return;
      void WebBrowser.openBrowserAsync(parsed.href).catch(() => setError(true));
    } catch { /* 앱 스킴·파일·스크립트 주소는 웹뷰에서 실행하지 않는다. */ }
  }

  if (!target || error) {
    return (
      <Frame>
        <ThemedText type="t5">웹 화면을 열 수 없어요</ThemedText>
        <ThemedText type="t7" themeColor="textSecondary">
          {!target ? '웹 화면의 HTTPS 주소 설정을 확인해주세요.' : '앱에서 다시 로그인한 뒤 시도해주세요.'}
        </ThemedText>
      </Frame>
    );
  }

  return (
    <WebView<Record<never, never>>
      key={`${target.uri}:${revision}`}
      ref={web}
      source={{ uri: target.uri }}
      style={styles.flex}
      // '*'는 모든 이동을 아래 검사로 보내기 위한 값이다. 허용 판정은 정확한 origin으로 한다.
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={(request) => {
        if (isTrustedWebShellUrl(request.url, target.origin)) {
          if (new URL(request.url).pathname === '/login') { router.replace('/login'); return false; }
          return true;
        }
        if (request.isTopFrame !== false) openExternal(request.url);
        return false;
      }}
      onOpenWindow={(event) => openExternal(event.nativeEvent.targetUrl)}
      onLoadStart={() => { generation.current++; offered.current = null; }}
      onMessage={(event) => { void onMessage(event); }}
      javaScriptCanOpenWindowsAutomatically={false}
      injectedJavaScriptForMainFrameOnly
      mixedContentMode="never"
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      thirdPartyCookiesEnabled={false}
      sharedCookiesEnabled={false}
      startInLoadingState
      renderLoading={() => <Frame><DelayedLoader size={40} /></Frame>}
      renderError={() => (
        <Frame>
          <ThemedText type="t5">불러오지 못했어요</ThemedText>
          <ThemedText type="t7" themeColor="textSecondary">잠시 후 다시 시도해주세요.</ThemedText>
        </Frame>
      )}
    />
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={[styles.center, { maxWidth: MaxContentWidth }]}>{children}</ThemedView>
    </ThemedView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  center: {
    flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.two, paddingHorizontal: Layout.gutter,
  },
});
