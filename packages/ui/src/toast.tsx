import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, ToastAndroid } from 'react-native';

import { Layout, Radius, Spacing, USE_NATIVE_DRIVER } from './theme';
import { FontSize, LineHeight } from './typography';
import { useTheme } from './use-theme';

export type ToastProps = {
  /** 보여줄 말. null이면 아무것도 그리지 않는다. */
  message: string | null;
  onHidden?: () => void;
};

/** 화면 하단에서 이만큼 띄운다. 핸드오프 — 96px. */
const BOTTOM = 96;
/** 사용자 설정: 결과 알림은 1초 뒤 사라진다. */
export const TOAST_MS = 1000;
const FADE_MS = 175;

/**
 * 잠깐 뜨는 안내. 디자인 핸드오프 인터랙션 규칙.
 *
 * 저장·수정·삭제 결과와 막힌 이유를 짧게 알린다. Android에서는 OS 토스트를,
 * iOS·웹에서는 같은 문구의 앱 토스트를 쓴다. 되돌리기 동작이 필요한 삭제는
 * 별도의 액션 토스트가 맡는다.
 */
export function Toast({ message, onHidden }: ToastProps) {
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(0));
  /** 사라지는 동안에도 그려야 해서, 글자는 따로 붙잡아 둔다. */
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (message === null) return;

    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      onHidden?.();
      return;
    }

    setShown(message);

    const animation = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.delay(TOAST_MS - FADE_MS * 2),
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);

    animation.start(({ finished }) => {
      if (!finished) return;

      setShown(null);
      onHidden?.();
    });

    return () => animation.stop();
    // onHidden이 매 렌더 새로 만들어져도 토스트가 다시 뜨지 않게, 글자만 본다.
  }, [message, opacity]);

  if (Platform.OS === 'android' || shown === null) return null;

  return (
    <Animated.Text
      accessibilityRole="alert"
      style={[styles.toast, { backgroundColor: theme.backgroundInk, color: theme.onInk, opacity }]}>
      {shown}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: Layout.gutter,
    right: Layout.gutter,
    bottom: BOTTOM,
    // 바텀시트 위에도 보여야 한다.
    zIndex: 100,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    textAlign: 'center',
    fontSize: FontSize.t6,
    lineHeight: LineHeight.t6,
  },
});
