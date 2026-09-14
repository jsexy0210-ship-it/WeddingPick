import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

/**
 * 온보딩 안의 작은 토스트 — 스타일(5/5)에서 3번째를 고르려 할 때 «2개까지 고를 수
 * 있어요»(SPEC §13.6 «선택 정책»). 눌렀는데 아무 일도 없으면 앱이 고장난 줄 알기에
 * 막은 이유를 한 줄로 말한다. 2초 뒤 사라지고, 확인을 누르게 하지 않는다.
 *
 * 화면 하단 dock(92 + 안전영역) 바로 위에 뜬다. 같은 말을 연달아 띄워도 다시 뜨도록
 * `key`로 구분한다 — 3번째 카드를 두 번 눌러도 두 번 답해야 한다.
 */
/** 떠 있는 시간 2초 · 나타나고 사라지는 데 175ms(토큰 motion.color와 같은 길이). */
export const TOAST_MS = 2000;
const FADE_MS = 175;
/** spec/tokens.json size.dock — 토스트는 dock 바로 위에 뜬다. */
const DOCK_HEIGHT = 92;

export type InlineToastState = { message: string; key: number };

export function useInlineToast() {
  const [toast, setToast] = useState<InlineToastState | null>(null);
  const show = useCallback((message: string) => setToast({ message, key: Date.now() }), []);
  const hide = useCallback(() => setToast(null), []);

  return { toast, show, hide };
}

export function InlineToast({ toast, onHidden }: { toast: InlineToastState | null; onHidden: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (toast === null) return;

    opacity.setValue(0);

    const animation = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(TOAST_MS),
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);

    animation.start(({ finished }) => {
      if (finished) onHidden();
    });

    return () => animation.stop();
    // onHidden이 매 렌더 새로 만들어져도 토스트가 다시 뜨지 않게 key만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.key, opacity]);

  if (toast === null) return null;

  return (
    <Animated.View
      accessibilityRole="alert"
      pointerEvents="none"
      style={[
        styles.toast,
        { backgroundColor: theme.backgroundInk, opacity, bottom: DOCK_HEIGHT + Spacing.three + Math.max(insets.bottom, 0) },
      ]}>
      <ThemedText type="t7" themeColor="onTint" style={styles.label} numberOfLines={1}>
        {toast.message}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: Layout.gutter,
    right: Layout.gutter,
    zIndex: 100,
    /* 시안 toastBox — 높이 44 · 좌우 18 · 완전한 pill(20-onboarding-v2.dc.html L414). */
    borderRadius: Radius.pill,
    height: Layout.touchTarget,
    paddingHorizontal: Layout.toastPaddingX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
});
