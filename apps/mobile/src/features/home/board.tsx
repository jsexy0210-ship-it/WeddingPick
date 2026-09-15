import type { VendorCategory } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Border,
  CategoryIcon,
  Layout,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';

import { categoryIconKind } from '@/features/search/category-icon-kind';

import type { BoardCell, BoardTone } from './state';

/**
 * 준비 현황 — 홈의 4칸 격자. SPEC §13.8 · §13.9.
 *
 * **항상 4칸이다.** 12업종을 다 펼치지 않는다. 나머지는 «전체 보기»(WP-HOME-009)로
 * 넘긴다. 네 칸 모두 **라벨은 업종명, 값은 상태**로 축을 통일한다 — 격자 안에
 * 카운터를 섞지 않고, 빈 칸이나 «—»를 쓰지 않는다.
 *
 * **2×2다**(2026-09-15). 예전에는 한 줄에 네 칸이라 칸 폭이 90 남짓이었고, 업종명과
 * 상태가 각각 한 줄씩 들어가면 더 넣을 자리가 없었다. AGENTS.md의 «WP-HOME-001
 * 레이아웃 충돌은 전달 HTML·PNG 시각 디자인을 최종 기준으로 한다. **준비현황 2×2**,
 * 추천 3열»이 정한 것이 이 모양이고, 피그마 시안(`Home.tsx` `PREP_STATUS`)도 같다.
 * 2026-09-14에 대표님이 앱을 열어 보시고 「피그마랑 아예 다르잖아」라고 하신 자리가
 * 여기다 — 가로 네 칸짜리 작은 칩이 그려져 있었다.
 *
 * **아이콘은 업종 아이콘(WP-ST-016)이고 이모지가 아니다.** 피그마는 🏛️ 📷 👗 💄를
 * 쓰지만 AGENTS.md가 「임의 이모지·유사 아이콘으로 대체하지 않는다」고 못박았고,
 * 이모지는 기기마다 다른 그림이 나온다. 순회 로더 · 검색 업종 격자와 같은 글리프다.
 *
 * **수치는 정본 토큰이다.** 피그마 저장소의 `p-3.5`·`rounded-2xl`은 Figma Make가
 * 생성한 근사치라 시안 값이 아니다(`docs/rn-migration/FIGMA_SCREEN_INVENTORY.md` §1
 * B등급). 가져오는 것은 **구성**이고 값은 `spec/tokens.json`에서 온다.
 *
 * **지금 좁힐 업종 하나만 코랄 테두리다**(홈 코랄 다섯 곳 중 하나). 완료는 초록이
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
 * 크기는 micro(13)다 — 2×2로 바뀌며 업종명과 위계가 뒤집혔다(`Cell` 주석).
 */
function valueColor(tone: BoardTone): 'text' | 'textSecondary' | 'textDisabled' {
  if (tone === 'done') return 'textSecondary';
  if (tone === 'none') return 'textDisabled';

  return 'text';
}

/**
 * 칸 오른쪽 위의 상태 표시. 피그마가 완료 ✓ · 진행 시계 · 미착수 빈 원으로 나눈
 * 자리다. 시계 글리프가 따로 없어 **담는 중은 코랄 점**으로 대신한다 — 없는
 * 아이콘을 다른 라이브러리에서 가져오지 않는다(AGENTS.md).
 *
 * 색은 상태색을 쓰지 않는다. 완료가 초록이 되면 격자 넷 중 하나가 화면에서 가장
 * 먼저 읽히고, 홈에서 먼저 읽혀야 하는 것은 «지금 할 것»이다.
 */
function StatusMark({ tone }: { tone: BoardTone }) {
  const theme = useTheme();

  if (tone === 'done') {
    return <ProductSymbol name="check" size={Layout.iconInline} color={theme.textSecondary} />;
  }

  if (tone === 'going' || tone === 'now') {
    return <View style={[styles.dot, { backgroundColor: theme.tint }]} />;
  }

  return <View style={[styles.emptyMark, { borderColor: theme.textDisabled }]} />;
}

function Cell({ cell, onPress }: { cell: BoardCell; onPress: () => void }) {
  const theme = useTheme();
  const kind = categoryIconKind(cell.category);

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
      <View style={styles.cellHead}>
        {/* 아이콘이 없는 업종(기타)은 자리만 비운다 — 다른 그림으로 메우지 않는다. */}
        {kind === null ? (
          <View style={styles.iconSlot} />
        ) : (
          <CategoryIcon kind={kind} size={Layout.iconTab} />
        )}
        <StatusMark tone={cell.tone} />
      </View>

      {/*
        **업종명이 위계상 위다**(2026-09-15). 한 줄 네 칸이던 시절에는 칸이 좁아
        상태를 크게 적어야 멀리서 읽혔는데, 2×2가 되면서 칸이 넓어져 그럴 이유가
        없어졌다. 피그마도 업종명이 굵고 그 아래 상태가 작다 — 격자를 훑을 때
        찾는 것은 「무슨 업종이 있나」이고 상태는 그다음이다.

        축은 그대로다: **라벨은 업종명 · 값은 상태**(SPEC §13.8). 바뀐 것은 굵기와
        크기뿐이라 `boardValue`의 말과 시험은 손대지 않았다.
      */}
      <ThemedText type="t7" numberOfLines={1} style={styles.label}>
        {cell.label}
      </ThemedText>
      <ThemedText
        type="micro"
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

/** 오른쪽 위 상태 표시의 지름. 완료 체크(`Layout.iconInline`)와 같은 자리에 앉는다. */
const MARK_SIZE = 8;

const styles = StyleSheet.create({
  /*
   * 2×2. 가로·세로 모두 2열 격자 토큰(`gap2col` 11)이다. 행 사이에 `gap2colRow`(20)를
   * 쓰지 않는 것은 그 값이 **큰 2열 카드**용이라 — 네 칸짜리 상태 격자에 20을 주면
   * 격자가 두 덩어리로 갈라져 읽힌다. 세로로만 넓은 격자를 만들지 않는다.
   */
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Layout.gap2col, rowGap: Layout.gap2col },
  /*
   * 한 줄에 둘. `flexBasis: '48%'`처럼 어림잡지 않는다 — 거터가 바뀌면 칸이 밀린다.
   * 남는 폭을 둘이 나누고 gap이 그 사이를 벌린다.
   */
  cell: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: '40%',
    borderRadius: Radius.medium,
    borderWidth: NOW_BORDER,
    paddingVertical: Layout.rowPaddingY - NOW_BORDER,
    paddingHorizontal: Layout.cardGap - NOW_BORDER,
    gap: 3,
  },
  cellHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  iconSlot: { width: Layout.iconTab, height: Layout.iconTab },
  dot: { width: MARK_SIZE, height: MARK_SIZE, borderRadius: Radius.pill },
  emptyMark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: Radius.pill,
    borderWidth: Border.selected,
  },
  label: { fontWeight: 700 },
  /* micro는 700이라 굵기만 내린다 — 상태는 업종명보다 조용하다. */
  value: { fontWeight: 400 },
  pressed: { opacity: 0.8 },
});
