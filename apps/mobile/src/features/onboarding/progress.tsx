import { StyleSheet, View } from 'react-native';

import { Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

/**
 * 온보딩 진행 표시. 디자인 핸드오프 WP-APP-008~011의 상단 막대.
 *
 * 몇 단계가 남았는지 보이지 않으면 사용자는 끝을 모른 채 답하게 되고, 그때 이탈이
 * 늘어난다. 막대와 숫자를 함께 두는 이유다 — 막대만으로는 «몇 개 남았는가»가
 * 읽히지 않는다.
 */
export function OnboardingProgress({ step, total }: { step: number; total: number }) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.wrap}>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: theme.tint, width: `${(step / total) * 100}%` },
          ]}
        />
      </View>
      <ThemedText type="t7" themeColor="textAssistive">
        {step}/{total}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  track: { flex: 1, height: 4, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
});
