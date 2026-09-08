import { BUDGET_BRACKET_LABEL, WEDDING_BUDGET_BRACKETS, type WeddingBudgetBracket } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

import { chunk } from './calendar';
import { CheckCircle } from './check-circle';

/**
 * 예산(4/5). 핸드오프 v3.21 «온보딩 마감» — 리스트 행이 아니라 **2열 카드
 * 그리드**, 준비 현황과 같은 톤. 500만원 단위 여섯 칸(다섯 구간 + «아직
 * 모르겠어요»). 중간 구간은 «500~» / «1,000만원» 두 줄, 양끝은 한 줄.
 *
 * 집계 문구를 붙이지 않는다 — «가장 많은 구간이에요» 같은 말은 사용자를 자기
 * 예산이 아니라 평균에 맞추게 한다(SPEC §13.6).
 *
 * 카드 최소 높이는 44(CHANGELOG v3.21 «예산 행 높이 56 → 44»). 두 줄 카드는 상하
 * 12 안쪽 여백만큼 자연히 더 높아지고, 한 줄에 놓인 두 카드는 같은 높이로 늘어난다.
 */
export function BudgetGrid({
  value,
  onChange,
}: {
  value: WeddingBudgetBracket | null;
  onChange: (next: WeddingBudgetBracket) => void;
}) {
  return (
    <View style={styles.section}>
      {chunk(WEDDING_BUDGET_BRACKETS, COLUMNS).map((row) => (
        <View key={row.join('-')} style={styles.row}>
          {row.map((bracket) => (
            <Card key={bracket} bracket={bracket} selected={value === bracket} onPress={() => onChange(bracket)} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** «500~1,000만원» → [«500~», «1,000만원»]. 양끝과 «아직 모르겠어요»는 한 줄. */
export function budgetLines(bracket: WeddingBudgetBracket): readonly string[] {
  const label = BUDGET_BRACKET_LABEL[bracket];
  const tilde = label.indexOf('~');

  if (tilde < 0) return [label];

  return [label.slice(0, tilde + 1), label.slice(tilde + 1)];
}

function Card({
  bracket,
  selected,
  onPress,
}: {
  bracket: WeddingBudgetBracket;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const label = BUDGET_BRACKET_LABEL[bracket];

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.cell}>
      <ThemedView
        style={[
          styles.card,
          selected
            ? { backgroundColor: theme.background, borderColor: theme.tint }
            : { backgroundColor: theme.backgroundElement, borderColor: 'transparent' },
        ]}>
        <View style={styles.lines}>
          {budgetLines(bracket).map((line) => (
            <ThemedText
              key={line}
              type="t6"
              numeric
              numberOfLines={1}
              themeColor={selected ? 'text' : 'textSecondary'}
              style={styles.label}>
              {line}
            </ThemedText>
          ))}
        </View>
        <CheckCircle size={CHECK} checked={selected} outline />
      </ThemedView>
    </Pressable>
  );
}

const COLUMNS = 2;
/* 시안 고정값 — 카드 최소 44 · 안쪽 12/14 · 체크 22. */
const CARD_MIN_HEIGHT = 44;
const CARD_PADDING_X = 14;
const CHECK = 22;

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Spacing.two,
  },
  row: { flexDirection: 'row', gap: Spacing.two },
  cell: { flex: 1, minWidth: 0 },
  card: {
    flex: 1,
    minHeight: CARD_MIN_HEIGHT,
    borderRadius: Radius.medium,
    borderWidth: 1.5,
    paddingVertical: Layout.rowPaddingY,
    paddingHorizontal: CARD_PADDING_X,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  lines: { flex: 1, minWidth: 0, gap: 1 },
  label: { fontWeight: 700 },
});
