import type { ReactNode } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { Badge } from './badge';
import { Card } from './card';
import { Layout, Radius, Spacing } from './theme';
import { ThemedText } from './themed-text';
import { VendorImage, type VendorCategory } from './vendor-image';

export type VendorCardPrice = {
  /** 금액 한 줄. **화면이 `priceLine(paidPrice, guidePrice)`로 만들어 넘긴다.** */
  text: string;
  /** 업체 안내가나 «수집 중»이면 참. 옅은 글씨로 앉는다. */
  dim: boolean;
};

export type VendorCardProps = {
  name: string;
  /**
   * 금액.
   *
   * 규칙은 `packages/domain`의 `priceLine(paidPrice, guidePrice)`에 있고 여기는
   * 그 결과만 받는다 — 이 패키지는 표시만 하는 곳이라 금액 규칙을 두 벌 갖지 않는다.
   * 검색 · 홈 추천 · 비교가 전부 같은 함수를 거쳐 같은 문장을 얻는다.
   */
  price: VendorCardPrice;
  /** 금액 아래 한 줄. 「실 제보 12건 · 강남구」처럼 화면이 만들어 넘긴다. */
  meta?: string;
  imageSource?: ImageSourcePropType | null;
  category?: VendorCategory;
  /**
   * 대표 사진 높이. 기본값은 검색 결과 카드가 쓰던 값이다 — 이미지 높이는 아직
   * 토큰에 없어서 여기 기본값으로 둔다. 토큰이 생기면 그쪽으로 옮긴다.
   */
  imageHeight?: number;
  /** 사진 왼쪽 위에 얹는 한 마디. 「인기」 「신규」. */
  badge?: string;
  /** 읽기만 하는 꼬리표. 스타일 · 지역. */
  tags?: string[];
  /** 인증 배지처럼 이름 줄 아래 붙는 것. `VerificationBadge` · `DataTierBadge`가 들어온다. */
  marks?: ReactNode;
  onPress: () => void;
  /** Pick 단추 자리. 카드 안에 두는 보조 행동이다. */
  pickAction?: ReactNode;
  testID?: string;
};

/**
 * 업체 한 곳을 보여주는 카드. 검색 결과 · 홈 추천 · 비교가 같은 것을 쓴다.
 *
 * 조립만 한다 — 사진은 `VendorImage`, 꼬리표는 `FilterChip`의 표시용 갈래,
 * 사진 위 표시는 `Badge`, 면은 `Card`다. 새로 그리는 것은 이름과 금액이 마주 보는
 * 줄뿐이다.
 *
 * 카드 전체를 누르면 상세로 간다. 그래서 `Card`에 `onPress`를 주지 않고 이 안에서
 * 직접 다룬다 — Pick 단추가 카드 안에 또 있어서, 카드 전체가 하나의 단추가 되면
 * 어느 쪽을 눌렀는지 알 수 없다.
 */
export function VendorCard({
  name,
  price,
  meta,
  imageSource,
  category,
  imageHeight = DEFAULT_IMAGE_HEIGHT,
  badge,
  tags,
  marks,
  onPress,
  pickAction,
  testID,
}: VendorCardProps) {
  return (
    <Card flush variant="plain" testID={testID}>
      <Card
        flush
        onPress={onPress}
        accessibilityLabel={`${name} 자세히 보기`}
        style={styles.tapArea}>
        <View>
          <VendorImage
            source={imageSource}
            category={category}
            height={imageHeight}
            radius={Radius.medium}
          />
          {badge ? (
            <View style={styles.badge}>
              <Badge kind="onImage">{badge}</Badge>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <ThemedText type="t4" numberOfLines={1} style={styles.name}>
              {name}
            </ThemedText>
            <ThemedText
              type="t6"
              numeric
              numberOfLines={1}
              themeColor={price.dim ? 'textAssistive' : undefined}
              style={styles.price}>
              {price.text}
            </ThemedText>
          </View>

          {meta ? (
            <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
              {meta}
            </ThemedText>
          ) : null}

          {marks ? <View style={styles.marks}>{marks}</View> : null}

          {tags && tags.length > 0 ? (
            <View style={styles.tags}>
              {tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </View>
          ) : null}
        </View>
      </Card>

      {pickAction ? <View style={styles.action}>{pickAction}</View> : null}
    </Card>
  );
}

/** 검색 결과 카드가 쓰던 대표 사진 높이. */
const DEFAULT_IMAGE_HEIGHT = 168;

const styles = StyleSheet.create({
  /** 안쪽 Card는 면을 다시 그리지 않는다 — 바깥 Card가 이미 면이다. */
  tapArea: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  badge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
  },
  body: {
    paddingHorizontal: Layout.cardPadding,
    paddingTop: Spacing.three,
    gap: Spacing.one,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  /** 이름이 길어지면 이름이 줄고 금액은 그대로 남는다 — 금액이 잘리면 안 된다. */
  name: {
    flexShrink: 1,
  },
  price: {
    flexShrink: 0,
  },
  marks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  action: {
    paddingHorizontal: Layout.cardPadding,
    paddingTop: Spacing.three,
    paddingBottom: Layout.cardPadding,
  },
});
