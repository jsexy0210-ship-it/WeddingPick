import { StyleSheet, View } from 'react-native';

import { Layout, Radius, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

/**
 * 온보딩 진행 표시 — docs/design/figma-export/06-onboarding-login.dc.html.
 *
 * 56px 행 안에 4px 단일 트랙 + N/3만 둔다. «이전»은 상단에 두지 않고 StepFrame의
 * 하단 dock으로 내려간다. 정본의 1/3 · 2/3 · 3/3이 각각 33 · 66 · 100%를 채운다.
 */
export function OnboardingProgress({ label }: { label: string }) {
  const theme = useTheme();
  const counter = parseCounter(label);
  const progress = counter === null ? 1 : counter.current / counter.total;

  return (
    <ThemedView style={styles.bar}>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { flex: progress, backgroundColor: theme.tint }]} />
        <View style={{ flex: 1 - progress }} />
      </View>
      <ThemedText type="f13" themeColor="textAssistive" numeric style={styles.label}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

function parseCounter(label: string): { current: number; total: number } | null {
  const match = /^(\d+)\s*\/\s*(\d+)$/.exec(label);

  if (!match) return null;

  const current = Number(match[1]);
  const total = Number(match[2]);

  return total > 0 ? { current, total } : null;
}

const TRACK = 4;

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    paddingHorizontal: Layout.gutter,
  },
  track: {
    flex: 1,
    height: TRACK,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  fill: { height: TRACK, borderRadius: Radius.pill },
  label: { fontWeight: 700 },
});
