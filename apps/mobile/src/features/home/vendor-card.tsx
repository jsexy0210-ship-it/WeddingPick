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
 * 추천 업체 카드 — **홈과 「웨딩픽 추천」 전체 페이지가 이 파일 하나를 쓴다**
 * (2026-09-15 대표 사양 §12 「업체 카드는 홈과 동일 컴포넌트 재사용」 · §23 「홈용 ·
 * 추천 페이지용 둘로 중복 구현하지 않는다」).
 *
 *   ┌──────────────────────────────┐
 *   │ [썸네일]                   ♡ │
 *   │ 웨딩홀                        │
 *   │ 메종 웨딩                     │
 *   │ 📍 서울 영등포구               │
 *   │ #도시적인 #로맨틱한            │
 *   │ 350~520만원        ★4.7 (18) │
 *   └──────────────────────────────┘
 *
 * **없는 값은 줄째 그리지 않는다.** 이 카드에서 빠질 수 있는 것이 둘이다.
 *
 *   특징 태그   `styleTags`가 비면 그 줄이 없다. 시안의 «#채광맛집» 같은 자유 태그는
 *               저장소에 없어 스타일 넷(도시적인 · 자연스러운 · 로맨틱한 · 화려한)을 쓴다.
 *   별점        `rating`이 null이면 오른쪽이 빈다 — 확인된 후기 5건 미만이거나
 *               체크리스트 업종(결정사)이다. «★0.0»도 «★-»도 그리지 않는다. 그건
 *               「나쁜 업체」로 읽힌다(계약 `vendors.ts` `rating` 주석).
 *
 * **금액은 세 꼴이 다 들어온다.** `priceLine` 하나가 만든다(CLAUDE.md v3.24) —
 * 구간(`152~184만원`) · 업체 안내(`업체 안내 150만원~`, 회색) · `수집 중`. 카드 높이를
 * 금액 한 꼴에 맞춰 잠그지 않는다.
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
  const price = priceLine(vendor.paidPrice, vendor.guidePrice);
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
          onPress={onPressPick}
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
          {/* 별점이 없으면 이 자리가 빈다. 「0.0」으로 채우지 않는다. */}
          {vendor.rating === null ? null : (
            <View style={styles.rating}>
              <SeedIcon name="reviewStarFill" size={Layout.iconMicro} color={theme.textAssistive} />
              <ThemedText type="f12" numeric themeColor="textAssistive" style={styles.price}>
                {vendor.rating.average.toFixed(1)}
              </ThemedText>
              <ThemedText type="f10" numeric themeColor="textAssistive">
                ({formatCount(vendor.rating.count)})
              </ThemedText>
            </View>
          )}
        </View>
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
  rating: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half, flexShrink: 0 },
  pressed: { opacity: 0.8 },
});
