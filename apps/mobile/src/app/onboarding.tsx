import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { completeOnboarding } from '@/features/onboarding/onboarding-state';
import { ONBOARDING_STEPS, ctaLabel } from '@/features/onboarding/steps';

/**
 * 온보딩 5장. 디자인 핸드오프 1번.
 *
 * 건너뛰기와 마지막 CTA가 **같은 곳으로 간다** — 이름·예식일 등록이다. 건너뛴
 * 사람에게도 그 화면은 스킵할 수 없다(핸드오프 2번).
 */
export default function OnboardingScreen() {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const step = ONBOARDING_STEPS[index]!;
  const isLast = index === ONBOARDING_STEPS.length - 1;

  async function leave() {
    await completeOnboarding();
    router.replace('/setup');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.skipRow}>
          <ActionButton label="건너뛰기" onPress={() => void leave()} />
        </ThemedView>

        {/* 진행 인디케이터. 활성 22×6, 비활성 6×6. */}
        <ThemedView style={styles.dots}>
          {ONBOARDING_STEPS.map((_, dot) => (
            <View
              key={dot}
              style={[
                styles.dot,
                dot === index
                  ? { width: 22, backgroundColor: theme.tint }
                  : { width: 6, backgroundColor: theme.border },
              ]}
            />
          ))}
        </ThemedView>

        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.headline}>
            {/* 줄바꿈은 수동이다. 핸드오프가 t2에 그렇게 적었다. */}
            {step.headline.map((line) => (
              <ThemedText key={line} type="t2">
                {line}
              </ThemedText>
            ))}
          </ThemedView>

          <ThemedText type="t6" themeColor="textSecondary">
            {step.body}
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            {step.card.map((row) => (
              <ThemedView key={row.label} style={styles.cardRow}>
                <ThemedText type="t6" themeColor="textSecondary">
                  {row.label}
                </ThemedText>
                <ThemedText type="t5" numeric>
                  {row.value}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          <ThemedText type="t7" themeColor="textAssistive">
            {step.caption}
          </ThemedText>
        </ScrollView>

        <ThemedView style={styles.footer}>
          <ActionButton
            variant="primary"
            label={ctaLabel(index)}
            onPress={() => (isLast ? void leave() : setIndex(index + 1))}
          />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: Layout.gutter, paddingTop: Spacing.two },
  dots: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.three,
  },
  dot: { height: 6, borderRadius: Radius.pill },
  content: { paddingHorizontal: Layout.gutter, gap: Spacing.three, paddingBottom: Spacing.four },
  headline: { gap: 0 },
  card: { borderRadius: Radius.medium, padding: Layout.gutter, gap: Spacing.two },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footer: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four, gap: Spacing.two },
});
