import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { VERIFICATION_LEVEL_INFO, type VerificationLevel } from '@/features/verification/levels';

/** 검증 등급 배지. 서비스정책서 2번에 따라 등급은 UI에서 항상 배지로 표시한다. */
export function VerificationBadge({ level }: { level: VerificationLevel }) {
  const info = VERIFICATION_LEVEL_INFO[level];

  return (
    <View style={[styles.badge, { backgroundColor: `${info.accent}1F` }]}>
      <ThemedText type="small" style={{ color: info.accent }}>
        {level} {info.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
});
