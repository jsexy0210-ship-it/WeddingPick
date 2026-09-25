import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * 사진이 없을 때 그 자리를 채우는 **기본 이미지.**
 *
 * **글씨를 쓰지 않는다.** 2026-09-15까지 이 자리는 회색 면에 「웨딩홀 기본」이라고
 * 적고 있었다 — 사용자에게는 그것이 «사진을 못 구했다»는 고백으로 읽힌다. 대표님
 * 지시: 「썸네일, 이미지 없는 건 싹다 디폴트 이미지 만들어서 넣어. 오류 띄우지 말고」.
 *
 * RN 디자인 레퍼런스의 미첨부 사진 자리와 같이 회색 면과 작은 사진 윤곽을 그린다.
 * 업종별 이모지는 실제 사진으로 오해되거나 화면마다 다르게 보이므로 쓰지 않는다.
 */

/** `packages/domain` `VENDOR_CATEGORIES` 13종과 값을 맞춘다. */
export type DefaultImageCategory =
  | 'wedding_info_company'
  | 'hall'
  | 'studio'
  | 'dress'
  | 'makeup'
  | 'hair'
  | 'snap'
  | 'bouquet'
  | 'invitation'
  | 'goods'
  | 'dowry'
  | 'honeymoon'
  | 'etc';

/** 낭독기가 읽을 말. 화면에는 그리지 않는다. */
const LABEL: Record<DefaultImageCategory, string> = {
  wedding_info_company: '결정사',
  hall: '웨딩홀',
  studio: '스튜디오',
  dress: '드레스',
  makeup: '메이크업',
  hair: '헤어변형',
  snap: '본식스냅',
  bouquet: '부케',
  invitation: '청첩장',
  goods: '예물',
  dowry: '혼수',
  honeymoon: '허니문',
  etc: '업체',
};

export type DefaultImageProps = {
  category?: DefaultImageCategory;
  style?: StyleProp<ViewStyle>;
};

export function DefaultImage({ category = 'etc', style }: DefaultImageProps) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${LABEL[category]} 기본 이미지`}
      style={[styles.box, style]}>
      <Svg width={36} height={30} viewBox="0 0 36 30" fill="none" accessibilityElementsHidden>
        <Rect x={1} y={1} width={34} height={28} rx={3} stroke="#B5BAC3" strokeWidth={2} />
        <Circle cx={10} cy={10} r={3} stroke="#B5BAC3" strokeWidth={2} />
        <Path d="m2 27 10-10 7 7 5-5 10 10" stroke="#B5BAC3" strokeWidth={2} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#EAEBEE' },
});
