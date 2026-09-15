import { StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

/**
 * 온보딩 진행 줄 — 피그마 `Onboarding`(2026-09-14 정본): 위 32 · 오른쪽 끝에 «01 / 03»
 * (12 · muted) · 그 아래 20에 진행 막대 4(키 컬러 채움 · 회색 면). 왼쪽의 «나중에 / 이전»은
 * StepFrame의 dock이 맡는다(기존 정본 — 뒤로 가기 자리는 상세 화면끼리 같다).
 *
 * 값은 `progress`(0~100)와 `label`이고, 무엇을 몇 단계로 세는지는 `flow.ts`가 정한다.
 */
export function OnboardingProgress({
  progress,
  label,
}: {
  progress: number;
  label: string;
}) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.bar}>
      <View style={styles.counterRow}>
        <ThemedText type="micro" themeColor="textAssistive" numeric style={styles.counter}>
          {label}
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.fill, { backgroundColor: theme.tint, width: `${progress}%` }]} />
      </View>
    </ThemedView>
  );
}

/** 막대 `h-1` = 4. */
const TRACK = 4;

const styles = StyleSheet.create({
  /* `px-6 pt-8` — 좌우는 정본 24 · 위 32. 줄 ↔ 막대 `mt-5` = 20(같은 값의 listGap). */
  bar: {
    paddingTop: Spacing.five,
    paddingHorizontal: Layout.gutter,
    gap: Layout.listGap,
  },
  counterRow: { flexDirection: 'row', justifyContent: 'flex-end', minHeight: Layout.iconRow },
  track: { height: TRACK, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  /* `micro`는 기본이 700 — 시안은 regular. */
  counter: { fontWeight: 400 },
});
