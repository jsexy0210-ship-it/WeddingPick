/**
 * 홈 준비 현황 2×2 — 규격서 docs/figma-spec/home.txt(2026-09-15 대표 지시 「규격서의 수를 그대로」).
 *
 *   div 390×216  grid · cols 191px 191px · gap 8
 *     div 191×104  pad 14 · bg #F7F8F9 · r16 · border 1 #000000 6%
 *       div 161×28  flex · justify space-between · align flex-start · mar 0 0 8 0
 *         span "🏛️" · 20/400 · lh 28                 svg 16×16
 *       p "웨딩홀" · 14/600 · lh 20
 *       p "서울 그랜드 워커힐" · 12/500 · lh 16 · mar 2 0 0 0
 *
 * 아이콘은 피그마가 그린 **이모지 그대로**다(2026-09-15 대표 지시 「전체 이모지 SEED 걸로 사용,
 * 선 아이콘 X」). 앞 세션이 선 아이콘(CategoryIcon)으로 바꿨던 것을 되돌렸다.
 *
 * 상태 셋(피그마 `PREP_STATUS`): done = 회색 면 + 체크 16 · 상세 잉크, picking = 하늘색 면 +
 * 시계 16 · 상세 하늘색, todo = 회색 면 + 빈 고리 16(테두리 1.5 · muted 30%) · 상세 muted.
 * **하늘색(#F0F9FF · #B8E6FE · #0084D1)은 우리 토큰에 없다** — 색은 MASTER 몫이라 만들지 않고
 * 있는 accent(하늘) 토큰을 쓰며 PR에 보고했다. 축은 그대로다: 라벨은 업종명 · 값은 상태.
 */
import type { VendorCategory } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Border, Layout, LineHeight, ProductSymbol, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import type { BoardCell, BoardTone } from './state';

export type BoardProps = {
  cells: readonly BoardCell[];
  onPressCategory: (category: VendorCategory) => void;
};

/** 피그마 `PREP_STATUS` · `CATEGORIES`의 이모지. 없는 업종은 자리만 비운다 — 다른 그림으로 메우지 않는다. */
export const CATEGORY_EMOJI: Partial<Record<VendorCategory, string>> = {
  hall: '🏛️',
  studio: '📷',
  dress: '👗',
  makeup: '💄',
  snap: '📸',
  honeymoon: '✈️',
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

/** 피그마 세 상태 — done · picking · todo. 우리 tone 넷 중 going · now가 picking이다. */
function figmaState(tone: BoardTone): 'done' | 'picking' | 'todo' {
  if (tone === 'done') return 'done';
  if (tone === 'going' || tone === 'now') return 'picking';
  return 'todo';
}

function StatusMark({ state }: { state: 'done' | 'picking' | 'todo' }) {
  const theme = useTheme();

  if (state === 'done') return <ProductSymbol name="checkCircle" size={Layout.iconField} color={theme.text} />;
  if (state === 'picking') return <ProductSymbol name="clock" size={Layout.iconField} color={theme.accentText} />;

  return <View style={[styles.emptyRing, { borderColor: theme.textAssistive }]} />;
}

function Cell({ cell, onPress }: { cell: BoardCell; onPress: () => void }) {
  const theme = useTheme();
  const state = figmaState(cell.tone);
  const emoji = CATEGORY_EMOJI[cell.category];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cell.label} ${cell.value}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        state === 'picking'
          ? { backgroundColor: theme.accentBackground, borderColor: theme.accentText }
          : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.cellHead}>
        {emoji ? (
          <ThemedText type="f20" style={styles.emoji}>
            {emoji}
          </ThemedText>
        ) : (
          <View style={styles.emojiSlot} />
        )}
        <StatusMark state={state} />
      </View>
      <ThemedText type="f14" numberOfLines={1} style={styles.label}>
        {cell.label}
      </ThemedText>
      <ThemedText
        type="f12"
        numberOfLines={1}
        style={[
          styles.value,
          { color: state === 'done' ? theme.text : state === 'picking' ? theme.accentText : theme.textAssistive },
        ]}>
        {cell.value}
      </ThemedText>
    </Pressable>
  );
}

/** 빈 고리 `h-4 w-4 border-[1.5px] muted/30` — 16 · 테두리 1.5(같은 값의 Border.selected) · 30%. */
const RING = Layout.iconField;

const styles = StyleSheet.create({
  /* 「grid · cols 191px 191px · gap 8」 — 두 칸이 폭을 반씩. */
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.two, rowGap: Spacing.two },
  cell: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: '40%',
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    padding: Layout.fieldPaddingX,
  },
  /* 「div 161×28 … align flex-start · mar 0 0 8 0」. */
  cellHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  /* 이모지 «20/400 · lh 28». */
  emoji: { lineHeight: LineHeight.lh28 },
  emojiSlot: { width: Layout.iconTab, height: LineHeight.lh28 },
  emptyRing: { width: RING, height: RING, borderRadius: Radius.pill, borderWidth: Border.selected, opacity: 0.3 },
  /* 업종명 «14/600 · lh 20». */
  label: { fontWeight: 600 },
  /* 상태 «12/500 · lh 16 · mar 2 0 0 0». */
  value: { fontWeight: 500, marginTop: Spacing.half },
  pressed: { opacity: 0.8 },
});
