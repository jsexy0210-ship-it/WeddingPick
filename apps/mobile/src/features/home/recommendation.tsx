import type { VendorSummary } from '@weddingpick/api-contract';
import { NOT_ENOUGH_DATA, priceLine, TERMS } from '@weddingpick/domain';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ActionButton,
  Layout,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

import { CategoryImage } from './category-image';
import type { ConditionChip, HomeCta } from './state';

/**
 * 웨딩픽 추천 — 홈의 추천 블록. SPEC §13.8 · `03-home-states.dc.html`.
 *
 *   라벨 14 코랄     웨딩픽 추천 · 메이크업
 *   조건 칩 30       강남 · 3,000만원 이상 · 도시적인 · 로맨틱한 · (5월 12일)
 *   이미지 180 r10
 *   업체명 20 ↔ 금액 16
 *   이유 16 · 건수 14
 *   2열 서브 16:11
 *   CTA 52
 *
 * 홈 코랄 네 곳 중 둘(라벨 · CTA)이 여기다. 칩은 무채색이다.
 *
 * **정보량은 골격을 바꾸지 않는다.** 실 제보가 모자라면 금액 글자가 회색이 되고
 * CTA가 «Pick 인증하기» 아웃라인으로 바뀐다. 그뿐이다. 금액은 어디서나
 * `priceLine`이 정한다 — 0층 «업체 안내 150만원~», 1층 «수집 중», 그 위는 구간.
 */

export type RecommendationProps = {
  /** «웨딩픽 추천 · {업종}». 업종을 모르면 라벨만. */
  categoryLabel: string | null;
  chips: readonly ConditionChip[];
  vendors: readonly VendorSummary[];
  cta: HomeCta;
  onPressChip: (chip: ConditionChip) => void;
  onPressVendor: (vendorId: string) => void;
  onPressCta: () => void;
};

export function Recommendation({
  categoryLabel,
  chips,
  vendors,
  cta,
  onPressChip,
  onPressVendor,
  onPressCta,
}: RecommendationProps) {
  const [main, ...subs] = vendors;

  return (
    <ThemedView style={styles.section}>
      <ThemedText type="t7" themeColor="tint" style={styles.label} numberOfLines={1}>
        {categoryLabel === null ? TERMS.todaysPick : `${TERMS.todaysPick} · ${categoryLabel}`}
      </ThemedText>

      {chips.length === 0 ? null : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {chips.map((chip) => (
            <Chip key={`${chip.kind}-${chip.label}`} chip={chip} onPress={() => onPressChip(chip)} />
          ))}
        </ScrollView>
      )}

      {main === undefined ? (
        /* 추천할 곳이 아직 없다. 자리를 비우지 않고 까닭을 한 줄로 적는다. */
        <ThemedView type="backgroundElement" style={styles.empty}>
          <ThemedText type="t6" themeColor="textSecondary">
            {NOT_ENOUGH_DATA}
          </ThemedText>
        </ThemedView>
      ) : (
        <MainCard vendor={main} onPress={() => onPressVendor(main.id)} />
      )}

      {subs.length === 0 ? null : (
        <View style={styles.twoCol}>
          {subs.slice(0, 2).map((vendor) => (
            <SubCard key={vendor.id} vendor={vendor} onPress={() => onPressVendor(vendor.id)} />
          ))}
        </View>
      )}

      <ActionButton
        label={cta.label}
        variant={cta.kind === 'compare' ? 'primary' : 'ghost'}
        size="xlarge"
        onPress={onPressCta}
      />
    </ThemedView>
  );
}

/** 조건 칩. 30 · radius 999 · 회색. 누르면 그 조건을 뺀 결과로 간다. */
function Chip({ chip, onPress }: { chip: ConditionChip; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${chip.label} 조건 빼고 보기`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <ThemedText
        type="t7"
        numberOfLines={1}
        themeColor={chip.dim ? 'textDisabled' : 'textSecondary'}
        style={styles.chipLabel}>
        {chip.label}
      </ThemedText>
    </Pressable>
  );
}

function MainCard({ vendor, onPress }: { vendor: VendorSummary; onPress: () => void }) {
  const price = priceLine(vendor.paidPrice, vendor.guidePrice);
  const reason = vendor.reasons?.[0] ?? null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
      <View style={styles.mainImage}>
        <CategoryImage uri={vendor.imageUrl} label={vendor.name} />
      </View>
      <View style={styles.nameRow}>
        <ThemedText type="t4" numberOfLines={1} style={styles.grow}>
          {vendor.name}
        </ThemedText>
        <ThemedText
          type="t6"
          numeric
          numberOfLines={1}
          themeColor={price.dim ? 'textAssistive' : 'text'}
          style={styles.price}>
          {price.text}
        </ThemedText>
      </View>
      {reason === null ? null : (
        <ThemedText type="t6" themeColor="textSecondary" numberOfLines={1}>
          {reason}
        </ThemedText>
      )}
      <ThemedText type="t7" numeric themeColor="textAssistive" numberOfLines={1}>
        {price.caption}
      </ThemedText>
    </Pressable>
  );
}

function SubCard({ vendor, onPress }: { vendor: VendorSummary; onPress: () => void }) {
  const price = priceLine(vendor.paidPrice, vendor.guidePrice);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.sub, pressed && styles.pressed]}>
      <View style={styles.subImage}>
        <CategoryImage uri={vendor.imageUrl} label={vendor.name} />
      </View>
      <ThemedText type="t6" numberOfLines={1} style={styles.subName}>
        {vendor.name}
      </ThemedText>
      <ThemedText
        type="t7"
        numeric
        numberOfLines={1}
        themeColor={price.dim ? 'textDisabled' : 'textAssistive'}>
        {price.text}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* 시안 padSec: gap 11. */
  section: { gap: Layout.gap2col },
  label: { fontWeight: 700 },
  /* 시안 condRow: gap 6 · 가로 스크롤. 칩마다 flex:0 0 auto — 안 붙이면 마지막 칩이 잘린다. */
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: {
    flexShrink: 0,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: { fontWeight: 700 },
  main: { gap: Spacing.two - 2 },
  mainImage: { width: '100%', height: 180, borderRadius: Radius.medium, overflow: 'hidden' },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.three - 4 },
  grow: { flex: 1, minWidth: 0 },
  /** 금액은 줄지 않는다. 좁아지면 옆의 이름부터 줄인다. */
  price: { flexShrink: 0, fontWeight: 700 },
  /* 시안 twoCol: gap 9 · 위 2. */
  twoCol: { flexDirection: 'row', gap: 9, paddingTop: Spacing.half },
  sub: { flex: 1, minWidth: 0, gap: 6 },
  subImage: { width: '100%', aspectRatio: 16 / 11, borderRadius: Radius.small, overflow: 'hidden' },
  subName: { fontWeight: 700 },
  empty: {
    borderRadius: Radius.medium,
    paddingHorizontal: Layout.cardPadding,
    paddingVertical: 18,
  },
  pressed: { opacity: 0.8 },
});
