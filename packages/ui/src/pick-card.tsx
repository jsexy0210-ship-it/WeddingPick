import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { Badge } from './badge';
import { Card } from './card';
import { FilterChip } from './filter-chip';
import { Layout, Radius, Spacing } from './theme';
import { ProductSymbol } from './product-symbol';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';
import { VendorImage, type VendorCategory } from './vendor-image';
import type { VendorCardPrice } from './vendor-card';

export type PickCardProps = {
  name: string;
  /** 업종. 이름 위에 작게 앉는다 — Pick 목록은 업종이 섞여 있어 이게 먼저 읽혀야 한다. */
  categoryLabel: string;
  /** 이름 아래 한 줄. 지역처럼 화면이 만들어 넘긴다. */
  meta?: string;
  /** 금액. `VendorCard`와 같이 `priceLine()`의 결과만 받는다. */
  price?: VendorCardPrice;
  imageSource?: ImageSourcePropType | null;
  category?: VendorCategory;
  /**
   * 썸네일 한 변. `spec/tokens.json`의 `size.thumbCard`(72)가 기본값인데 그 값이
   * 아직 `Layout`에 올라오지 않았다 — 토큰이 생기면 그쪽으로 옮긴다.
   */
  thumbSize?: number;
  /** 사진 왼쪽 위 한 마디. */
  badge?: string;
  /** 읽기만 하는 꼬리표. */
  tags?: string[];
  /** 결정한 곳. 사진 위에 체크가 덮이고 카드 테두리가 켜진다. */
  decided?: boolean;
  onPress: () => void;
  /** Pick 목록에서 빼기. 없으면 빼는 단추가 사라진다. */
  onRemove?: () => void;
  /** 카드 아래 행동 띠. 비교하기 · 결정하기가 들어온다. */
  footer?: ReactNode;
  testID?: string;
};

/**
 * Pick 목록의 카드 — 담아 둔 업체 한 곳.
 *
 * **`VendorCard`와 다른 물건이다.** 저쪽은 사진이 위에 크게 깔리고 아직 고르지
 * 않은 업체를 훑는 카드고, 이건 썸네일이 옆에 붙고 **업종 · 결정 여부 · 빼기**가
 * 먼저 읽히는 카드다. 담아 둔 것을 비교하고 결정하는 자리라 같은 정보라도 순서가
 * 다르다 — 모양이 비슷하다고 한 벌로 합치면 두 화면 중 하나는 맞지 않는다.
 */
export function PickCard({
  name,
  categoryLabel,
  meta,
  price,
  imageSource,
  category,
  thumbSize = DEFAULT_THUMB,
  badge,
  tags,
  decided = false,
  onPress,
  onRemove,
  footer,
  testID,
}: PickCardProps) {
  const theme = useTheme();

  return (
    <Card
      flush
      testID={testID}
      style={decided ? { borderColor: theme.tint } : undefined}>
      <Card
        flush
        onPress={onPress}
        accessibilityLabel={
          decided ? `${categoryLabel} ${name} 결정 완료, 자세히 보기` : `${name} 자세히 보기`
        }
        style={styles.tapArea}>
        <View style={styles.row}>
          <View>
            <VendorImage
              source={imageSource}
              category={category}
              width={thumbSize}
              height={thumbSize}
              radius={Radius.medium}
            />
            {badge ? (
              <View style={styles.badge}>
                <Badge label={badge} tone="ink" />
              </View>
            ) : null}
            {decided ? (
              <View style={[styles.decided, { backgroundColor: theme.scrim }]}>
                <ProductSymbol name="check" size={Layout.iconInline} color={theme.onTint} />
              </View>
            ) : null}
          </View>

          <View style={styles.info}>
            <View style={styles.headRow}>
              <View style={styles.head}>
                <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
                  {categoryLabel}
                </ThemedText>
                <ThemedText type="t5" numberOfLines={1}>
                  {name}
                </ThemedText>
              </View>
              {onRemove ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${name} Pick에서 빼기`}
                  onPress={onRemove}
                  hitSlop={HIT_SLOP}
                  style={styles.remove}>
                  <ProductSymbol
                    name="close"
                    size={Layout.iconChipClose}
                    color={theme.textAssistive}
                  />
                </Pressable>
              ) : null}
            </View>

            {meta ? (
              <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
                {meta}
              </ThemedText>
            ) : null}

            {price ? (
              <ThemedText
                type="t6"
                numeric
                numberOfLines={1}
                themeColor={price.dim ? 'textAssistive' : undefined}>
                {price.text}
              </ThemedText>
            ) : null}

            {tags && tags.length > 0 ? (
              <View style={styles.tags}>
                {tags.map((tag) => (
                  <FilterChip key={tag} label={tag} interactive={false} />
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Card>

      {footer ? (
        <View style={[styles.footer, { borderTopColor: theme.line }]}>{footer}</View>
      ) : null}
    </Card>
  );
}

/** spec/tokens.json size.thumbCard. Layout으로 올라오면 여기서 지운다. */
const DEFAULT_THUMB = 72;

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

const styles = StyleSheet.create({
  /** 안쪽 Card는 면을 다시 그리지 않는다 — 바깥 Card가 이미 면이다. */
  tapArea: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Layout.cardPadding,
  },
  info: {
    flex: 1,
    gap: Spacing.one,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  head: {
    flex: 1,
  },
  remove: {
    flexShrink: 0,
  },
  badge: {
    position: 'absolute',
    top: Spacing.one,
    left: Spacing.one,
  },
  decided: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: Layout.cardPadding,
    paddingVertical: Spacing.three,
  },
});
