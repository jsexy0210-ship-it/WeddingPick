import { useState } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { Radius } from './theme';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';

export type VendorCategory =
  | 'hall'
  | 'studio'
  | 'dress'
  | 'makeup'
  | 'video'
  | 'planner'
  | 'etc';

const CATEGORY_LABEL: Record<VendorCategory, string> = {
  hall: '웨딩홀 기본',
  studio: '스튜디오 기본',
  dress: '드레스 기본',
  makeup: '메이크업 기본',
  video: '영상 기본',
  planner: '플래너 기본',
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
