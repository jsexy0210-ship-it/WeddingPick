import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

export type SpouseConnectBannerProps = {
  onInvite: () => void;
};

/**
 * WP-ST-002 — 배우자 미연결 배너.
 *
 * 홈·우리웨딩·Pick 상단에 붙는다. 연결을 강요하지 않고 혼자서도 완결되게 둔다.
 */
export function SpouseConnectBanner({ onInvite }: SpouseConnectBannerProps) {
  const theme = useTheme();

  return (
    <View style={[styles.banner, { backgroundColor: theme.tintSubtle }]}>
      <View style={styles.text}>
        <ThemedText type="t5" style={{ color: theme.tint }}>
          혼자 준비 중이에요
        </ThemedText>
        <ThemedText type="t7" themeColor="textSecondary">
          둘이 같이 보면 결정이 빨라져요
        </ThemedText>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={onInvite}
        accessibilityRole="button"
        accessibilityLabel="배우자 초대">
        <ThemedText type="t7" style={{ color: theme.onTint }}>
          배우자 초대
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Layout.gutter,
    marginBottom: Spacing.three,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    gap: Spacing.two,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  cta: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    flexShrink: 0,
  },
});
