import type { VendorSummary } from '@weddingpick/api-contract';
import { VENDOR_CATEGORY_LABEL, WEDDING_STYLE_LABEL, priceLine } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Border,
  Elevation,
  Layout,
  LetterSpacing,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';

import { CategoryImage } from './category-image';

/**
 * 홈·추천이 공유하는 카드. docs/design/figma-export/01-home, 08-recommendations 기준.
 * 별점 대신 실제 제보 건수/기준을 표시하고 서버가 제공한 추천 이유만 쓴다.
 * 제보 부족 시 업체 안내 금액으로 대체하지 않는다.
 */
export type VendorCardProps = {
  vendor: VendorSummary;
  /** 이 업체가 후보에 담겨 있는가 — 하트 채움. */
  picked: boolean;
  onPress: () => void;
  onPressPick: () => void;
};

/** 카드에 적는 특징 태그 수(사양 §6 「특징 태그 최대 2개」). */
const MAX_TAGS = 2;

export function VendorCard({ vendor, picked, onPress, onPressPick }: VendorCardProps) {
  const theme = useTheme();
  const price = priceLine(vendor.paidPrice, null);
  const tags = vendor.styleTags.slice(0, MAX_TAGS);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${vendor.name} 상세`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.background, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.image}>
        <CategoryImage uri={vendor.imageUrl} label={vendor.name} category={vendor.category} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={picked ? `${vendor.name} Pick 해제` : `${vendor.name} Pick`}
          accessibilityState={{ selected: picked }}
          onPress={(event) => { event.stopPropagation(); onPressPick(); }}
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.heart, pressed && styles.pressed]}>
          <View
            style={[
              styles.heartFill,
              picked
                ? { backgroundColor: theme.text }
                : { backgroundColor: theme.background, opacity: 0.8 },
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

        {/* 태그가 없으면 줄째 없다 — 빈 줄로 자리를 잡아두지 않는다. */}
        {tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <ThemedText key={tag} type="f10" themeColor="textAssistive" numberOfLines={1}>
                #{WEDDING_STYLE_LABEL[tag]}
              </ThemedText>
            ))}
          </View>
        ) : null}

        <View style={styles.bottom}>
          <ThemedText
            type="f12"
            numeric
            numberOfLines={1}
            themeColor={price.dim ? 'textAssistive' : 'text'}
            style={[styles.price, styles.shrink]}>
            {price.text}
          </ThemedText>

        </View>
        <ThemedText type="f12" themeColor="textAssistive" numeric style={styles.proof}>
          {price.caption}
        </ThemedText>
        {vendor.reasons?.[0] ? (
          <ThemedText type="f12" themeColor="tint" numberOfLines={2} style={styles.reason}>
            {vendor.reasons[0]}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: Layout.cardRecommendWidth,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    overflow: 'hidden',
    ...Elevation.figmaCard,
  },
  image: { height: Layout.imageRecommendHeight, position: 'relative' },
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
  info: { padding: Layout.inlineGap },
  category: { fontWeight: 600, letterSpacing: LetterSpacing.p05 },
  name: { fontWeight: 600, marginTop: Spacing.half },
  place: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.one },
  shrink: { flexShrink: 1, minWidth: 0 },
  tags: { flexDirection: 'row', gap: Spacing.one, marginTop: Spacing.one },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
    marginTop: Layout.cardGap,
  },
  price: { fontWeight: 500 },
  proof: { marginTop: Spacing.one },
  reason: { marginTop: Spacing.two },
  pressed: { opacity: 0.8 },
});
