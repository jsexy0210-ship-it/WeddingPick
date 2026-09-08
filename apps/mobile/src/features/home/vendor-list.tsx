import type { VendorSummary } from '@weddingpick/api-contract';
import { NOT_ENOUGH_DATA, rangeLabel, TERMS } from '@weddingpick/domain';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

import { CategoryImage } from './category-image';

/**
 * 많이 확인된 곳 — 확인된 정보가 많이 모인 순서로 놓는 목록.
 *
 * **«인기 순»이 아니다.** 인기를 재는 것이 우리에게 없다. 확인된 정보가 많이 모인
 * 것은 잴 수 있는 사실이고, 이 목록이 말하는 것은 그것뿐이다.
 *
 * 비회원 홈의 본문이기도 하다 — 이름도 예식일도 모르는 사람에게 조건 없이 보여줄
 * 수 있는 것이 이것이다.
 */

export type VendorListProps = {
  vendors: readonly VendorSummary[];
  onPressVendor: (vendorId: string) => void;
};

export function VendorList({ vendors, onPressVendor }: VendorListProps) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.list}>
      {vendors.map((vendor, index) => (
        <Fragment key={vendor.id}>
          <Row vendor={vendor} onPress={() => onPressVendor(vendor.id)} />
          {/* 마지막 줄 아래에는 선을 긋지 않는다. 목록이 끝났는데 선이 남으면 다음이 있는 것처럼 보인다. */}
          {index === vendors.length - 1 ? null : (
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
          )}
        </Fragment>
      ))}
    </ThemedView>
  );
}

function Row({ vendor, onPress }: { vendor: VendorSummary; onPress: () => void }) {
  const price = vendor.paidPrice;
  const collecting = price.stage === 'collecting';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.thumb}>
        <CategoryImage uri={vendor.imageUrl} label={vendor.name} />
      </View>

      <ThemedView style={styles.body}>
        <ThemedText type="t5" numberOfLines={1}>
          {vendor.name}
        </ThemedText>
        <ThemedView style={styles.priceRow}>
          <ThemedText
            type="t6"
            numeric
            numberOfLines={1}
            style={styles.price}
            themeColor={collecting ? 'textDisabled' : 'text'}>
            {collecting ? '수집 중' : rangeLabel(price.low, price.high)}
          </ThemedText>
          <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1} style={styles.count}>
            {collecting
              ? `${NOT_ENOUGH_DATA} · ${price.count}건`
              : `${TERMS.verifiedData} ${price.count}건`}
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    minHeight: Layout.rowMinHeight,
    paddingVertical: 12,
  },
  pressed: { opacity: 0.8 },
  thumb: { width: 52, height: 52, borderRadius: Radius.small, overflow: 'hidden' },
  body: { flex: 1, minWidth: 0, gap: 3 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, minWidth: 0 },
  /** 금액은 줄지 않는다. 좁아지면 옆의 건수부터 줄인다. */
  price: { flexShrink: 0, fontWeight: 700 },
  count: { flexShrink: 1, minWidth: 0 },
  divider: { height: 1 },
});
