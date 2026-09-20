import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Layout, ThemedText } from '@weddingpick/ui';
import { BackButton } from '@/components/back-button';

export function DepthHeader({
  title,
  right,
  onBack,
  variant = 'back',
}: {
  title?: string;
  right?: ReactNode;
  onBack?: () => void;
  variant?: 'back' | 'close';
}) {
  return (
    <View style={styles.bar}>
      <BackButton onPress={onBack} variant={variant} />
      <ThemedText type="t5" numberOfLines={1} style={styles.title}>
        {title ?? ''}
      </ThemedText>
      {right ?? null}
    </View>
  );
}
const styles = StyleSheet.create({
  bar: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Layout.navPaddingLeft,
    paddingRight: Layout.navPaddingRight,
    gap: Layout.navGap,
  },
  title: { flex: 1, minWidth: 0 },
});
