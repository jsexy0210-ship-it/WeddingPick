import { StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing } from './theme';
import { Skeleton } from './skeleton';
import { useTheme } from './use-theme';

export type ListSkeletonProps = {
  /** 그릴 행 수. 목록은 3줄까지만 뼈대를 그린다 — 4줄 이상은 실제 내용보다 뼈대가 기억된다. */
  rows?: 1 | 2 | 3;
  /** 히어로가 있는 화면(업체 상세)은 168 블록 + 제목 20 + 메타 15를 먼저 그린다. */
  hero?: boolean;
};

/** 30-loading 30d — 썸네일 52(thumbList) · 바 16/13 · 히어로 168 · 제목 20 · 메타 15. */
const THUMB = Layout.thumbList;
const HERO = 168;

/**
 * WP-ST-007 — 목록 뼈대. 썸네일 52 + 바 두 줄(16 · 13) 패턴, 1400ms 숨쉬기.
 * 목록에는 스피너를 쓰지 않는다.
 */
export function ListSkeleton({ rows = 3, hero = false }: ListSkeletonProps) {
  const theme = useTheme();
  const widths = [
    ['72%', '46%'],
    ['58%', '38%'],
    ['66%', '42%'],
  ] as const;

  return (
    <View style={styles.container}>
      {hero ? (
        <>
          <Skeleton height={HERO} radius={Radius.medium} />
          <Skeleton width="62%" height={20} />
          <Skeleton width="38%" height={15} style={{ backgroundColor: theme.backgroundSelected }} />
          <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
        </>
      ) : null}
      {Array.from({ length: rows }, (_, i) => {
        const [w1, w2] = widths[i % 3]!;

        return (
          <View key={i} style={styles.row}>
            <Skeleton width={THUMB} height={THUMB} radius={Radius.control} />
            <View style={styles.lines}>
              <Skeleton width={w1} height={16} />
              <Skeleton width={w2} height={13} style={{ backgroundColor: theme.backgroundSelected }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* 30-loading skWrap gap 12 · skRow gap 12 · padding 6 0 · 바 사이 8 · hrThin margin 4. */
const ROW_PADDING_Y = 6;

const styles = StyleSheet.create({
  container: { gap: Layout.inlineGap },
  divider: { height: 1, marginVertical: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Layout.inlineGap, paddingVertical: ROW_PADDING_Y },
  lines: { flex: 1, gap: Spacing.two },
});
