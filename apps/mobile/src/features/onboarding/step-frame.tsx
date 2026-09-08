import { useEffect, useMemo, type ReactNode } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Motion,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

import { AnsweredRow } from './answered-row';
import type { AnsweredRowModel, QuestionStep } from './flow';
import { OnboardingProgress } from './progress';

/**
 * 초기 설정 한 화면의 틀(WP-APP-020 · 022). 시안 20-onboarding-v2 `phone` —
 *
 *   nav 56           진행바 + «N/5»
 *   scroll (flex 1)  질문 블록 · … · 답 줄(margin-top:auto) · 여백 16
 *   dock 92          [이전] [다음]
 *
 * **스크롤 컨테이너는 이 ScrollView 하나다**(SPEC §13.5.5 이중 스크롤 금지). 질문
 * 안의 목록·격자는 전부 이 안에서 같이 늘어난다 — 준비 현황(3/5)이 뷰포트를 넘치면
 * 화면 전체가 스크롤한다. 답 줄은 `marginTop: 'auto'`로 바닥에 붙어 2·3·4 스텝의
 * 하단 정렬이 같다.
 *
 * dock은 안전 영역 아래 여백을 더한다 — spec/tokens.json safeArea.formula.dock
 * «92 + max(safeBottom, 0)».
 */
export function StepFrame({
  progress,
  label,
  stepKey,
  children,
  answered = [],
  onEdit,
  prevLabel,
  onPrev,
  nextLabel,
  onNext,
  nextDisabled = false,
  error,
}: {
  progress: number;
  label: string;
  /** 바뀌면 질문 블록이 위에서 내려온다(시안 wpDrop). */
  stepKey: string;
  children: ReactNode;
  answered?: readonly AnsweredRowModel[];
  onEdit?: (step: QuestionStep) => void;
  /** 없으면 «이전» 버튼이 없다 — 첫 질문과 완료 화면. */
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
        <OnboardingProgress progress={progress} label={label} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Drop key={stepKey}>{children}</Drop>

          {answered.length > 0 ? (
            <View style={styles.answered}>
              {answered.map((row) => (
                <AnsweredRow
                  key={row.step}
                  label={row.label}
                  value={row.value}
                  onEdit={() => onEdit?.(row.step)}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.tail} />
        </ScrollView>

        <ThemedView
          style={[
            styles.dock,
            { borderTopColor: theme.border, paddingBottom: DOCK_BOTTOM + Math.max(insets.bottom, 0) },
          ]}>
          {error ? (
            <ThemedText type="t7" themeColor="negative" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          <View style={styles.buttons}>
            {prevLabel && onPrev ? (
              <View style={styles.prev}>
                <ActionButton size="xlarge" label={prevLabel} onPress={onPrev} />
              </View>
            ) : null}
            <View style={styles.next}>
              <ActionButton
                variant="primary"
                size="xlarge"
                label={nextLabel}
                disabled={nextDisabled}
                onPress={onNext}
              />
            </View>
          </View>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * 질문 블록이 위에서 내려온다 — 시안 wpDrop(translateY -14 → 0 · opacity 0 → 1).
 * 답한 질문이 아래로 가라앉고 새 질문이 위에서 오는 «은행앱 방식»(v3.19)의 절반이다.
 */
function Drop({ children }: { children: ReactNode }) {
  const progress = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: Motion.enter.duration,
      easing: Easing.bezier(...ENTER_BEZIER),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-DROP_FROM, 0] }) }],
      }}>
      {children}
    </Animated.View>
  );
}

/** spec/tokens.json motion.sheetEnter easing — Motion.enter는 문자열이라 여기 숫자로 둔다. */
const ENTER_BEZIER = [0.16, 1, 0.3, 1] as const;
/** 시안 wpDrop 시작 위치. */
const DROP_FROM = 14;
/** spec/tokens.json safeArea.formula.sheetBottomPadding의 고정항 — dock도 같은 28이다. */
const DOCK_BOTTOM = 28;

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  scroll: { flex: 1 },
  /* 내용이 짧아도 답 줄이 바닥에 붙도록 늘린다. */
  content: { flexGrow: 1 },
  /* 시안 answeredWrap — margin auto 24 0 · 상하 6 · 줄 사이 2. */
  answered: {
    marginTop: 'auto',
    marginHorizontal: Layout.gutter,
    paddingVertical: Spacing.two - Spacing.half,
    gap: Spacing.half,
  },
  tail: { height: Spacing.three },
  /* 시안 dock 92 = 상 12 + CTA + 하 28. inset 0 1px 0 #EAEBEE는 위 1px 선. */
  dock: {
    borderTopWidth: 1,
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    gap: Spacing.two,
  },
  error: { textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  prev: { flex: 1 },
  /* 시안 ctaStyle flex:1.4 — «다음»이 «이전»보다 넓다. */
  next: { flex: 1.4 },
});
