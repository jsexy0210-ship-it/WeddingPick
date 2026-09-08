import { useState } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { Radius } from './theme';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';

/**
 * 폴백 이미지 업종. `packages/domain` VENDOR_CATEGORIES(핸드오프 v3.18 §1.3)와 값을
 * 맞춘다 — 이 패키지는 domain을 import하지 않는 표시 전용이라 여기 따로 적는다.
 * 앱은 업종 값을 그대로 넘기면 된다.
 */
export type VendorCategory =
  | 'wedding_info_company'
  | 'hall'
  | 'studio'
  | 'dress'
  | 'makeup'
  | 'snap'
  | 'goods'
  | 'dowry'
  | 'honeymoon'
  | 'invitation'
  | 'etc';

const CATEGORY_LABEL: Record<VendorCategory, string> = {
  wedding_info_company: '결정사 기본',
  hall: '웨딩홀 기본',
  studio: '스튜디오 기본',
  dress: '드레스 기본',
  makeup: '메이크업 기본',
  snap: '본식스냅 기본',
  goods: '예물 기본',
  dowry: '혼수 기본',
  honeymoon: '허니문 기본',
  invitation: '청첩장 기본',
  etc: '업체 기본',
};

export type VendorImageProps = {
  source?: ImageSourcePropType | null;
  category?: VendorCategory;
  width?: number;
  height?: number;
  radius?: number;
};

/**
 * WP-ST-004 — 업체 이미지 없음 폴백.
 *
 * 업체 제공 → 사용 허가 → 공식 → 카테고리 기본 순으로 채운다.
 * «사진 준비 중» 문구나 빈 상자는 노출하지 않는다.
 */
export function VendorImage({
  source,
  category = 'etc',
  width,
  height = 96,
  radius = Radius.small,
}: VendorImageProps) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  if (source && !failed) {
    return (
      <Image
        source={source}
        style={[styles.image, { width, height, borderRadius: radius }]}
        onError={() => setFailed(true)}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width, height, borderRadius: radius, backgroundColor: theme.backgroundSelected },
      ]}>
      <ThemedText type="t7" themeColor="textDisabled" style={styles.label}>
        {CATEGORY_LABEL[category]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center' },
});
