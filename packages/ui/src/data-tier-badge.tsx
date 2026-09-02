import { StyleSheet, View } from 'react-native';

import { Radius } from './theme';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';

/** WP-ST-005 — 확인된 정보 4단계. */
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
 * 확인된 정보 건수에 따라 색상이 달라지는 뱃지.
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
      <ThemedText type="badge" style={{ color: textColor }}>
        {TIER_RANGE[tier]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.small,
  },
});
