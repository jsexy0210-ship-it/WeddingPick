import { useEffect, useMemo, type ReactNode } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Border,
  CanonGray,
  Layout,
  MaxContentWidth,
  Motion,
  Radius,
  ThemedText,
  ThemedView,
  USE_NATIVE_DRIVER,
  useTheme,
} from '@weddingpick/ui';

import { OnboardingProgress } from './progress';

/**
 * 온보딩 한 장의 틀 — v3.29 정본
 * `docs/design/React_Native/home.jsx` WP-AUTH-002 ~ 006
 * (`stepNav` · `scroll` · `dockSingle` · `dockPair`).
 *
 * **2026-09-23 정정 — 주석이 파기된 `docs/design/figma-export/06-onboarding-login.dc.html`
 * (2026-09-22에 이미 지워졌다)를 정본으로 적고 있었다.** 값 자체는 이미 v3.29
 * home.js의 `stepNav`(56px) · `dockSingle`/`dockPair`(92px · 12px 24px · gap 10)와
 * 픽셀 단위로 일치해서 고치지 않는다 — 주석의 근거 경로만 바로잡는다.
 *
 * 상단은 56px 진행행, 가운데만 스크롤, 하단은 92px 고정 dock이다. 첫 질문(예식일)은
 * Primary 하나, 2/5 ~ 5/5는 «이전» + Primary 두 버튼을 둔다(질문 5개 기준, WP-AUTH-002
 * ~ 006).
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
  label: string;
  stepKey: string;
  children: ReactNode;
  prevLabel?: string;
  onPrev?: () => void;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  error?: string | null;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const paired = Boolean(prevLabel && onPrev);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <OnboardingProgress label={label} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Rise key={stepKey}>{children}</Rise>
          {error ? (
            <ThemedText type="f13" themeColor="negative" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.dock,
            {
              borderTopColor: CanonGray.gray200,
              paddingBottom: Math.max(DOCK_BOTTOM, Layout.gutter + Math.max(insets.bottom, 0)),
            },
          ]}>
          {paired ? (
            <Pressable
              accessibilityRole="button"
              onPress={onPrev}
              style={({ pressed }) => [
                styles.previous,
                { backgroundColor: CanonGray.gray100 },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="f18" style={[styles.buttonLabel, { color: CanonGray.gray700 }]}>
                {prevLabel}
              </ThemedText>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: nextDisabled }}
            disabled={nextDisabled}
            onPress={onNext}
            style={({ pressed }) => [
              styles.next,
              paired ? styles.nextPaired : styles.nextSingle,
              { backgroundColor: theme.tint },
              nextDisabled && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <ThemedText type="f18" themeColor="onTint" style={styles.buttonLabel}>
              {nextLabel}
            </ThemedText>
          </Pressable>
        </View>
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

const ENTER_BEZIER = [0.16, 1, 0.3, 1] as const;
/*
 * 도크 아래 여백. 정본 그림(home.jsx 5~10번 화면)에서 CTA는 프레임 아래 끝에서 104 위(y 828)에
 * 앉는다 — 위 12 · CTA 56 · 아래 48. 홈 인디케이터가 있는 기기는 24 + inset이 더 크면 그것을 쓴다.
 */
const DOCK_BOTTOM = 48;

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  error: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.inlineGap,
    textAlign: 'center',
  },
  dock: {
    flexDirection: 'row',
    gap: Layout.iconTextGap,
    paddingTop: Layout.inlineGap,
    paddingHorizontal: Layout.gutter,
    borderTopWidth: Border.hairline,
  },
  previous: {
    flex: 1,
    height: 56,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  next: {
    height: 56,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextSingle: { flex: 1 },
  nextPaired: { flex: 1.4 },
  buttonLabel: { fontWeight: 700 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
});
