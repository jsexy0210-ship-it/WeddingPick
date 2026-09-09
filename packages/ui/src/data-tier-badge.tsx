import { StyleSheet, View } from 'react-native';

import { Layout, Radius } from './theme';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';

/** WP-ST-005 — 실 제보 4단계. */
export type DataTier = 'collecting' | 'low' | 'mid' | 'full';

export function getDataTier(count: number): DataTier {
  if (count <= 2) return 'collecting';
  if (count <= 4) return 'low';
  if (count <= 9) return 'mid';
  return 'full';
}

const TIER_RANGE: Record<DataTier, string> = {
  collecting: '0~2건',
  low: '3~4건',
  mid: '5~9건',
  full: '10건 이상',
};

export type DataTierBadgeProps = {
  count: number;
};

/**
 * 실 제보 건수에 따라 색상이 달라지는 배지 — 17-sheets-states WP-ST-005 tier.
 *
 *   micro 13/18/700 · padding 3 8 · radius 4 · 한 줄
 *   0~2건  #FFE3BA / #805217      3~9건  #F2F3F6 / #4D5159      10건+  #E8FAF6 / #1AA174
 *
 * 빈 칸이나 «—»는 쓰지 않는다.
 */
export function DataTierBadge({ count }: DataTierBadgeProps) {
  const tier = getDataTier(count);
  const theme = useTheme();

  const bgColor =
    tier === 'full'
      ? theme.positiveBackground
      : tier === 'collecting'
        ? theme.cautionaryBackground
        : theme.backgroundSelected;

  const textColor =
    tier === 'full'
      ? theme.positive
      : tier === 'collecting'
        ? theme.cautionary
        : theme.textSecondary;

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <ThemedText type="micro" numeric numberOfLines={1} style={{ color: textColor }}>
        {TIER_RANGE[tier]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Layout.tierBadgePaddingX,
    paddingVertical: Layout.tierBadgePaddingY,
    borderRadius: Radius.badge,
  },
});
