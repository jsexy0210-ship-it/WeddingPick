import { Pressable, StyleSheet, View } from 'react-native';

import { Border, Layout, LineHeight, ProductSymbol, Radius, ThemedText, useTheme } from '@weddingpick/ui';

/**
 * 온보딩 보기 한 줄 — 규격서 docs/design/figma-export/06-onboarding-login.dc.html(2026-09-15 대표 지시 「규격서의 수를 그대로」).
 *
 *   button 382×65  flex · justify space-between · align center · pad 20 20 20 20 · mar 0 0 12 0 · r16
 *     고른 것   bg #E38E8E 7% · border 1 #E7898D    span "2027년 1월 15일" · 15/700 #E7898D · lh 23   svg 20×20(Check)
 *     나머지    bg #FFFFFF · border 1 #000000 6%     span "2027년 상반기" · 15/700 #1A1C20 · lh 23
 *
 * 고른 줄의 면 `#E38E8E 7%`는 토큰에 없다 — 색은 MASTER 몫이라 `tintSurface`로 두고 PR에 보고했다.
 * 체크는 피그마가 lucide `Check`(SEED가 아니다)라 우리 `check` 심볼로 그린다.
 */
export function OptionRow({
  label,
  selected,
  onPress,
  role = 'radio',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: 'radio' | 'checkbox';
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'checkbox' ? { checked: selected } : { selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected
          ? { backgroundColor: theme.tintSurface, borderColor: theme.tint }
          : { backgroundColor: theme.background, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="f15" themeColor={selected ? 'tint' : 'text'} numberOfLines={1} style={styles.label}>
        {label}
      </ThemedText>
      {selected ? (
        <ProductSymbol name="check" size={Layout.iconRow} color={theme.tint} />
      ) : (
        <View style={styles.checkSlot} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* «pad 20 · r16 · border 1 · space-between · center». */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Layout.cardPadding,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
  },
  /* «15/700 · lh 23». */
  label: { fontWeight: 700, lineHeight: LineHeight.lh23, flexShrink: 1 },
  checkSlot: { width: Layout.iconRow, height: Layout.iconRow },
  pressed: { opacity: 0.8 },
});
