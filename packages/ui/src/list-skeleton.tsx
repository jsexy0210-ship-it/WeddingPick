import { StyleSheet, View } from 'react-native';

import { Border, Layout, Radius, Spacing } from './theme';
import { Skeleton } from './skeleton';

export type ListSkeletonProps = {
  /** 그릴 행 수. 목록은 3줄까지만 뼈대를 그린다 — 4줄 이상은 실제 내용보다 뼈대가 기억된다. */
  rows?: 1 | 2 | 3;
  /** @deprecated 상세 화면은 자체 shell skeleton을 쓴다. */
  hero?: boolean;
  /** 실제 목록 카드 구조. search는 104×116 썸네일 가로 카드다. */
  variant?: 'default' | 'search';
};

/** 30-loading 30d — 썸네일 52(thumbList) · 바 16/13 · 히어로 168 · 제목 20 · 메타 15. */
const THUMB = Layout.thumbList;
const HERO = 168;

/**
 * WP-ST-007 — 목록 뼈대. 썸네일 52 + 바 두 줄(16 · 13) 패턴, 1400ms 숨쉬기.
 * 목록에는 스피너를 쓰지 않는다.
 *
 * 정본 WP-LOAD-004(`공통_다이얼로그 빈상태 로더.dc.html` `skRows`)와 재대조
 * (2026-09-23) — 3줄 · 72%/46% · 58%/38% · 66%/42% · 썸네일 52 전부 일치(PASS).
 */
export function ListSkeleton({ rows = 3, hero = false, variant = 'default' }: ListSkeletonProps) {
  const widths = [
    ['72%', '46%'],
    ['58%', '38%'],
    ['66%', '42%'],
  ] as const;

  if (variant === 'search') {
    return (
      <View style={styles.container} accessibilityLabel="검색 결과를 불러오는 중">
        {Array.from({ length: rows }, (_, i) => {
          const [w1, w2] = widths[i % 3]!;
          return (
            <View key={i} style={styles.searchCard}>
              <View style={styles.searchImageCol}>
                <Skeleton
                  width={Layout.thumbSearchWidth}
                  height={Layout.thumbSearchHeight}
                  radius={Radius.thumb}
                />
              </View>
              <View style={styles.searchInfo}>
                <Skeleton width="28%" height={10} />
                <Skeleton width={w1} height={16} />
                <Skeleton width={w2} height={13} style={styles.secondaryBar} />
                <View style={styles.searchFooter}>
                  <Skeleton width="42%" height={15} />
                  <Skeleton width="25%" height={13} style={styles.secondaryBar} />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {hero ? (
        <>
          <Skeleton height={HERO} radius={Radius.medium} />
          <Skeleton width="62%" height={20} />
          <Skeleton width="38%" height={15} style={styles.secondaryBar} />
          <View style={styles.divider} />
        </>
      ) : null}
      {Array.from({ length: rows }, (_, i) => {
        const [w1, w2] = widths[i % 3]!;

        return (
          <View key={i} style={styles.row}>
            <Skeleton width={THUMB} height={THUMB} radius={Radius.small} />
            <View style={styles.lines}>
              <Skeleton width={w1} height={16} />
              <Skeleton width={w2} height={13} style={styles.secondaryBar} />
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
  divider: { height: 1, marginVertical: Spacing.one, backgroundColor: '#f2f3f6' },
  secondaryBar: { backgroundColor: '#f2f3f6' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Layout.inlineGap, paddingVertical: ROW_PADDING_Y },
  lines: { flex: 1, gap: Spacing.two },
  searchCard: {
    flexDirection: 'row',
    borderWidth: Border.hairline,
    borderColor: '#eaebee',
    borderRadius: Radius.cardLarge,
    overflow: 'hidden',
  },
  searchImageCol: { padding: Spacing.two, flexShrink: 0 },
  searchInfo: {
    flex: 1,
    minWidth: 0,
    padding: Layout.fieldPaddingX,
    gap: Spacing.two,
  },
  searchFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
