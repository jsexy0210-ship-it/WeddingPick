import type { VendorSummary } from '@weddingpick/api-contract';
import { VENDOR_CATEGORY_LABEL, WEDDING_STYLE_LABEL, formatCount, priceLine } from '@weddingpick/domain';
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
 * 홈과 추천 전체가 공유하는 업체 카드.
 * 홈은 추천 이유를 한 줄 노출하고, 추천 전체 기본 상태는 태그까지만 보여준 뒤
 * 카드를 눌러 별도의 추천 이유 확장 상태로 전환한다.
 */
export type VendorCardProps = {
  vendor: VendorSummary;
  picked: boolean;
  onPress: () => void;
  onPressPick: () => void;
  accessibilityLabel?: string;
  showTags?: boolean;
  showReason?: boolean;
  variant?: 'home' | 'recommendations';
};

const MAX_TAGS = 2;

export function VendorCard({
  vendor,
  picked,
  onPress,
  onPressPick,
  accessibilityLabel,
  showTags = true,
  showReason = true,
  variant = 'home',
}: VendorCardProps) {
  const theme = useTheme();
  const price = priceLine(vendor.paidPrice, null);
  const tags = vendor.styleTags.slice(0, MAX_TAGS);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${vendor.name} 상세`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        variant === 'recommendations' && styles.recommendationCard,
        {
          backgroundColor: variant === 'recommendations' ? theme.backgroundElement : theme.background,
          borderColor: theme.border,
        },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.image, variant === 'recommendations' && styles.recommendationImage]}>
        <CategoryImage uri={vendor.imageUrl} label={vendor.name} category={vendor.category} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={picked ? `${vendor.name} Pick 해제` : `${vendor.name} Pick`}
          accessibilityState={{ selected: picked }}
          onPress={(event) => { event.stopPropagation(); onPressPick(); }}
          hitSlop={Spacing.two}
          style={({ pressed }) => [
            styles.heart,
            variant === 'recommendations' && styles.recommendationHeart,
            pressed && styles.pressed,
          ]}>
          <View
            style={[
              styles.heartFill,
              picked
                ? { backgroundColor: theme.tint }
                : { backgroundColor: theme.background, opacity: 0.88 },
            ]}
          />
          <View>
            <SeedIcon
              name={picked ? 'heartFill' : 'heartRegular'}
              size={Layout.iconField}
              color={picked ? theme.onTint : theme.text}
            />
          </View>
        </Pressable>
      </View>

      <View style={[styles.info, variant === 'recommendations' && styles.recommendationInfo]}>
        <ThemedText
          type={variant === 'recommendations' ? 'f11' : 'f10'}
          themeColor="textAssistive"
          style={styles.category}
          numberOfLines={1}>
          {VENDOR_CATEGORY_LABEL[vendor.category]}
        </ThemedText>
        <ThemedText type={variant === 'recommendations' ? 'f16' : 'f14'} style={styles.name} numberOfLines={1}>
          {vendor.name}
        </ThemedText>

        <View style={styles.place}>
          <SeedIcon name="locationRegular" size={Layout.iconMicro} color={theme.textAssistive} />
          <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1} style={styles.shrink}>
            {vendor.region}
          </ThemedText>
        </View>

        {showTags && tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <ThemedText
                key={tag}
                type={variant === 'recommendations' ? 'f11' : 'f10'}
                themeColor={variant === 'recommendations' ? 'tint' : 'textAssistive'}
                numberOfLines={1}>
                #{WEDDING_STYLE_LABEL[tag]}
              </ThemedText>
            ))}
          </View>
        ) : null}

        <ThemedText
          type="f13"
          numeric
          numberOfLines={1}
          themeColor={price.dim ? 'textAssistive' : 'text'}
          style={styles.price}>
          {price.text}
        </ThemedText>

        <ThemedText type="f12" themeColor="textAssistive" numeric style={styles.proof}>
          실 제보 {formatCount(vendor.comparableQuoteCount)}건
        </ThemedText>

        {showReason && vendor.reasons?.[0] ? (
          <View style={styles.reasonRow}>
            <SeedIcon name="checkFlowerFill" size={Layout.iconField} color={theme.tint} />
            <ThemedText type="f12" themeColor="tint" numberOfLines={2} style={styles.reason}>
              {vendor.reasons[0]}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: Layout.cardRecommendWidth,
    borderRadius: Radius.medium,
    borderWidth: Border.hairline,
    overflow: 'hidden',
    ...Elevation.figmaCard,
  },
  recommendationCard: {
    width: 204,
    borderWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  image: { height: Layout.imageRecommendHeight, position: 'relative' },
  recommendationImage: { height: 150 },
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
  recommendationHeart: { width: Layout.chip, height: Layout.chip },
  heartFill: { ...StyleSheet.absoluteFill },
  info: { padding: Layout.inlineGap },
  recommendationInfo: { padding: Layout.fieldPaddingX },
  category: { fontWeight: 600, letterSpacing: LetterSpacing.p05 },
  name: { fontWeight: 700, marginTop: Spacing.half },
  place: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.one },
  shrink: { flexShrink: 1, minWidth: 0 },
  tags: { flexDirection: 'row', gap: Spacing.one, marginTop: Spacing.one },
  price: { fontWeight: 700, marginTop: Layout.cardGap },
  proof: { marginTop: Spacing.one },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  reason: { flex: 1, minWidth: 0, fontWeight: 600 },
  pressed: { opacity: 0.8 },
});
