import { useEffect, useMemo, type ReactNode } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Border,
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
 * 온보딩 한 장의 틀 — docs/design/figma-export/06-onboarding-login.dc.html.
 *
 * 상단은 56px 진행행, 가운데만 스크롤, 하단은 92px 고정 dock이다. 첫 질문은
 * Primary 하나, 2/3·3/3은 «이전» + Primary 두 버튼을 둔다.
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
              borderTopColor: theme.border,
              paddingBottom: Layout.gutter + Math.max(insets.bottom, 0),
              minHeight: DOCK_HEIGHT + Math.max(insets.bottom, 0),
            },
          ]}>
          {paired ? (
            <Pressable
              accessibilityRole="button"
              onPress={onPrev}
              style={({ pressed }) => [
                styles.previous,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="f18" themeColor="textSecondary" style={styles.buttonLabel}>
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
const DOCK_HEIGHT = 92;

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
