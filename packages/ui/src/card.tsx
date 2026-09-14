import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Layout, Radius } from './theme';
import { useTheme } from './use-theme';
import { readWebInteractionState } from './web-interaction';

export type CardProps = {
  children: ReactNode;
  /**
   * 주면 눌리는 카드가 된다 — 카드 전체가 하나의 단추다. 카드 안에 또 다른 단추를
   * 두면 어디를 누른 것인지 알 수 없으니, 안에 행동이 따로 있는 카드는 `onPress`를
   * 주지 않는다.
   */
  onPress?: () => void;
  /** `onPress`가 있으면 필요하다. 카드 안 글자를 스크린 리더가 다 읽기 전에 무엇인지 알려준다. */
  accessibilityLabel?: string;
  /** `plain`은 흰 면에 테두리, `filled`는 옅은 회색 면에 테두리 없음. */
  variant?: 'plain' | 'filled';
  /** 안쪽 여백을 없앤다 — 사진이 카드 끝까지 닿는 카드가 쓴다. */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * 면 하나. 배경 · 둥글기 · 테두리 · 안쪽 여백 · 눌림만 안다.
 *
 * **안에 무엇이 들어가는지는 모른다.** 업체를 보여주는 카드는 `VendorCard`,
 * Pick 화면의 카드는 `PickCard`가 따로 있고, 이건 그 아래 깔리는 면이다.
 *
 * 그림자를 쓰지 않는다 — `spec/tokens.json` `elevation.$rule`이 「구분은 inset 선과
 * 배경 톤으로 한다」로 정해 뒀다.
 */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  variant = 'plain',
  flush = false,
  style,
  testID,
}: CardProps) {
  const theme = useTheme();
  const isFilled = variant === 'filled';

  const surface: ViewStyle = {
    backgroundColor: isFilled ? theme.backgroundElement : theme.background,
    borderWidth: isFilled ? 0 : 1,
    borderColor: theme.border,
  };

  if (!onPress) {
    return (
      <View style={[styles.card, flush ? styles.flush : null, surface, style]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={(state) => {
        const { pressed, hovered, focused } = readWebInteractionState(state);
        return [
          styles.card,
          flush ? styles.flush : null,
          surface,
          focused ? { borderWidth: 1, borderColor: theme.tint } : null,
          { opacity: pressed ? 0.9 : hovered ? 0.96 : 1 },
          style,
        ];
      }}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    padding: Layout.cardPadding,
    overflow: 'hidden',
  },
  flush: {
    padding: 0,
  },
});
