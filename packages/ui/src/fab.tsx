import { Pressable, StyleSheet } from 'react-native';

import { Elevation, Layout, Radius } from './theme';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';

export type FabProps = {
  /** 읽는 기계에 하는 말. 화면에는 글자가 안 나오므로 이게 유일한 이름이다. */
  label: string;
  /** 화면에 보이는 기호. 아이콘 폰트가 없어 글자로 그린다. */
  glyph?: string;
  onPress: () => void;
  /**
   * 기기 하단 안전 영역(`useSafeAreaInsets().bottom`). 디바이스 대응 규칙 —
   * 「inset은 하드코딩하지 않는다. 하단 고정 요소에만 더한다」. 탭바 높이가
   * 기기마다(SE 72 · 노치 106 · 3버튼 안드로이드 120) 갈리므로 이 값을 더하지
   * 않으면 탭바와의 간격이 기기마다 달라진다. 넘기지 않으면 기존과 같다.
   */
  bottomInset?: number;
};

/** 핸드오프 15번: 56px, 탭바 위 120px(노치 기준 safeBottom 34 포함). */
const SIZE = 56;
const BOTTOM = 120;
/** 시안 기준값(위 `BOTTOM`)이 이미 담고 있는 safeBottom — 다른 기기 값과의 차만 더한다. */
const BASELINE_SAFE_BOTTOM = 34;

/**
 * 떠 있는 추가 단추. 디자인 핸드오프 15·16번.
 *
 * **글자가 없으므로 `label`이 유일한 이름이다.** 아이콘만 있는 단추는 스크린
 * 리더에게 "버튼"으로만 읽힌다 — 무엇을 더하는 단추인지 말해줘야 한다.
 *
 * 그림자는 핸드오프 `elevation.floatingCard`(0 2px 6px rgba(0,0,0,.16))다 — 그림자를 거의
 * 쓰지 않는 SEED 규칙에서 떠 있는 요소만 예외다.
 */
export function Fab({ label, glyph = '+', onPress, bottomInset = BASELINE_SAFE_BOTTOM }: FabProps) {
  const theme = useTheme();
  const bottom = BOTTOM + (bottomInset - BASELINE_SAFE_BOTTOM);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          bottom,
          backgroundColor: theme.tint,
          opacity: pressed ? 0.86 : 1,
        },
      ]}>
      <ThemedText type="t2" style={[styles.glyph, { color: theme.onTint }]}>
        {glyph}
      </ThemedText>
    </Pressable>
  );
}

/** 기호 한 글자를 가운데 앉히려고 잡은 줄 높이. 글자 크기 토큰과 다른 값이다. */
const FAB_GLYPH_LINE_HEIGHT = 34;

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Layout.gutter,
    width: SIZE,
    height: SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.floatingCard,
  },
  glyph: {
    /*
     * 기호가 가운데 오도록 줄 높이를 크게 잡는다. 글꼴마다 아래로 처져 보이는
     * 것을 눈으로 맞춘 값이라, 글자 크기 토큰이 아니라 이 단추의 크기를 따른다.
     */
    lineHeight: FAB_GLYPH_LINE_HEIGHT,
  },
});
