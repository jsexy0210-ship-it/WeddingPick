import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

/**
 * 온보딩 머리 — 규격서 docs/design/figma-export/06-onboarding-login.dc.html(2026-09-15 대표 지시 「규격서의 수를 그대로」).
 *
 *   div 382×20  flex · justify space-between · align center
 *     button "나중에" · 14/500 #868B94 · lh 20        (둘째 질문부터는 «이전»)
 *     span "01 / 03" · 12/400 #868B94 · lh 16
 *   div 382×4  flex · gap 6 · mar 20 0 0 0
 *     span 123×4  bg primary · r9999      ← 지난 질문과 지금 질문
 *     span 123×4  bg #F7F8F9 · r9999      ← 남은 질문
 *
 * 첫 질문의 «나중에»는 우리 흐름에 건너뛰기가 없어 그리지 않는다(판단 필요 — PR 본문).
 */
export function OnboardingProgress({
  label,
  leftLabel,
  onLeft,
}: {
  /** `stepProgress().label` — «1/3» 꼴. 완료 화면은 «완료». */
  label: string;
  leftLabel?: string;
  onLeft?: () => void;
}) {
  const theme = useTheme();
  const counter = parseCounter(label);

  return (
    <ThemedView style={styles.bar}>
      <View style={styles.row}>
        {leftLabel && onLeft ? (
          <Pressable accessibilityRole="button" onPress={onLeft} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="f14" themeColor="textAssistive" style={styles.left}>
              {leftLabel}
            </ThemedText>
          </Pressable>
        ) : (
          <View />
        )}
        <ThemedText type="f12" themeColor="textAssistive" numeric>
          {counter ? `${pad(counter.current)} / ${pad(counter.total)}` : label}
        </ThemedText>
      </View>
      <View style={styles.track}>
        {Array.from({ length: counter?.total ?? 1 }, (_, index) => (
          <View
            key={index}
            style={[
              styles.segment,
              { backgroundColor: counter === null || index < counter.current ? theme.tint : theme.backgroundElement },
            ]}
          />
        ))}
      </View>
    </ThemedView>
  );
}

function parseCounter(label: string): { current: number; total: number } | null {
  const match = /^(\d+)\s*\/\s*(\d+)$/.exec(label);

  return match ? { current: Number(match[1]), total: Number(match[2]) } : null;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 막대 «382×4». */
const TRACK = 4;

const styles = StyleSheet.create({
  /* 화면 «pad 32 24 32 24»의 위 · 좌우. 줄 ↔ 막대 «mar 20 0 0 0». */
  bar: {
    paddingTop: Spacing.five,
    paddingHorizontal: Layout.gutter,
    gap: Layout.listGap,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: Layout.iconRow },
  /* «14/500». */
  left: { fontWeight: 500 },
  /* «flex · gap 6». */
  track: { flexDirection: 'row', gap: Layout.menuGroupGap, height: TRACK },
  segment: { flex: 1, height: TRACK, borderRadius: Radius.pill },
  pressed: { opacity: 0.8 },
});
