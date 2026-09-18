import { useEffect, useMemo, type ReactNode } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Layout,
  MaxContentWidth,
  Motion,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  ThemedView,
  USE_NATIVE_DRIVER,
  useTheme,
} from '@weddingpick/ui';

import { OnboardingProgress } from './progress';

/**
 * 온보딩 질문 한 장의 틀 — 규격서 docs/design/figma-export/06-onboarding-login.dc.html(2026-09-15 대표 지시 「규격서의 수를 그대로」).
 *
 *   div 430×932  pad 32 24 32 24 · bg #FFFFFF
 *     (머리 줄 + 막대 ← OnboardingProgress)
 *     (질문 ← QuestionHead · 보기 ← children «mar 40 0 0 0»)
 *     button 382×56  "다음" · 14/700 #FFFFFF · lh 20 · flex · gap 8 · center · mar 40 0 0 0 · bg #1A1C20 · r16
 *       svg 16×16  ChevronRight
 *
 * «이전»은 머리 줄 왼쪽 글자 단추다(피그마 `step ? "이전" : "나중에"`). 하단 dock은 규격서에 없어 뺐다 —
 * 「다음」은 보기 아래 40에 붙어 흐른다.
 *
 * **답 줄(«라벨 · 값 · 바꾸기»)은 없다** — 2026-09-15 대표 지시 「온보딩에 바꾸기 정보 삭제해.
 * 버튼 CTA는 하단에 유지한다」로 걷어냈다. 규격서에도 없던 자리다.
 */
export function StepFrame({
  label,
  stepKey,
  children,
  prevLabel,
  onPrev,
  nextLabel,
  onNext,
  nextDisabled = false,
  error,
}: {
  /** `stepProgress().label` — «1/3» 꼴. */
  label: string;
  /** 바뀌면 질문 블록이 «요소 상승»으로 나타난다. */
  stepKey: string;
  children: ReactNode;
  /** 없으면 «이전»이 없다 — 첫 질문과 완료 화면. */
  prevLabel?: string;
  onPrev?: () => void;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  error?: string | null;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <OnboardingProgress label={label} leftLabel={prevLabel} onLeft={onPrev} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: Spacing.five + Math.max(insets.bottom, 0) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Rise key={stepKey}>{children}</Rise>

          <View style={styles.ctaWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: nextDisabled }}
              disabled={nextDisabled}
              onPress={onNext}
              style={({ pressed }) => [
                styles.next,
                { backgroundColor: theme.text },
                nextDisabled && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <ThemedText type="f14" themeColor="onTint" style={styles.nextLabel}>
                {nextLabel}
              </ThemedText>
              <SeedIcon name="chevronRightRegular" size={Layout.iconField} color={theme.onTint} />
            </Pressable>
            {error ? (
              <ThemedText type="f12" themeColor="negative" style={styles.error}>
                {error}
              </ThemedText>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Rise({ children }: { children: ReactNode }) {
  const progress = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: Motion.rise.duration,
      easing: Easing.bezier(...ENTER_BEZIER),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [Motion.rise.from, 0] }) }],
      }}>
      {children}
    </Animated.View>
  );
}

/** spec/tokens.json motion.sheetEnter easing — Motion.enter는 문자열이라 여기 숫자로 둔다. */
const ENTER_BEZIER = [0.16, 1, 0.3, 1] as const;

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  scroll: { flex: 1 },
  /* 화면 «pad 32 24 32 24»의 아래 32는 위에서 insets와 합친다. */
  content: { flexGrow: 1 },
  /* «mar 40 0 0 0» — 보기 아래 40. 좌우는 화면 24. */
  ctaWrap: { marginTop: Spacing.five + Spacing.two, paddingHorizontal: Layout.gutter, gap: Spacing.two },
  /* «382×56 · gap 8 · r16 · bg #1A1C20». */
  next: {
    height: Layout.ctaSheet,
    borderRadius: Radius.cardLarge,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  /* «14/700». */
  nextLabel: { fontWeight: 700 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  error: { textAlign: 'center' },
});
