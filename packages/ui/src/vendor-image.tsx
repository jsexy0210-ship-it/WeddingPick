import { useState } from 'react';
import { Image, StyleSheet, type ImageSourcePropType } from 'react-native';

import { DefaultImage } from './default-image';
import { Radius } from './theme';

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

  /*
   * 사진이 없거나 못 받아왔다. **기본 이미지로 채운다.**
   *
   * 2026-09-15까지 이 자리는 회색 면에 「웨딩홀 기본」이라고 적고 있었다 —
   * 검색 목록 다섯 칸에 그 글씨가 나란히 떴다. 사용자에게는 그것이 사진이
   * 아니라 **우리가 사진을 못 구했다는 고백**으로 읽힌다(대표님 지시
   * 「이미지 없는 건 싹다 디폴트 이미지 넣어. 오류 띄우지 말고」).
   */
  return <DefaultImage category={category} style={{ width, height, borderRadius: radius }} />;
}

const styles = StyleSheet.create({
  image: { overflow: 'hidden' },
});
