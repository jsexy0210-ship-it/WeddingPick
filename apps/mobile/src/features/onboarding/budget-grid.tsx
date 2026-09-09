import { BUDGET_BRACKET_LABEL, WEDDING_BUDGET_BRACKETS, type WeddingBudgetBracket } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

import { chunk } from './calendar';
import { CheckCircle } from './check-circle';

/**
 * 예산(4/5). 시안 20-onboarding-v2 `budgetCard()` · screens.json WP-APP-020 ④ —
 * **2열 카드 그리드**, min-height 68 · padding 12 14 · radius 10 · gap 8 · 글자
 * 15/700(토큰 t6 16). 500만원 단위 여섯 칸(다섯 구간 + «아직 모르겠어요»). 중간
 * 구간은 «500~» / «1,000만원» 두 줄, 양끝과 «아직 모르겠어요»는 띄어쓰기에서 두 줄
 * (`budgetLines`). SPEC «컨트롤 규격»의 76은 v3.19 값이고 시안 · screens.json이
 * 68로 갱신했다 — 최신 md를 따른다.
 *
 * **말줄임하지 않는다.** 금액이 잘리면 무슨 구간인지 알 수 없으므로 두 줄로 나눠
 * 전부 보여준다. 칸은 `minmax(0,1fr)` — RN에서는 `flex: 1 · flexBasis: 0 ·
 * minWidth: 0`이라 긴 글자가 칸을 밀어 거터를 넘지 못한다.
 *
 * 집계 문구를 붙이지 않는다 — «가장 많은 구간이에요» 같은 말은 사용자를 자기
 * 예산이 아니라 평균에 맞추게 한다(SPEC §13.6).
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

/**
 * «500~1,000만원» → [«500~», «1,000만원»]. 띄어쓰기가 있는 라벨(«500만원 이하» «3,000만원
 * 이상» «아직 모르겠어요»)은 띄어쓰기에서 나눈다 — 390 폭에서 체크 22를 뺀 칸에 토큰 16px로는
 * «3,000만원 이상»이 안 들어가고, 한글은 글자 단위로 꺾여 «3,000만원 이 / 상»이 된다
 * (2026-09-09 확인 · 시안은 15px라 한 줄). 두 줄로 나눠 전부 보여주고 말줄임은 하지 않는다
 * (SPEC §13.6 «예산은 말줄임하지 않습니다»).
 */
export function budgetLines(bracket: WeddingBudgetBracket): readonly string[] {
  const label = BUDGET_BRACKET_LABEL[bracket];
  const tilde = label.indexOf('~');

  if (tilde >= 0) return [label.slice(0, tilde + 1), label.slice(tilde + 1)];
  if (label.includes(' ')) return label.split(' ', 2);

  return [label];
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
/* 시안 고정값 — 카드 최소 68 · 좌우 14(상하는 토큰 rowPaddingY 12) · 체크 22 · 글자와 체크 사이 6. */
const CARD_MIN_HEIGHT = 68;
const CARD_PADDING_X = 14;
const CHECK = 22;
const CARD_GAP = 6;

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Spacing.two,
  },
  row: { flexDirection: 'row', gap: Spacing.two },
  /* minmax(0,1fr). */
  cell: { flex: 1, flexBasis: 0, minWidth: 0 },
  /*
   * 시안 budgetCard — min-height 68 · 상하 12 · 좌우 14. 글자와 체크 사이는 시안 8이
   * 아니라 6이다 — 글자가 시안 15가 아니라 토큰 16이어서 390 폭에서 «3,000만원 이상»이
   * 8이면 글자 중간에서 꺾인다(2026-09-09 확인).
   */
  card: {
    minHeight: CARD_MIN_HEIGHT,
    borderRadius: Radius.medium,
    borderWidth: 1.5,
    paddingVertical: Layout.rowPaddingY,
    paddingHorizontal: CARD_PADDING_X,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: CARD_GAP,
  },
  lines: { flex: 1, minWidth: 0 },
  label: { fontWeight: 700 },
});
