import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Layout, MaxContentWidth, Radius, Skeleton, Spacing, ThemedView, useTheme } from '@weddingpick/ui';

import { RootTabHeader } from '@/components/root-tab-header';

/** 온보딩 저장부터 홈 첫 자료가 준비될 때까지 같은 홈 골격을 보여준다. */
export function HomeSkeleton() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <RootTabHeader title="웨딩픽" right={<Skeleton width={24} height={24} radius={Radius.pill} />} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { backgroundColor: theme.tint }]}>
            <Skeleton width="38%" height={16} />
            <Skeleton width="60%" height={38} />
            <Skeleton width="74%" height={15} />
          </View>

          <View style={styles.section}>
            <Skeleton width="42%" height={20} />
            <View style={styles.grid}>
              {[0, 1, 2, 3].map((key) => (
                <View key={key} style={[styles.prepCard, { borderColor: theme.border }]}>
                  <Skeleton width="48%" height={15} />
                  <Skeleton width="70%" height={18} />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Skeleton width="30%" height={20} />
            <Skeleton height={74} radius={Radius.medium} />
          </View>
          <View style={styles.section}>
            <Skeleton width="34%" height={20} />
            <Skeleton height={88} radius={Radius.medium} />
          </View>
          <View style={styles.section}>
            <Skeleton width="38%" height={20} />
            <Skeleton height={110} radius={Radius.medium} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: { paddingBottom: Spacing.three },
  hero: {
    marginHorizontal: Layout.gutter,
    minHeight: 172,
    borderRadius: 14,
    padding: 18,
    justifyContent: 'center',
    gap: Spacing.two,
  },
  section: { paddingHorizontal: Layout.gutter, marginTop: Layout.sectionGap, gap: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  prepCard: {
    width: '48%',
    minHeight: 92,
    borderRadius: Radius.medium,
    borderWidth: 1,
    padding: Spacing.three,
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
