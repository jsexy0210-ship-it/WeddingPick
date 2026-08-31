import type { VendorSummary } from '@weddingpick/api-contract';
import { rangeLabel, TERMS } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionButton, Radius, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

import { CategoryImage } from './category-image';

/**
 * 오늘의 Pick — 홈 C-1의 추천 영역.
 *
 * **가격 TOP3를 따로 두지 않는다.** 시안 확정 단계에서 없앤 자리다 — 추천과 가격
 * 순위가 나란히 서면 둘이 서로 경쟁하고, 사용자는 어느 쪽을 봐야 할지 모른다.
 * 가격은 추천 안에 한 줄로 들어간다.
 *
 * 흐름은 상황 → 추천 → 근거 → Pick이다. 근거는 세 곳 각각의 금액 줄이고, 행동은
 * 하나뿐이다.
 */

export type TodaysPickProps = {
  /** 지목받은 업종 이름. 없으면 부제를 적지 않는다. */
  categoryLabel: string | null;
  vendors: readonly VendorSummary[];
  /** 견줄 수 있는가. 아니면 비교 대신 제보를 권한다. */
  comparable: boolean;
  onPressVendor: (vendorId: string) => void;
  onCompare: () => void;
  onReport: () => void;
};

export function TodaysPick({
  categoryLabel,
  vendors,
  comparable,
  onPressVendor,
  onCompare,
  onReport,
}: TodaysPickProps) {
  return (
    <ThemedView style={styles.section}>
      <ThemedText type="t2">{TERMS.todaysPick}</ThemedText>
      {categoryLabel === null ? null : (
        <ThemedText type="t6" themeColor="textSecondary" numberOfLines={1}>
          {categoryLabel}를 정할 차례예요
        </ThemedText>
      )}

      <ThemedView style={styles.row}>
        {vendors.map((vendor) => (
          <Card key={vendor.id} vendor={vendor} onPress={() => onPressVendor(vendor.id)} />
        ))}
      </ThemedView>

      {comparable ? (
        <ActionButton
          label={`${vendors.length}곳 비교`}
          variant="primary"
          size="xlarge"
          onPress={onCompare}
        />
      ) : (
        /*
         * **비교할 수 없으면 비교를 권하지 않는다.** 눌러도 소득이 없는 버튼을
         * 두는 대신, 그 자리를 채울 방법인 제보를 권한다.
         */
        <ThemedView type="backgroundElement" style={styles.notice}>
          <ThemedText type="t5">비교할 정보가 부족해요</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            정보가 더 모이면 비교할 수 있어요
          </ThemedText>
          <ActionButton
            label="결제내역 제보"
            variant="ghost"
            size="large"
            onPress={onReport}
          />
        </ThemedView>
      )}
    </ThemedView>
  );
}

function Card({ vendor, onPress }: { vendor: VendorSummary; onPress: () => void }) {
  const price = vendor.paidPrice;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.thumb}>
        <CategoryImage />
      </View>
      <ThemedText type="t6" numberOfLines={1} style={styles.name}>
        {vendor.name}
      </ThemedText>
      {/*
        **금액 자리를 비우지 않는다.** 확인된 정보가 모자라면 «수집 중»과 건수를
        함께 적는다 — 빈 칸이나 «—»는 그 업체에 아무 일도 없었다는 뜻으로 읽힌다.
      */}
      <ThemedText
        type="t7"
        numeric
        numberOfLines={1}
        themeColor={price.stage === 'collecting' ? 'textDisabled' : 'textAssistive'}>
        {price.stage === 'collecting'
          ? `수집 중 · ${price.count}건`
          : rangeLabel(price.low, price.high)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, minWidth: 0, gap: Spacing.two },
  pressed: { opacity: 0.8 },
  thumb: { width: '100%', height: 96, borderRadius: Radius.small, overflow: 'hidden' },
  name: { fontWeight: 700 },
  notice: {
    borderRadius: Radius.card,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: Spacing.two,
  },
});
