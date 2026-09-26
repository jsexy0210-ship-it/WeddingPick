import type { ExpenseSummaryResponse, MyReport } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Border, Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import { ourWedding as copy } from '../../../../../spec/strings.ko.json';

import type { BudgetCategoryRow } from './budget-lines';
import { isUserExpense } from './expense-delete';
import { ExpenseRowActions } from './expense-row-actions';
import { noteMonthDay } from './note-format';

type Expense = ExpenseSummaryResponse['expenses'][number];

/* note.js `bd()` — 항목별 막대 아래 왼쪽 줄. */
const UNPAID = '아직 안 냈어요';
const BAR_HEIGHT = 6;

/**
 * 예산현황 카드의 업종 목록 — 지출내역을 흡수했다(2026-09-26 대표 지시 「지출내역을 예산현황 목록과
 * 통/폐합한다. 이후 지출내역 풀팝업은 삭제한다」).
 *
 *   업종 줄   정본 `docs/design/React_Native/note.jsx:290-293` `bRow` — 머리 `bTop`(이름 15/700 ·
 *             금액 13 MUTED) · 막대 `trackSm` 6px · 발 `bFoot`(냈어요 12 · % 12/700)
 *   지출 건   정본 지출내역 `spendRow`(note.js:191-196) — 이름 15/700 · 날짜 12 · 금액 15/700 ·
 *             출처 배지 24 · 11/700. 카드 안이라 좌우 여백은 카드 안쪽 20이 대신한다
 *   아이콘    직접 넣은 건마다 수정 · 삭제(`ExpenseRowActions` — 정본 `bTop`의 `icoEditSm` ·
 *             `icoTrashSm` 14px, 누르는 칸 44). Pick 인증 · 상담 정리 건은 자료에서 온 금액이라
 *             아이콘이 없고, 누르면 그 이유를 한 줄로 알린다
 *   확인 중   예산 추가 «자동 등록»으로 올렸는데 서버가 아직 못 읽은 Pick 인증 — 지출에는 검수가
 *             끝나야 들어가므로 업종을 모른다. 목록 맨 위에 회색 «확인 중» 딱지로 세우고 합계 ·
 *             막대 어디에도 더하지 않는다
 *
 * `DESIGN_UNRESOLVED` — 정본에는 통합 목록 그림이 없다. 정본 `bTop`의 아이콘은 업종 예산(«400만원»)을
 * 고치는 자리였는데 그 값은 2026-09-26에 지웠다(「아무런 의미가 없다」). 그래서 아이콘을 업종 머리가
 * 아니라 **지출 건**에 둔다 — 한 업종에 여러 건이면 머리 아이콘 하나로는 어느 건을 고칠지 정할 수
 * 없다. 모양은 정본 `bRow` · `spendRow`를 그대로 잇는다.
 */
export function BudgetCategoryList({
  rows,
  pending,
  busy,
  onEdit,
  onDelete,
  onLocked,
  onPending,
}: {
  rows: BudgetCategoryRow[];
  pending: MyReport[];
  busy: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onLocked: (expense: Expense) => void;
  onPending: (proof: MyReport) => void;
}) {
  const theme = useTheme();

  return (
    <View testID="budget-category-list">
      {pending.map((proof) => (
        <Pressable
          key={proof.id}
          accessibilityRole="button"
          accessibilityLabel={`${proof.subject} ${copy['expense.pendingBadge']}`}
          onPress={() => onPending(proof)}
          testID="expense-pending-row"
          style={({ pressed }) => [styles.line, { borderBottomColor: theme.border }, pressed ? styles.pressed : null]}>
          <View style={styles.col}>
            <ThemedText type="f15" numberOfLines={1} themeColor="textAssistive" style={styles.bold}>
              {proof.subject}
            </ThemedText>
            <ThemedText type="f12" themeColor="textAssistive" numeric>
              {noteMonthDay(proof.reportedAt)}
            </ThemedText>
          </View>
          {proof.amount !== null ? (
            <ThemedText type="f15" numeric themeColor="textAssistive" style={styles.bold}>
              {manwon(proof.amount)}
            </ThemedText>
          ) : null}
          <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="f11" themeColor="textAssistive" style={styles.bold}>
              {copy['expense.pendingBadge']}
            </ThemedText>
          </View>
        </Pressable>
      ))}

      {rows.map((row) => {
        const pct = Math.min(100, Math.round(row.ratio * 100));
        const full = pct >= 100;
        return (
          <View key={row.key} style={styles.bucketRow} testID={`budget-row-${row.key}`}>
            <View style={styles.bucketHead}>
              <ThemedText type="f15" numberOfLines={1} style={[styles.bold, styles.grow]}>
                {row.label}
              </ThemedText>
              <ThemedText type="f13" themeColor="textAssistive" numeric>
                {manwon(row.amount)}
              </ThemedText>
            </View>
            <View style={[styles.bar, { backgroundColor: theme.backgroundSelected }]}>
              {/* 정본 `bd()` — 다 쓴(100%) 항목만 코랄, 나머지는 옅은 코랄(`#ffb3ab` → 차트 2계열 토큰). */}
              <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: full ? theme.tint : theme.chartSeries2 }]} />
            </View>
            <View style={styles.bucketFoot}>
              <ThemedText type="f12" themeColor="textAssistive" numeric>
                {row.amount > 0 ? `${manwon(row.amount)} 냈어요` : UNPAID}
              </ThemedText>
              <ThemedText type="f12" themeColor={full ? 'tint' : 'textAssistive'} numeric style={styles.bold}>
                {`${pct}%`}
              </ThemedText>
            </View>

            {row.expenses.length > 0 ? (
              <View>
                {row.expenses.map((expense) => (
                  <ExpenseLine
                    key={expense.id}
                    expense={expense}
                    busy={busy}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onLocked={onLocked}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function ExpenseLine({
  expense,
  busy,
  onEdit,
  onDelete,
  onLocked,
}: {
  expense: Expense;
  busy: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onLocked: (expense: Expense) => void;
}) {
  const theme = useTheme();
  const editable = isUserExpense(expense);
  const badge =
    expense.source === 'payment_proof'
      ? { label: 'Pick 인증', text: theme.positive, background: theme.positiveBackground }
      : expense.source === 'consultation'
        ? { label: '상담 정리', text: theme.cautionary, background: theme.cautionaryBackground }
        : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${expense.label} ${manwon(expense.amount)}`}
      onPress={() => (editable ? onEdit(expense) : onLocked(expense))}
      testID="budget-expense-line"
      style={({ pressed }) => [styles.line, { borderBottomColor: theme.border }, pressed ? styles.pressed : null]}>
      <View style={styles.col}>
        <ThemedText type="f15" numberOfLines={1} style={styles.bold}>
          {expense.label}
        </ThemedText>
        {expense.spentOn ? (
          <ThemedText type="f12" themeColor="textAssistive" numeric>
            {noteMonthDay(expense.spentOn)}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="f15" numeric style={styles.bold}>
        {manwon(expense.amount)}
      </ThemedText>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: badge.background }]}>
          <ThemedText type="f11" style={[styles.bold, { color: badge.text }]}>
            {badge.label}
          </ThemedText>
        </View>
      ) : null}
      {editable ? (
        <ExpenseRowActions
          label={expense.label}
          disabled={busy}
          onEdit={() => onEdit(expense)}
          onDelete={() => onDelete(expense)}
        />
      ) : null}
    </Pressable>
  );
}

/* 값은 정본 `note.js` — `bRow` · `bTop` · `trackSm` · `bFoot`(예산 줄), `spendRow` · `spendBadge`(지출 건). */
const styles = StyleSheet.create({
  bold: { fontWeight: 700 },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.8 },
  /* note.js `bRow` — `flex-direction:column;gap:6px;padding-bottom:16px`. */
  bucketRow: { gap: 6, paddingBottom: Spacing.three },
  /* note.js `bTop` — `gap:8px`. */
  bucketHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  /* note.js `trackSm` — 6px · pill · SEC. */
  bar: { height: BAR_HEIGHT, borderRadius: Radius.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: Radius.pill },
  /* note.js `bFoot` — `align-items:baseline;justify-content:space-between`. */
  bucketFoot: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  /*
   * note.js `spendRow` — `padding:14px 0;gap:10px;box-shadow:inset 0 -1px 0 BORDER`. 아이콘 칸(44)이
   * 위아래 여백을 품으므로 줄은 최소 52(44 + 8)로 두고 여백은 4씩만 준다 — 아이콘이 없는 줄(Pick 인증 ·
   * 상담 정리 · 확인 중)도 같은 높이로 선다. 정본 14 여백과 다르다 — `DESIGN_UNRESOLVED`.
   */
  line: {
    minHeight: Layout.touchTarget + Spacing.two,
    paddingVertical: Spacing.one,
    borderBottomWidth: Border.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  col: { flex: 1, minWidth: 0, gap: 3 },
  /* `spendBadge` — `height:24px;padding:0 8px;border-radius:4px`. 글자가 커져도 잘리지 않게 minHeight로 둔다. */
  badge: { minHeight: 24, paddingHorizontal: Spacing.two, borderRadius: Radius.badge, justifyContent: 'center' },
});
