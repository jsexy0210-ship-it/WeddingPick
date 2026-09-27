import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Border, Elevation, Layout, SeedIcon, useTheme } from '@weddingpick/ui';

/** 세로 스크롤이 240px를 넘은 화면에서만 보인다. */
export function useScrollToTopVisibility() {
  const [visible, setVisible] = useState(false);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > 240;
    setVisible((current) => (current === next ? current : next));
  }, []);
  const reset = useCallback(() => setVisible(false), []);
  return { visible, onScroll, reset };
}

export function ScrollToTopButton({
  visible,
  onPress,
  bottom = 16,
}: {
  visible: boolean;
  onPress: () => void;
  bottom?: number;
}) {
  const theme = useTheme();
  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={[styles.position, { bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="맨 위로"
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.background, borderColor: theme.border },
          pressed ? styles.pressed : null,
        ]}>
        <View style={styles.icon}>
          <SeedIcon name="chevronRightRegular" size={Layout.iconField} color={theme.text} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  position: { position: 'absolute', left: '50%', marginLeft: -Layout.touchTarget / 2, zIndex: 10 },
  button: {
    width: Layout.touchTarget,
    height: Layout.touchTarget,
    borderRadius: Layout.touchTarget / 2,
    borderWidth: Border.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.floatingCard,
  },
  icon: { transform: [{ rotate: '-90deg' }] },
  pressed: { opacity: 0.7 },
});
