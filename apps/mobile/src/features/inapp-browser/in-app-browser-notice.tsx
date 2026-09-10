import { StyleSheet } from 'react-native';

import { Layout, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

/**
 * `spec/strings.ko.json` `inAppBrowser.guide`의 확정 카피.
 *
 * iOS의 인스타그램·페이스북·라인 인앱 브라우저에서만 보인다 — 사파리를 강제로
 * 띄우는 공개 API가 없어서 사람이 직접 여는 수밖에 없는 자리다(`detect.ts`).
 * 안드로이드와 카카오톡은 이 안내 없이 저절로 넘어간다.
 */
const GUIDE = '오른쪽 위 ···를 눌러 «Safari로 열기»를 선택해주세요';

/**
 * 바깥 브라우저로 옮길 방법이 없을 때 보이는 한 줄.
 *
 * 화면을 덮지 않는다 — 인앱 브라우저에서도 앱을 볼 수는 있고, 막히는 것은
 * 로그인뿐이다. 위에 한 줄만 얹고 나머지는 그대로 쓰게 둔다.
 */
export function InAppBrowserNotice() {
  return (
    <ThemedView type="backgroundSelected" style={styles.bar}>
      <ThemedText type="t7" themeColor="textSecondary" style={styles.text}>
        {GUIDE}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.two,
  },
  text: { textAlign: 'center' },
});
