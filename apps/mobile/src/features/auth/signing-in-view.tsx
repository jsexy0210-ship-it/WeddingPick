import { ActivityIndicator, StyleSheet } from 'react-native';

import { Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

/**
 * 카카오에서 같은 창으로 돌아온 직후, 코드를 세션으로 바꾸는 동안 보이는 화면.
 *
 * 스플래시가 아니다 — 스플래시는 앱이 켜지는 신호라, 카카오 동의를 마치고 돌아온
 * 사람이 그걸 다시 보면 «처음부터 다시 시작하나» 하고 읽는다(2026-09-08 보고).
 * 로그인 화면의 진행 표시(«카카오로 로그인하는 중이에요»)와 같은 모양으로,
 * 이어지는 한 단계라는 것만 보인다. 끝나면 온보딩/홈으로 곧장 간다.
 */
export function SigningInView() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ActivityIndicator size="large" color={theme.tint} />
      <ThemedText type="small" themeColor="textAssistive">
        카카오로 로그인하는 중이에요
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
});
