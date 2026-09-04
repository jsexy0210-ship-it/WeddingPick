import { StyleSheet, View } from 'react-native';

import { Radius } from './theme';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';

/** WP-ST-003 — Pick 상태 뱃지. */
export type PickStatus = 'none' | 'picked' | 'decided';

export type PickStatusBadgeProps = {
  status: PickStatus;
};

const LABEL: Record<PickStatus, string> = {
  none: 'Pick 전',
  picked: 'Pick',
  decided: '결정 완료',
};

export function PickStatusBadge({ status }: PickStatusBadgeProps) {
  const theme = useTheme();

  const bgColor =
    status === 'picked'
      ? theme.tintSubtle
      : status === 'decided'
        ? theme.positiveBackground
        : theme.backgroundSelected;

  const textColor =
    status === 'picked'
      ? theme.tint
      : status === 'decided'
        ? theme.positive
        : theme.textSecondary;

  return (
    <View style={[styles.base, { backgroundColor: bgColor }]}>
      <ThemedText type="badge" style={{ color: textColor }}>
        {LABEL[status]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.small,
  },
});
