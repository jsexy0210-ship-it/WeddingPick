import { StyleSheet, View } from 'react-native';

import { Layout, Radius, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

/**
 * 온보딩 진행 표시 — v3.29 정본 `docs/design/React_Native/home.jsx`
 * WP-AUTH-002 ~ 006(`stepNav` · `progTrack` · `stepLabel`).
 *
 * **2026-09-23 정정** — 주석이 파기된 `figma-export/06-onboarding-login.dc.html`을
 * 근거로 적고 있었다. 56px 행 안에 4px 단일 트랙 + N/5만 둔다 — 다섯 질문 기준
 * 20 · 40 · 60 · 80 · 100%(`flow.ts`의 `stepProgress`). «이전»은 상단에 두지 않고
 * StepFrame의 하단 dock으로 내려간다.
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
