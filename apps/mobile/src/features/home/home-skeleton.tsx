import { StyleSheet, View } from 'react-native';

import { Layout, MaxContentWidth, Radius, Skeleton, Spacing, ThemedView } from '@weddingpick/ui';

/**
 * 홈이 자료를 기다리는 동안. 디자인 핸드오프 4번.
 *
 * **홈과 같은 골격이다.** 헤드라인 2줄 → 금액 → 분포 바 → 범례 4열 → 지표 카드
 * 2개 → 퀵메뉴 4개 → 배너. 다른 모양을 보여주면 자료가 왔을 때 화면이 통째로
 * 갈아끼워지고, 그건 기다린 보람이 아니라 놀라움이 된다.
 */
export function HomeSkeleton() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        {/* 헤드라인 두 줄. 둘째 줄이 짧은 것까지 홈과 같다. */}
        <View style={styles.headline}>
          <Skeleton width="62%" height={30} />
          <Skeleton width="84%" height={30} />
        </View>

        <Skeleton height={92} radius={Radius.medium} />

        <View style={styles.section}>
          <Skeleton width="45%" height={16} />
          <Skeleton width="58%" height={38} />
          <Skeleton height={8} radius={Radius.pill} />

          <View style={styles.legendRow}>
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} height={14} style={styles.legendItem} />
            ))}
          </View>

          <View style={styles.cardRow}>
            <Skeleton height={72} radius={Radius.medium} style={styles.grow} />
            <Skeleton height={72} radius={Radius.medium} style={styles.grow} />
          </View>
        </View>

        <View style={styles.quickRow}>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton
              key={index}
              width="auto"
              height={48}
              radius={Radius.medium}
              style={styles.quick}
            />
          ))}
        </View>

        <Skeleton height={104} radius={Radius.card} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    gap: Spacing.four,
  },
  headline: {
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  legendRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  legendItem: {
    flex: 1,
  },
  cardRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  grow: {
    flex: 1,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  quick: {
    flexGrow: 1,
    minWidth: 140,
  },
});
