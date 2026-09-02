import { Image } from 'expo-image';
import { StyleSheet, View, type ImageStyle } from 'react-native';

import { useTheme } from '@weddingpick/ui';

/**
 * 사진 자리.
 *
 * **빈 상자나 «사진 준비 중»을 노출하지 않는다**(홈 C-1이 명시한 규칙). 사진이
 * 없으면 같은 비율의 조용한 면으로 채운다 — 글씨를 얹으면 그 자리가 «없음»을
 * 알리는 자리가 되고, 사용자는 우리가 무엇을 못 구했는지 읽게 된다.
 *
 * 채우는 순서는 업체 제공 → 사용 허가 → 공식 → 카테고리 기본이다. 지금 우리에게
 * 있는 것은 마지막 하나뿐이고, 그마저 파일이 없어 면으로 대신한다.
 *
 * TODO: 카테고리별 기본 이미지가 확보되면 `fallback`을 그 파일로 바꾼다. 화면은
 * 이 컴포넌트만 알고 있어서 부르는 쪽은 그대로다.
 */
/**
 * 자리를 잡는 데 필요한 것만 받는다.
 *
 * `StyleProp<ViewStyle>`을 그대로 열어두면 사진일 때(`ImageStyle`)와 면일 때
 * (`ViewStyle`)의 타입이 갈라져 한쪽에 캐스팅이 붙는다. 두 타입이 겹치는 칸만
 * 받으면 캐스팅이 필요 없고, 무엇보다 **이 컴포넌트에 색이나 테두리를 넘길 수
 * 없다** — 사진 자리가 화면마다 다른 장식을 갖기 시작하면 규격이 무너진다.
 */
type BoxStyle = Pick<
  ImageStyle,
  'position' | 'top' | 'left' | 'right' | 'bottom' | 'width' | 'height' | 'aspectRatio'
>;

export type CategoryImageProps = {
  /** 업체가 준 사진. 계약에 아직 이 필드가 없어 지금은 늘 비어 있다. */
  uri?: string | null;
  style?: BoxStyle;
  /** 화면 낭독기가 읽을 말. 사진이 정보를 나르지 않으면 비워 둔다. */
  label?: string;
};

export function CategoryImage({ uri, style, label }: CategoryImageProps) {
  const theme = useTheme();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.fill, style]}
        contentFit="cover"
        accessibilityLabel={label}
        /*
         * 가운데를 기준으로 자른다. 얼굴이 잘리면 다음 순위 사진으로 넘어가야
         * 하지만, 그 판단은 사진을 고르는 쪽 일이라 여기서는 하지 않는다.
         */
        transition={0}
      />
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.fill, { backgroundColor: theme.backgroundSelected }, style]}
    />
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
});
