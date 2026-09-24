import { POLICY_DOCUMENTS } from '@weddingpick/domain';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { ActionButton, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { DepthHeader } from '@/components/depth-header';
import { isOurSite } from '@/features/in-app-web/our-site';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { openExternal } from '@/features/open-external';
import strings from '../../../../../spec/strings.ko.json';

/**
 * 이용약관 · 개인정보처리방침 — docs/design/React_Native/my.jsx frame-021(WP-MY-015) ·
 * frame-022(WP-MY-015b). 정본은 MY 「약관」 행을 누르면 **앱 화면**(뒤로가기 헤더 + 제목 +
 * 원문 전체)이 뜨는 모양이다.
 *
 * **본문 사본을 앱에 두지 않는다.** 원문은 웹사이트 하나다(`apps/web/src/subpages.ts`가
 * 관리자 표에서 읽어 굽는 `/terms.html` · `/privacy.html` — CLAUDE.md 「약관과
 * 개인정보처리방침의 정본은 웹사이트다」). `subpages.ts`는 웹 빌드용 HTML 문자열 생성기라
 * (폰트 · 랜딩 · `fetch` 빌드 단계 의존) 앱 번들에서 import할 수 없다. 그래서 그 주소
 * (`POLICY_DOCUMENTS[].url`)를 정본 헤더 아래 **화면 안**에 불러온다 — 네이티브는 WebView,
 * 웹 빌드는 iframe. 앱을 떠나지 않는다(CLAUDE.md 「앱 밖으로 나가지 않는다」).
 *
 * 시행일 · 판 표기(정본 「v1.0 · 2026년 9월 1일 시행」)도 원문 페이지가 적는다 — 앱이
 * 따로 적으면 원문과 어긋나는 날이 온다.
 */
export function PolicyDocumentScreen({ id }: { id: 'terms' | 'privacy' }) {
  const policy = POLICY_DOCUMENTS.find((document) => document.id === id);
  const title = id === 'terms' ? strings.my['item.terms'] : strings.my['item.privacy'];
  const [attempt, setAttempt] = useState(0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <DepthHeader title={title} />
        <View style={styles.body}>
          {!policy?.url ? (
            <Failed />
          ) : Platform.OS === 'web' ? (
            /* DOM 요소다 — 위 `Platform.OS` 검사 덕분에 웹에서만 그려진다(in-app-web-shell.tsx와 같다). */
            <iframe key={attempt} src={policy.url} title={title} style={FRAME_STYLE} />
          ) : (
            <WebView<Record<never, never>>
              key={attempt}
              source={{ uri: policy.url }}
              style={styles.body}
              originWhitelist={['*']}
              onShouldStartLoadWithRequest={(request) => {
                if (isOurSite(request.url)) return true;
                if (request.isTopFrame !== false) void openExternal(request.url);
                return false;
              }}
              javaScriptCanOpenWindowsAutomatically={false}
              mixedContentMode="never"
              allowFileAccess={false}
              thirdPartyCookiesEnabled={false}
              sharedCookiesEnabled={false}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.center}>
                  <DelayedLoader size={28} />
                </View>
              )}
              renderError={() => <Failed onRetry={() => setAttempt((value) => value + 1)} />}
            />
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function Failed({ onRetry }: { onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <ThemedText type="t6" themeColor="textSecondary">
        {strings.journey.loadFailed}
      </ThemedText>
      {onRetry ? <ActionButton variant="secondary" label={strings.common['cta.retry']} onPress={onRetry} /> : null}
    </View>
  );
}

/** DOM 요소라 스타일도 DOM 값이다 — 헤더 아래를 전부 채운다. */
const FRAME_STYLE = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, width: '100%', border: 'none' } as const;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
});
