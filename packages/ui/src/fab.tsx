import { Pressable, StyleSheet } from 'react-native';

import { Layout, Radius } from './theme';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';

export type FabProps = {
  /** 읽는 기계에 하는 말. 화면에는 글자가 안 나오므로 이게 유일한 이름이다. */
  label: string;
  /** 화면에 보이는 기호. 아이콘 폰트가 없어 글자로 그린다. */
  glyph?: string;
  onPress: () => void;
};

/** 핸드오프 15번: 56px, 탭바 위 120px. */
const SIZE = 56;
const BOTTOM = 120;

/**
 * 떠 있는 추가 단추. 디자인 핸드오프 15·16번.
 *
 * **글자가 없으므로 `label`이 유일한 이름이다.** 아이콘만 있는 단추는 스크린
 * 리더에게 "버튼"으로만 읽힌다 — 무엇을 더하는 단추인지 말해줘야 한다.
 *
 * 그림자는 핸드오프가 정한 값이다(`0 6px 16px rgba(49,130,246,.34)`). 떠 있는
 * 요소에만 그림자를 준다는 규칙에 맞는 자리다.
 */
export function Fab({ label, glyph = '+', onPress }: FabProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: theme.tint,
          opacity: pressed ? 0.86 : 1,
          shadowColor: theme.tint,
        },
      ]}>
      <ThemedText type="t2" style={styles.glyph}>
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
    bottom: BOTTOM,
    width: SIZE,
    height: SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.34,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  glyph: {
    color: '#ffffff',
    /*
     * 기호가 가운데 오도록 줄 높이를 크게 잡는다. 글꼴마다 아래로 처져 보이는
     * 것을 눈으로 맞춘 값이라, 글자 크기 토큰이 아니라 이 단추의 크기를 따른다.
     */
    lineHeight: FAB_GLYPH_LINE_HEIGHT,
  },
});
