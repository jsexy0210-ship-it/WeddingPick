import { StyleSheet, View } from 'react-native';

import { Layout, MaxContentWidth, Radius, Skeleton, Spacing, ThemedView } from '@weddingpick/ui';

/**
 * 홈이 자료를 기다리는 동안.
 *
 * **홈과 같은 골격이다.** 헤드라인 2줄 → 현황판 2×2 → 오늘의 Pick(제목 · 세 칸 ·
 * CTA). 다른 모양을 보여주면 자료가 왔을 때 화면이 통째로 갈아끼워지고, 그건
 * 기다린 보람이 아니라 놀라움이 된다.
 *
 * 어느 상태로 갈지 아직 모르므로 **모든 상태가 공유하는 위쪽만 그린다.** 비회원
 * 홈에도 헤드라인 두 줄과 2열 격자가 있어서, 어느 쪽으로 정해지든 위 절반은
 * 자리가 맞는다.
 */
export function HomeSkeleton() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        {/* 헤드라인 두 줄. 둘째 줄이 짧은 것까지 홈과 같다. */}
        <View style={styles.headline}>
          <Skeleton width="62%" height={43} />
          <Skeleton width="84%" height={43} />
        </View>

        {/* 현황판 2×2. 비회원 홈에서는 업종 입구 넷이 같은 자리에 온다. */}
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton
              key={index}
              width="auto"
              height={96}
              radius={Radius.medium}
              style={styles.cell}
            />
          ))}
        </View>

        <View style={styles.section}>
          <Skeleton width="38%" height={35} />

          <View style={styles.row}>
            {[0, 1, 2].map((index) => (
              <Skeleton
                key={index}
                width="auto"
                height={96}
                radius={Radius.small}
                style={styles.grow}
              />
            ))}
          </View>

          <Skeleton height={Layout.controlXLarge} radius={Radius.small} />
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  content: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Layout.gutter,
    /** 헤더 높이만큼 띄운다 — 홈은 이 자리에 워드마크가 있다. */
    paddingTop: Layout.navBar + 20,
    gap: Layout.sectionGap,
  },
  headline: { gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  cell: { flexBasis: '48%', flexGrow: 1, minWidth: 0 },
  section: { gap: Layout.sectionHeadGap },
  row: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1, minWidth: 0 },
});
