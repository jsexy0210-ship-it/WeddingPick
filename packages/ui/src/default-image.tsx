import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from './use-theme';

/**
 * 사진이 없을 때 그 자리를 채우는 **기본 이미지.**
 *
 * **글씨를 쓰지 않는다.** 2026-09-15까지 이 자리는 회색 면에 「웨딩홀 기본」이라고
 * 적고 있었다 — 사용자에게는 그것이 «사진을 못 구했다»는 고백으로 읽힌다. 대표님
 * 지시: 「썸네일, 이미지 없는 건 싹다 디폴트 이미지 만들어서 넣어. 오류 띄우지 말고」.
 *
 * **파일을 싣지 않고 그린다.** 업종 13종에 PNG를 붙이면 번들이 늘고, 웹·iOS·안드로이드
 * 셋이 각자 다른 경로로 읽어야 한다. 이모지는 세 곳 모두 글꼴이 이미 들고 있다.
 *
 * **이모지를 쓰는 것은 피그마를 따른 것이다** — 피그마가 업종 자리에 🏛️📷👗💄📸✈️을
 * 그린다(`CLAUDE.md` 아이콘 규칙 · `features/home/board.tsx`). 나머지 일곱은 피그마에
 * 없는 업종이라 같은 결로 골랐고, 아래 표가 그 자리다.
 *
 * 크기는 상자를 재서 정한다 — 96 높이의 목록 행과 180 높이의 캐러셀에 같은 크기를
 * 쓰면 한쪽은 점이 되고 한쪽은 꽉 찬다.
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

/** 여섯(hall · studio · dress · makeup · snap · honeymoon)은 피그마에서 그대로 왔다. */
const EMOJI: Record<DefaultImageCategory, string> = {
  wedding_info_company: '🤝',
  hall: '🏛️',
  studio: '📷',
  dress: '👗',
  makeup: '💄',
  hair: '💇',
  snap: '📸',
  bouquet: '💐',
  invitation: '💌',
  goods: '💍',
  dowry: '🛋️',
  honeymoon: '✈️',
  etc: '🏷️',
};

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
  const theme = useTheme();
  /* 상자를 재기 전에는 이모지를 그리지 않는다 — 한 프레임 큰 글자가 스쳤다가 줄어든다. */
  const [side, setSide] = useState(0);
  /*
   * 짧은 변의 34%. 위아래 20~72로 묶는다 — 40 높이의 작은 썸네일에서 이모지가
   * 상자를 넘고, 320 높이의 히어로에서 점처럼 보이는 것을 둘 다 막는다.
   */
  const size = Math.max(20, Math.min(72, Math.round(side * 0.34)));

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${LABEL[category]} 기본 이미지`}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSide(Math.min(width, height));
      }}
      style={[styles.box, { backgroundColor: theme.backgroundSelected }, style]}>
      {side > 0 ? (
        <Text style={{ fontSize: size, lineHeight: Math.round(size * 1.3) }}>{EMOJI[category]}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
