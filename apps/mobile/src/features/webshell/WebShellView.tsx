import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { Layout, MaxContentWidth, Spacing, ThemedText, ThemedView, Spinner } from '@weddingpick/ui';
import { loadToken } from '@/api/session';

import { WEB_SHELL_URL } from './config';

type Props = {
  /** 웹 export 안에서 열 경로. 예: "/", "/pick". */
  path: string;
};

/**
 * 하이브리드 웹뷰 쉘.
 *
 * 네이티브 쉘(탭바 등 네비게이션 껍데기)은 그대로 두고, 화면 본문만 호스팅된
 * `apps/mobile` 웹 export(react-native-web)를 웹뷰로 띄운다.
 *
 * **로그인 세션은 최초 진입 URL에 한 번만 실어 보낸다.** 웹 export는 같은
 * 코드베이스(`@/api/session`)를 web 타깃으로 빌드한 것이라, 쿼리 파라미터로
 * 받은 토큰을 웹 쪽 루트 레이아웃(`app/_layout.tsx`)이 그대로 `saveToken`으로
 * 저장하고 주소창에서 지운다 — 새 저장소나 postMessage 프로토콜을 따로 만들지
 * 않는다. 이후 웹뷰 내부 이동에는 토큰을 다시 붙이지 않는다: 한 번 저장하면
 * 웹 쪽 스토리지(AsyncStorage의 web 폴리필, 즉 localStorage)에 남기 때문이다.
 */
export function WebShellView({ path }: Props) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadToken().then((token) => {
      if (cancelled) return;

      const base = `${WEB_SHELL_URL ?? ''}${path}`;

      setUri(token ? `${base}?wp_token=${encodeURIComponent(token)}` : base);
    });

    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!WEB_SHELL_URL) {
    return (
      <Frame>
        <ThemedText type="t5">웹 화면을 열 수 없어요</ThemedText>
        <ThemedText type="t7" themeColor="textSecondary">
          EXPO_PUBLIC_WEB_URL이 설정되지 않았어요.
        </ThemedText>
      </Frame>
    );
  }

  if (!uri) {
    return (
      <Frame>
        <Spinner size={40} />
      </Frame>
    );
  }

  return (
    <WebView
      source={{ uri }}
      style={styles.flex}
      startInLoadingState
      renderLoading={() => (
        <Frame>
          <Spinner size={40} />
        </Frame>
      )}
      renderError={() => (
        <Frame>
          <ThemedText type="t5">불러오지 못했어요</ThemedText>
          <ThemedText type="t7" themeColor="textSecondary">
            잠시 후 다시 시도해주세요.
          </ThemedText>
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
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Layout.gutter,
  },
});
