import type { CandidateListResponse } from '@weddingpick/api-contract';
import type { VendorCategory } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

import { BOARD_FOLDED_VALUE, boardMark, boardTone, boardValue, type BoardTone } from './state';

/**
 * 우리 준비 — 홈 C-1의 현황판.
 *
 * 업종마다 지금 어디까지 왔는지를 한눈에 놓는다. **지목받은 칸 하나만 코랄이다** —
 * 넷 다 색이 있으면 무엇이 다음인지가 사라진다.
 *
 * 칸 안은 세로 3단(업종 / 값 / 상태)이다. 이름과 상태를 한 줄에 나란히 두면 좁은
 * 칸에서 둘 다 깨진다 — 시안이 3단으로 고쳐 잡은 이유가 그것이다. 셋 다 한 줄이고
 * 길면 말줄임한다.
 */

export type BoardProps = {
  groups: CandidateListResponse['groups'];
  /** 오늘의 Pick이 지목한 업종. 이 칸만 코랄이 된다. */
  focus: VendorCategory | null;
  onPressCategory: (category: VendorCategory) => void;
};

export function Board({ groups, focus, onPressCategory }: BoardProps) {
  return (
    <View style={styles.grid}>
      {groups.map((group) => (
        <Cell
          key={group.category}
          label={group.categoryLabel}
          pickCount={group.candidates.length}
          decidedName={
            group.decidedVendorId === null
              ? null
              : (group.candidates.find((row) => row.vendorId === group.decidedVendorId)
                  ?.vendorName ?? null)
          }
          tone={boardTone({ state: group.state, isFocus: group.category === focus })}
          onPress={() => onPressCategory(group.category)}
        />
      ))}
    </View>
  );
}

function Cell({
  label,
  pickCount,
  decidedName,
  tone,
  onPress,
}: {
  label: string;
  pickCount: number;
  decidedName: string | null;
  tone: BoardTone;
  onPress: () => void;
}) {
  const theme = useTheme();
  const value = boardValue({ pickCount, decidedName });
  const mark = boardMark({ tone, pickCount });

  const markColor =
    tone === 'done' ? theme.positive : tone === 'now' ? theme.tint : theme.textDisabled;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value} ${mark}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        tone === 'now'
          ? { borderWidth: 1.5, borderColor: theme.tint, backgroundColor: theme.background }
          : { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText
        type="t4"
        themeColor={tone === 'none' ? 'textDisabled' : 'text'}
        numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText type="t7" numberOfLines={1} style={[styles.mark, { color: markColor }]}>
        {mark}
      </ThemedText>
    </Pressable>
  );
}

/**
 * 격자를 접었을 때 대신 놓는 한 줄.
 *
 * **빈 칸 네 개를 그대로 보여주지 않는다.** 정할 것이 하나라도 생기면 격자로
 * 펼친다 — 그때까지는 이 줄이 «아직 시작 전»이라고만 말한다.
 */
export function FoldedBoard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`우리 준비 ${BOARD_FOLDED_VALUE}`}
      onPress={onPress}>
      <ThemedView type="backgroundElement" style={styles.folded}>
        <View style={styles.foldedText}>
          <ThemedText type="t5">우리 준비</ThemedText>
          <ThemedText type="t7" themeColor="textAssistive">
            정할 때마다 쌓여요
          </ThemedText>
        </View>
        <ThemedText type="t6" themeColor="textAssistive" numberOfLines={1}>
          {BOARD_FOLDED_VALUE}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  cell: {
    /*
     * 두 칸이 한 줄에 오도록 절반에서 간격의 절반을 뺀다. 화면 폭을 재지 않는
     * 이유는, 재면 첫 프레임에 폭을 모른 채로 한 번 그려지기 때문이다.
     */
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 0,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  mark: { paddingTop: 2, fontWeight: 700 },
  pressed: { opacity: 0.8 },
  folded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: Layout.rowMinHeight,
    paddingHorizontal: 18,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
  },
  foldedText: { flex: 1, minWidth: 0, gap: 2 },
});
