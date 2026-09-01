import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { Layout, Radius, Spacing } from './theme';
import { FontSize, LineHeight } from './typography';
import { useTheme } from './use-theme';

export type ToastProps = {
  /** 보여줄 말. null이면 아무것도 그리지 않는다. */
  message: string | null;
  onHidden?: () => void;
};

/** 화면 하단에서 이만큼 띄운다. 핸드오프 — 96px. */
const BOTTOM = 96;
/** 이만큼 뒤에 사라진다. 핸드오프 — 2.2초. */
export const TOAST_MS = 2200;

/**
 * 잠깐 뜨는 안내. 디자인 핸드오프 인터랙션 규칙.
 *
 * **막은 이유를 말하는 자리다.** 다른 업종을 담으려 할 때처럼, 눌렀는데 아무 일도
 * 일어나지 않는 순간이 있으면 사용자는 앱이 고장난 줄 안다.
 *
 * 다이얼로그가 아니다 — 확인을 누르게 하지 않는다. 되돌릴 것이 있는 일에는
 * 토스트가 아니라 컨펌을 쓴다.
 */
export function Toast({ message, onHidden }: ToastProps) {
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(0));
  /** 사라지는 동안에도 그려야 해서, 글자는 따로 붙잡아 둔다. */
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (message === null) return;

    setShown(message);

    const animation = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 175,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(TOAST_MS),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 175,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
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

  if (shown === null) return null;

  return (
    <Animated.Text
      accessibilityRole="alert"
      style={[styles.toast, { backgroundColor: theme.backgroundInk, color: theme.onTint, opacity }]}>
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
