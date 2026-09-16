import { Pressable, StyleSheet } from 'react-native';

import { Elevation, Layout, Radius } from './theme';
import { SeedIcon } from './seed-icon';
import { useTheme } from './use-theme';

export type FabProps = {
  /** 읽는 기계에 하는 말. 화면에는 글자가 안 나오므로 이게 유일한 이름이다. */
  label: string;
  onPress: () => void;
};

/** 핸드오프 15번: 56px, 탭바 위 120px. 피그마도 «button 56×56 · r9999 · shadow»다. */
const SIZE = 56;
const BOTTOM = 120;

/**
 * 떠 있는 추가 단추. 디자인 핸드오프 15·16번.
 *
 * **글자가 없으므로 `label`이 유일한 이름이다.** 아이콘만 있는 단추는 스크린
 * 리더에게 "버튼"으로만 읽힌다 — 무엇을 더하는 단추인지 말해줘야 한다.
 *
 * 그림자는 핸드오프 `elevation.floatingCard`(0 2px 6px rgba(0,0,0,.16))다 — 그림자를 거의
 * 쓰지 않는 SEED 규칙에서 떠 있는 요소만 예외다.
 *
 * ## 아이콘은 더하기다 — 2026-09-15 피그마에서 확인
 *
 * 크기 56 · 곡률 · 그림자는 처음부터 피그마와 같았고 **속만 달랐다.** 규격서
 * (`docs/figma-spec/our-wedding.txt`)는 «svg 24×24»라고만 적어 **무엇을 그린 svg인지
 * 말하지 않았다.** 그래서 한동안 「피그마 그림 미확인」으로 두고 글자 글리프를 썼다.
 *
 * 피그마 저장소를 직접 열어 답을 찾았다 — `src/app/components/OurWedding.tsx:569`가
 * **`IconAddRegular size={24}`**를 부른다. 탭이 일정이든 예산이든 녹음이든 **아이콘은
 * 언제나 더하기**이고 바뀌는 것은 `aria-label`뿐이다.
 *
 * **그래서 `glyph`를 없앴다.** 그 전에는 일정 화면이 `glyph="✎"`(연필)을 넘기고 있었는데
 * 피그마에 연필은 없다. 단추마다 다른 기호를 넣을 수 있게 열어 두면 **화면마다 다른
 * 그림이 생기고** 그것이 정확히 그렇게 됐다.
 */
export function Fab({ label, onPress }: FabProps) {
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
        },
      ]}>
      <SeedIcon name="addRegular" size={Layout.iconTab} color={theme.onTint} />
    </Pressable>
  );
}

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
    ...Elevation.floatingCard,
  },
});
