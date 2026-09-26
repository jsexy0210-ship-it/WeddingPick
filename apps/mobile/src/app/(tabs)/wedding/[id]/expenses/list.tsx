import type { ExpenseSummaryResponse, MyReport } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getExpenses, listMyReports } from '@/api/client';
import { useDepthBack } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { notifyRefreshFailed, usePullRefresh } from '@/features/refresh/use-pull-refresh';
import { pendingProofs } from '@/features/wedding/expense-auto-register';
import { confirmDeleteExpense, isUserExpense } from '@/features/wedding/expense-delete';
import { ExpenseRowActions } from '@/features/wedding/expense-row-actions';
import { noteMonthDay } from '@/features/wedding/note-format';
import { Border, ErrorView, Layout, Radius, SkeletonView, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import { NavBar, Screen } from '@/features/wedding/screen-kit';

import { ourWedding as copy } from '../../../../../../../../spec/strings.ko.json';

/**
 * 지출 목록. WP-OUR-014b · `docs/design/React_Native/note.jsx` frame-007.
 *
 *   nav    «지출내역» · 좌측 X 닫기(공통 풀팝업) · 오른쪽은 빈 칸(navPad) — 등록은
 *          헤더에 하나만 두는 규칙이라 예산현황 헤더의 «예산 추가»가 그 자리다
 *   sec    `padding:0 24px 20px;gap:12px`
 *   행     `spendRow` — `margin:0 20px;padding:14px 0;gap:10px`, 아래 선.
 *          항목 15/700 · 날짜 12 · 금액 15/700 · Pick 인증 배지 24 · 11/700
 *
 * 정본은 Hero 요약도 필터 칩도 빈 상태 단추도 없다 — «낸 금액이 있는 항목만 쌓입니다»
 * 한 줄이 전부라 status가 paid인 것만 보여준다(잔금 예정은 예산현황 카드에서 이미
 * 보인다). 상담 정리 출처는 v3.28 대조표 「금액 출처」 결정(2026-09-23)으로 실 제보와
 * 같은 목록에 들어오되 배지로 출처를 다르게 적는다 — Pick 인증 배지 자리에 함께 둔다.
 *
 * 직접 입력한 줄을 누르면 등록 시트가 수정 모드로 열린다(`add?expenseId=` — 수정 · 삭제).
 * 줄 끝에는 수정 · 삭제 아이콘을 둔다(2026-09-26 대표 지시 — 정본 예산 줄 `bTop`의
 * `icoEditSm` · `icoTrashSm`, 누르는 칸 44 × 44). 수정은 같은 수정 시트를 열고, 삭제는 OS
 * 확인창으로 한 번 더 묻는다. 정본 지출내역 `spendRow`에는 아이콘이 없다 — `DESIGN_UNRESOLVED`.
 * Pick 인증 · 상담 정리 줄은 금액이 자료에서 왔다 — 아이콘이 없고, 누르면 그 이유만 한 줄로 알린다.
 *
 * «확인 중» 줄(2026-09-26 — 예산 추가 «자동 등록»으로 올렸는데 서버가 못 읽은 Pick 인증) —
 * 지출(`wedding_expenses`)에는 검수가 끝나야 들어가므로 여기 없다. 올린 사람이 «사라졌다»고
 * 읽지 않게 내 제보(`GET /v1/me/reports`의 `needsCheck`)에서 가져와 맨 위에 세운다. 합계 · 막대
 * 어디에도 더하지 않고 수정 · 삭제 아이콘도 없다. 누르면 서버가 적은 보류 사유를 한 줄로 알린다.
 * 정본 `spends`에 이 줄은 없다 — `DESIGN_UNRESOLVED`(모양은 `spendRow` 그대로, 딱지만 회색).
 */
export default function ExpenseListScreen() {
  const depthBack = useDepthBack();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [page, setPage] = useState<ExpenseSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pending, setPending] = useState<MyReport[]>([]);

  /** `keep` — 당겨서 새로 고침. 보이던 내역은 두고 실패는 토스트로만 알린다. */
  const load = useCallback((keep?: boolean) => {
    getExpenses(id)
      .then((next) => {
        setPage(next);
        setError(null);
      })
      .catch((caught: Error) => {
        if (keep === true) notifyRefreshFailed();
        else setError(caught.message);
      });
    /* 못 읽으면 «확인 중» 줄만 빠진다 — 지출 목록은 그대로 보여 준다. */
    listMyReports()
      .then((result) => setPending(pendingProofs(result.reports)))
      .catch(() => setPending([]));
  }, [id]);

  useFocusEffect(load);
  const pull = usePullRefresh(useCallback(() => load(true), [load]));

  if (error) {
    return <ErrorView message={error} onBack={depthBack} onRetry={() => load()} />;
  }

  if (!page) {
    return <SkeletonView />;
  }

  const rows = page.expenses.filter((expense) => expense.status === 'paid');
  const openEdit = (expenseId: string) => router.push(`/wedding/${id}/expenses/add?expenseId=${expenseId}` as never);

  return (
    <Screen>
      <NavBar title="지출내역" variant="close" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={pull.refreshControl}>
        <View style={styles.sec}>
          {pending.map((proof) => (
            <Pressable
              key={proof.id}
              accessibilityRole="button"
              accessibilityLabel={`${proof.subject} ${copy['expense.pendingBadge']}`}
              onPress={() => showResultToast(proof.note ?? copy['expense.autoPendingNote'])}
              testID="expense-pending-row"
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: theme.border },
                pressed ? styles.pressed : null,
              ]}>
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
          {rows.map((expense) => {
            const badge =
              expense.source === 'payment_proof'
                ? { label: 'Pick 인증', text: theme.positive, background: theme.positiveBackground }
                : expense.source === 'consultation'
                  ? { label: '상담 정리', text: theme.cautionary, background: theme.cautionaryBackground }
                  : null;
            const editable = isUserExpense(expense);
            return (
              <Pressable
                key={expense.id}
                accessibilityRole="button"
                accessibilityLabel={`${expense.label} ${manwon(expense.amount)}`}
                onPress={() =>
                  editable
                    ? openEdit(expense.id)
                    : showResultToast(copy['expense.lockedSource'].replace('{source}', expense.sourceLabel))
                }
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: theme.border },
                  pressed ? styles.pressed : null,
                ]}>
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
                    disabled={deleting !== null}
                    onEdit={() => openEdit(expense.id)}
                    onDelete={() =>
                      confirmDeleteExpense({
                        weddingId: id,
                        expense,
                        onStart: () => setDeleting(expense.id),
                        onDeleted: () => {
                          showResultToast(copy['expense.deleted']);
                          load();
                        },
                        onError: (message) => showResultToast(message),
                        onSettled: () => setDeleting(null),
                      })
                    }
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /* 프레임 끝 `height:24px` 빈 칸. */
  content: { paddingBottom: Spacing.four },
  sec: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.listGap, gap: Layout.inlineGap },
  row: {
    marginHorizontal: Layout.cardPadding,
    paddingVertical: 14,
    borderBottomWidth: Border.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  col: { flex: 1, minWidth: 0, gap: 3 },
  bold: { fontWeight: 700 },
  pressed: { opacity: 0.8 },
  /* `spendBadge` — `height:24px;padding:0 8px;border-radius:4px`. 글자가 커져도 잘리지 않게 minHeight로 둔다. */
  badge: { minHeight: 24, paddingHorizontal: Spacing.two, borderRadius: Radius.badge, justifyContent: 'center' },
});
