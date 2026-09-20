import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Elevation, Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

export type PickSection = 'pick' | 'recommendations' | 'compare';
const ITEMS: readonly { value: PickSection; label: string }[] = [
  { value: 'pick', label: '나의 Pick' },
  { value: 'recommendations', label: '웨딩픽 추천' },
  { value: 'compare', label: '비교함' },
];

export function PickSectionTabs({ active, compareIds }: { active: PickSection; compareIds: readonly string[] }) {
  const theme = useTheme();
  const ids = [...new Set(compareIds)].slice(0, 3);
  const compareReady = ids.length >= 2;

  function move(next: PickSection) {
    if (next === active) return;
    if (next === 'pick') return void router.replace('/pick');
    if (next === 'recommendations') return void router.replace('/recommendations' as never);
    if (compareReady) {
      router.replace({ pathname: '/search/compare', params: { ids: ids.join(',') } } as never);
    }
  }

  return (
    <View accessibilityRole="tablist" accessibilityLabel="Pick 메뉴"
      style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      {ITEMS.map((item) => {
        const selected = item.value === active;
        const disabled = item.value === 'compare' && !compareReady;
        return (
          <Pressable key={item.value} accessibilityRole="tab"
            accessibilityState={{ selected, disabled }} disabled={disabled}
            onPress={() => move(item.value)}
            style={[styles.item, selected ? [Elevation.figmaCard, { backgroundColor: theme.background }] : null,
              disabled ? styles.disabled : null]}>
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
  disabled: { opacity: 0.4 },
});
