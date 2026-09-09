import type { VendorCategory } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Border, Layout, Radius, ThemedText, useTheme } from '@weddingpick/ui';

import type { BoardCell, BoardTone } from './state';

/**
 * 준비 현황 — 홈의 4칸 격자. SPEC §13.8 · §13.9.
 *
 * **항상 4칸이다.** 12업종을 다 펼치지 않는다. 나머지는 «전체 보기»(WP-HOME-009)로
 * 넘긴다. 네 칸 모두 **라벨은 업종명, 값은 상태**로 축을 통일한다 — 격자 안에
 * 카운터를 섞지 않고, 빈 칸이나 «—»를 쓰지 않는다.
 *
 * **지금 좁힐 업종 하나만 코랄 테두리다**(홈 코랄 네 곳 중 하나). 완료는 초록이
 * 아니라 `textSecondary`(#4D5159)다 — 상태색을 아낀다.
 */

export type BoardProps = {
  cells: readonly BoardCell[];
  onPressCategory: (category: VendorCategory) => void;
};

export function Board({ cells, onPressCategory }: BoardProps) {
  return (
    <View style={styles.grid}>
      {cells.map((cell) => (
        <Cell key={cell.category} cell={cell} onPress={() => onPressCategory(cell.category)} />
      ))}
    </View>
  );
}

/**
 * 값 글자색. 시안: 완료 #4D5159 · 지금 #212124 · 시작 전 #ADB1BA · 담는 중 #212124.
 * 값 글자는 시안이 15/20인데 토큰 사다리에 15가 없어 16(t6)이다.
 */
function valueColor(tone: BoardTone): 'text' | 'textSecondary' | 'textDisabled' {
  if (tone === 'done') return 'textSecondary';
  if (tone === 'none') return 'textDisabled';

  return 'text';
}

function Cell({ cell, onPress }: { cell: BoardCell; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cell.label} ${cell.value}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        /*
         * 테두리는 네 칸 모두 1.5다 — 지금 칸만 코랄이고 나머지는 투명. 지금 칸에만
         * 테두리를 주면 그 칸이 3px 넓어져 격자가 어긋난다(시안은 inset box-shadow).
         */
        cell.tone === 'now'
          ? { borderColor: theme.tint, backgroundColor: theme.background }
          : { borderColor: 'transparent', backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      {/* 시안 13/18 400 — micro는 700이라 굵기만 내린다. */}
      <ThemedText type="micro" themeColor="textAssistive" numberOfLines={1} style={styles.label}>
        {cell.label}
      </ThemedText>
      <ThemedText
        type="t6"
        numberOfLines={1}
        themeColor={valueColor(cell.tone)}
        style={styles.value}>
        {cell.value}
      </ThemedText>
    </Pressable>
  );
}

/** 지금 칸의 코랄 테두리 굵기. 시안 `inset 0 0 0 1.5px` — spec/tokens.json border.selected. */
const NOW_BORDER = Border.selected;

const styles = StyleSheet.create({
  /* 시안: repeat(4, minmax(0,1fr)) · gap 7. 네 칸이 한 줄에 같은 폭으로 선다. */
  grid: { flexDirection: 'row', gap: 7 },
  /* 시안 cell: radius 10 · padding 12 10 · gap 3 · 테두리 1.5. */
  cell: {
    flex: 1,
    minWidth: 0,
    borderRadius: Radius.medium,
    borderWidth: NOW_BORDER,
    paddingVertical: Layout.rowPaddingY - NOW_BORDER,
    paddingHorizontal: Layout.cardGap - NOW_BORDER,
    alignItems: 'center',
    gap: 3,
  },
  label: { fontWeight: 400 },
  value: { fontWeight: 700 },
  pressed: { opacity: 0.8 },
});
