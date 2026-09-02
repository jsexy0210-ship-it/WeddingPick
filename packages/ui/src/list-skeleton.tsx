import { StyleSheet, View } from 'react-native';

import { Radius } from './theme';
import { Skeleton } from './skeleton';

export type ListSkeletonProps = {
  /** 그릴 행 수. 목록은 3줄까지만 뼈대를 그린다. */
  rows?: 1 | 2 | 3;
};

/** WP-ST-007 — 목록 로딩 스켈레톤. 썸네일 + 두 줄 텍스트 패턴. */
export function ListSkeleton({ rows = 3 }: ListSkeletonProps) {
  const widths = [
    ['72%', '48%'],
    ['58%', '40%'],
    ['66%', '44%'],
  ] as const;

  return (
    <View style={styles.container}>
      {Array.from({ length: rows }, (_, i) => {
        const [w1, w2] = widths[i % 3]!;
        return (
          <View key={i} style={styles.row}>
            <Skeleton width={44} height={44} radius={Radius.small} />
            <View style={styles.lines}>
              <Skeleton width={w1} height={14} />
              <Skeleton width={w2} height={12} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lines: { flex: 1, gap: 7 },
});
