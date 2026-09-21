import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Elevation, Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

export type PickSection = 'pick' | 'recommendations' | 'favorites';
const ITEMS: readonly { value: PickSection; label: string }[] = [
  { value: 'pick', label: '나의 Pick' },
  { value: 'recommendations', label: '웨딩픽 추천' },
  { value: 'favorites', label: '관심업체' },
];

export function PickSectionTabs({ active }: { active: PickSection }) {
  const theme = useTheme();

  function move(next: PickSection) {
    if (next === active) return;
    router.replace({
      pathname: '/pick',
      params: next === 'pick' ? {} : { section: next },
    } as never);
  }

  return (
    <View accessibilityRole="tablist" accessibilityLabel="Pick 메뉴"
      style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      {ITEMS.map((item) => {
        const selected = item.value === active;
        return (
          <Pressable key={item.value} accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => move(item.value)}
            style={[styles.item, selected ? [Elevation.figmaCard, { backgroundColor: theme.background }] : null]}>
            <ThemedText type="f12" numberOfLines={1}
              themeColor={selected ? 'text' : 'textAssistive'} style={styles.label}>
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  track: {
    marginHorizontal: Layout.pageX,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
    padding: Spacing.one,
    flexDirection: 'row',
    borderRadius: Radius.cardLarge,
  },
  item: {
    flex: 1,
    minHeight: Layout.controlMedium,
    borderRadius: Radius.hero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: 700 },
});
