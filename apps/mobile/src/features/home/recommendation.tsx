import type { VendorSummary } from '@weddingpick/api-contract';
import { NOT_ENOUGH_DATA, priceLine, TERMS, VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  Border,
  Elevation,
  Layout,
  LetterSpacing,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

import { CategoryImage } from './category-image';
import type { HomeCta } from './state';

/**
 * 웨딩픽 추천 — 규격서 docs/design/figma-export/01-home.dc.html(2026-09-15 대표 지시 「규격서의 수를 그대로」).
 *
 *   div 430×316  mar 0 0 24 0
 *     div 430×38  flex · justify space-between · align center · pad 0 20 0 20 · mar 0 0 12 0
 *       div 183×38
 *         h3 "웨딩픽 추천" · 14/600 #1A1C20 · lh 20
 *         p "저장한 업체를 한 번에 비교해봐요" · 12/400 #868B94 · lh 16 · mar 2 0 0 0
 *       button "비교하기" · 12/700 #FFFFFF · lh 16 · pad 8 14 8 14 · bg primary · r9999 · shadow
 *     div 430×266  flex · gap 12 · pad 0 0 4 20
 *       div 208×262  bg #FFFFFF · r16 · border 1 #000000 6% · shadow
 *         div 206×144
 *           img 206×144
 *           button 32×32  flex · justify center · align center · bg #FFFFFF 80% · r9999   (top-2.5 right-2.5)
 *             svg 16×16   IconHeartRegular / IconHeartFill
 *           span "인기" · 10/700 #FFFFFF · lh 15 · pad 2 8 2 8 · bg #1A1C20 · r9999   (top-2.5 left-2.5)
 *         div 206×116  pad 12 12 12 12
 *           span "스튜디오" · 10/600 #868B94 · lh 15 · ls 0.5px
 *           p "블루밍 스튜디오" · 14/600 #1A1C20 · lh 20 · mar 2 0 0 0
 *           div flex · gap 4 · align center · mar 4 0 0 0
 *             svg 12×12  IconLocationRegular       span "강남구" · 12/400 #868B94 · lh 16
 *           div flex · justify space-between · align center · mar 10 0 0 0
 *             span "80–150만원" · 12/500 #1A1C20 · lh 16
 *             div flex · gap 4 · align center     svg 12×12 IconReviewStarFill   span "4.9" · 12/500 #868B94
 *       div 16×262   ← 마지막 카드 뒤 여백
 *
 * **규격서와 다르게 둔 것.** 「인기 · 신규」 배지와 별점 「4.9」는 우리 계약(`VendorSummary`)에 그 값이
 * 없어 그리지 않는다 — 없는 값을 지어내지 않는다. 자료가 오면 그 자리(위 표)에 그대로 넣는다.
 * 금액 한 줄은 어느 화면이든 `priceLine`이 정한다(CLAUDE.md v3.24) — 피그마의 «80–150만원» 꼴이
 * 아니라 우리 구간 · 안내가 · 수집 중 표기가 들어간다. 하트는 후보에 담는 Pick이다(SPEC §13.1).
 *
 * 옛 홈의 조건 칩 · 대표 카드 + 2열 · «Pick 인증하기» CTA는 규격서에 없어 뺐다.
 */

export type RecommendationProps = {
  vendors: readonly VendorSummary[];
  cta: HomeCta;
  /** 이 업체가 후보에 담겨 있는가 — 하트 채움. */
  isPicked: (vendorId: string) => boolean;
  onPressVendor: (vendorId: string) => void;
  onPressPick: (vendor: VendorSummary) => void;
  onPressCompare: () => void;
};

export function Recommendation({
  vendors,
  cta,
  isPicked,
  onPressVendor,
  onPressPick,
  onPressCompare,
}: RecommendationProps) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <ThemedText type="f14" style={styles.semibold}>
            {TERMS.todaysPick}
          </ThemedText>
          <ThemedText type="f12" themeColor="textAssistive" style={styles.sub}>
            저장한 업체를 한 번에 비교해봐요
          </ThemedText>
        </View>
        {/* 비교할 것이 둘 이상일 때만 누를 수 있다(`cta.kind === 'compare'`). 자리는 늘 있다. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="추천 업체 비교하기"
          disabled={cta.kind !== 'compare'}
          onPress={onPressCompare}
          style={({ pressed }) => [
            styles.comparePill,
            { backgroundColor: theme.tint, shadowColor: theme.tint },
            cta.kind !== 'compare' && styles.disabled,
            pressed && styles.pressed,
          ]}>
          <ThemedText type="f12" themeColor="onTint" style={styles.bold}>
            비교하기
          </ThemedText>
        </Pressable>
      </View>

      {vendors.length === 0 ? (
        /* 추천할 곳이 아직 없다. 자리를 비우지 않고 까닭을 한 줄로 적는다(규격서에 없는 상태). */
        <View style={styles.emptyWrap}>
          <ThemedView
            type="backgroundElement"
            style={[styles.empty, { borderColor: theme.border }]}>
            <ThemedText type="f12" themeColor="textAssistive">
              {NOT_ENOUGH_DATA}
            </ThemedText>
          </ThemedView>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.row}>
          {vendors.map((vendor) => (
            <Card
              key={vendor.id}
              vendor={vendor}
              picked={isPicked(vendor.id)}
              onPress={() => onPressVendor(vendor.id)}
              onPressPick={() => onPressPick(vendor)}
            />
          ))}
          {/* «div 16×262» — 마지막 카드 뒤 여백. */}
          <View style={styles.tail} />
        </ScrollView>
      )}
    </View>
  );
}

function Card({
  vendor,
  picked,
  onPress,
  onPressPick,
}: {
  vendor: VendorSummary;
  picked: boolean;
  onPress: () => void;
  onPressPick: () => void;
}) {
  const theme = useTheme();
  const price = priceLine(vendor.paidPrice, vendor.guidePrice);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.background, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.image}>
        <CategoryImage uri={vendor.imageUrl} label={vendor.name} category={vendor.category} />
        {/* «button 32×32 · bg #FFFFFF 80% · r9999» — 담기면 잉크 면에 흰 하트(피그마 `bg-foreground`). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={picked ? `${vendor.name} Pick 해제` : `${vendor.name} Pick`}
          accessibilityState={{ selected: picked }}
          onPress={onPressPick}
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.heart, pressed && styles.pressed]}>
          <View
            style={[
              styles.heartFill,
              picked ? { backgroundColor: theme.text } : { backgroundColor: theme.background, opacity: 0.8 },
            ]}
          />
          {/* 웹에서 absolute 면이 뒤 형제 위에 그려진다 — 아이콘을 View로 감싸 위에 둔다. */}
          <View>
            <SeedIcon
              name={picked ? 'heartFill' : 'heartRegular'}
              size={Layout.iconField}
              color={picked ? theme.onTint : theme.text}
            />
          </View>
        </Pressable>
      </View>

      <View style={styles.info}>
        <ThemedText type="f10" themeColor="textAssistive" style={styles.category} numberOfLines={1}>
          {VENDOR_CATEGORY_LABEL[vendor.category]}
        </ThemedText>
        <ThemedText type="f14" style={styles.name} numberOfLines={1}>
          {vendor.name}
        </ThemedText>
        <View style={styles.place}>
          <SeedIcon name="locationRegular" size={Layout.iconMicro} color={theme.textAssistive} />
          <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1} style={styles.shrink}>
            {vendor.region}
          </ThemedText>
        </View>
        <View style={styles.priceRow}>
          <ThemedText
            type="f12"
            numeric
            numberOfLines={1}
            themeColor={price.dim ? 'textAssistive' : 'text'}
            style={styles.price}>
            {price.text}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* «mar 0 0 24 0». */
  section: { marginBottom: Spacing.four },
  /* «pad 0 20 · mar 0 0 12 0 · space-between · center». */
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.pageX,
    marginBottom: Layout.sectionHeadGapCompact,
    gap: Spacing.two,
  },
  headText: { flex: 1, minWidth: 0 },
  semibold: { fontWeight: 600 },
  bold: { fontWeight: 700 },
  /* 부제 «mar 2 0 0 0». */
  sub: { marginTop: Spacing.half },
  /* «pad 8 14 8 14 · r9999 · shadow»(피그마 `shadow-sm shadow-primary/20`). */
  comparePill: {
    flexShrink: 0,
    paddingVertical: Spacing.two,
    paddingHorizontal: Layout.fieldPaddingX,
    borderRadius: Radius.pill,
    ...Elevation.figmaCard,
  },
  disabled: { opacity: 0.4 },
  /* 세로 ScrollView 안의 가로 ScrollView — 남은 높이를 먹지 않게 잠근다. */
  scroll: { flexGrow: 0, flexShrink: 0 },
  /* «flex · gap 12 · pad 0 0 4 20». */
  row: { flexDirection: 'row', gap: Layout.inlineGap, paddingLeft: Layout.pageX, paddingBottom: Spacing.one },
  tail: { width: Spacing.three },
  /* «div 208×262 · r16 · border 1 · shadow». */
  card: {
    width: Layout.cardRecommendWidth,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    overflow: 'hidden',
    ...Elevation.figmaCard,
  },
  /* «img 206×144». */
  image: { height: Layout.imageRecommendHeight, position: 'relative' },
  /* 피그마 `absolute top-2.5 right-2.5` = 10. */
  heart: {
    position: 'absolute',
    top: Layout.cardGap,
    right: Layout.cardGap,
    width: Layout.pickBubble,
    height: Layout.pickBubble,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heartFill: { ...StyleSheet.absoluteFill },
  /* «pad 12 12 12 12». */
  info: { padding: Layout.inlineGap },
  /* «10/600 · ls 0.5px». */
  category: { fontWeight: 600, letterSpacing: LetterSpacing.p05 },
  /* «14/600 · mar 2 0 0 0». */
  name: { fontWeight: 600, marginTop: Spacing.half },
  /* «flex · gap 4 · align center · mar 4 0 0 0». */
  place: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.one },
  shrink: { flexShrink: 1 },
  /* «space-between · mar 10 0 0 0». 별점 자리는 비어 있다(위 JSDoc). */
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Layout.cardGap,
  },
  /* «12/500». */
  price: { fontWeight: 500 },
  emptyWrap: { paddingHorizontal: Layout.pageX },
  empty: {
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    padding: Layout.inlineGap,
  },
  pressed: { opacity: 0.8 },
});
