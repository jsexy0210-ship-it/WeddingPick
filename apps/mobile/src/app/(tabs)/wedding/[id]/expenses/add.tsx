import type { CreateExpenseRequest, ExpenseSummaryResponse } from '@weddingpick/api-contract';
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  manualExpenseOverBudget,
  manwon,
  type VendorCategory,
} from '@weddingpick/domain';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { addExpense, getExpenses, updateExpense } from '@/api/client';
import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';
import { CtaRow } from '@/features/common/cta-row';
import { requestDirtySheetClose } from '@/features/common/dirty-sheet-close';
import { showOsToast } from '@/features/common/os-toast';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { todayDay } from '@/features/wedding/expense-day';
import { ExpenseAddChooser } from '@/features/wedding/expense-add-chooser';
import { confirmDeleteExpense } from '@/features/wedding/expense-delete';
import { Field } from '@/features/wedding/screen-kit';
import { ActionButton, FilterChip, Spacing, ThemedText, Toast } from '@weddingpick/ui';

import { ourWedding as copy } from '../../../../../../../../spec/strings.ko.json';
import WeddingScreen from '../../index';
import ExpenseListScreen from './list';

/**
 * 예산 추가 시트 — WP-NOTE-007 · `docs/design/React_Native/note.jsx` frame-006.
 *
 *   formHead  공용 SheetHeader — 타이틀 «예산 추가» + 우측 36px 회색 원형 X
 *   칸        항목(업종 칩) · 낸 금액 둘. 서버가 받는 것(`createExpenseRequest`)도 그 둘이고,
 *             날짜는 오늘로 넣는다.
 *
 * 헤더 «예산 추가»로 열면 먼저 «자동 등록(Pick 인증) · 직접 입력» 고르는 시트가 뜬다(2026-09-26
 * 대표 지시, `features/wedding/expense-add-chooser.tsx`). 같은 라우트 · 같은 시트 안에서 바뀐다 —
 * 새 라우트를 두지 않아 Back 규칙(`depth-back-rules.ts`)이 그대로다. «직접 입력»을 고르면 아래 입력
 * 칸이 열리고, `?mode=manual` · `?category=` · `?vendorName=`로 들어오면 고르기를 건너뛴다.
 *
 * 정본에 없는 «업체» · «낸 날짜» 칸, «자료를 올리면 실 제보가 돼요» 목록과 «원본은 24시간
 * 안에 지워요» 안내는 지웠다. 정본 `mergedFields`의 «예산» 칸도 지웠다(2026-09-26 대표 지시
 * 「아무런 의미가 없다」) — 항목별 예산을 담는 서버 값 · DB 칸은 원래 없었다. `DESIGN_UNRESOLVED`:
 *   - 정본 «사진으로 채우기» 칸과 «읽었어요 · 확인 필요» 딱지 — 사진은 고르는 시트의 «자동 등록»이
 *     맡는다(서버가 읽어 바로 지출로 넣는다). 이 시트 안에서 채우는 칸은 만들지 않는다
 *   - CTA — 정본 dock은 «직접입력 · 자동입력» 두 단추다. 고르는 시트가 그 둘을 맡아서 여기는
 *     단추 하나 «지출 넣기»(일정 시트 WP-NOTE-002 `btnPrimaryFull` «일정 넣기»와 같은 꼴)로 둔다 —
 *     정본에 한 단추 문구는 없다. 폭(한 개면 꽉 참 · 둘이면 1 : 1.4)은 공용 CTA 줄(`CtaRow`,
 *     my-orders 작업)이 이 `actions` 자리를 감싸 맞춘다 — 여기서 따로 폭을 고치지 않는다
 *
 * 수정 모드(`?expenseId=`) — 지출내역에서 직접 입력한 줄을 누르면 같은 시트가 값이 채워진 채
 * 열린다(2026-09-25 대표 지시 「등록된 예산정보 수정, 삭제 기능이 없다」). 저장은 PATCH, 시트 안
 * «삭제»는 무엇이 지워지는지 보여준 뒤 한 번 더 묻고 DELETE. 정본 note.jsx에 수정 · 삭제 프레임이
 * 없어 등록 시트를 그대로 쓴다 — `DESIGN_SOURCE_NOT_VERIFIED`. 날짜는 보내지 않아 그대로 남는다.
 * 결제인증 · 상담 정리 줄은 여기 오지 않는다(지출내역이 막는다). 주소로 직접 와도 칸을 잠근다.
 *
 * 총예산 한도(2026-09-25 대표 지시 「예산 추가는 총예산을 넘을 수 없다」) — 총예산이 있으면
 * 저장 전에 `manualExpenseOverBudget`(서버와 같은 판정)으로 보고, 넘으면 저장하지 않고 OS
 * 토스트로 남은 예산을 알린다. 총예산이 없으면 한도가 없다. 서버도 같은 판정으로 400을 준다.
 */

function isVendorCategory(value: string | undefined): value is VendorCategory {
  return value !== undefined && (VENDOR_CATEGORIES as readonly string[]).includes(value);
}

/**
 * /expenses/add 딥링크는 부모 지출 화면 + DLG-D 입력 시트로 연결한다.
 */
export default function AddExpenseRoute() {
  const { id, vendorName, category, expenseId, mode: modeParam } = useLocalSearchParams<{
    id: string;
    vendorName?: string;
    category?: string;
    expenseId?: string;
    mode?: string;
  }>();

  const { height } = useWindowDimensions();
  const editing = Boolean(expenseId);
  /* 고르는 시트 → 직접 입력. 수정 · 업체에서 들어온 길 · `?mode=manual`은 고르기를 건너뛴다. */
  const [choosing, setChoosing] = useState(
    () => !editing && modeParam !== 'manual' && !category && !vendorName
  );
  /* 자동 등록이 사진을 올리고 읽는 동안에는 시트를 닫지 않는다. */
  const [autoBusy, setAutoBusy] = useState(false);
  const [original, setOriginal] = useState<ExpenseSummaryResponse['expenses'][number] | null>(null);
  const initialCategory = editing
    ? isVendorCategory(original?.category ?? undefined)
      ? (original!.category as VendorCategory)
      : null
    : isVendorCategory(category)
      ? category
      : null;
  const initialAmountText = original ? formatAmount(String(original.amount)) : '';

  const [amountText, setAmountText] = useState('');
  const [picked, setPicked] = useState<VendorCategory | null>(initialCategory);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /* 한도 판정용 — GET /expenses의 budget(총예산 · 쓴 금액). 못 읽으면 null로 두고 서버 판정에 맡긴다. */
  const [limit, setLimit] = useState<{ budget: number | null; spent: number } | null>(null);

  useEffect(() => {
    let active = true;
    getExpenses(id)
      .then((page) => {
        if (!active) return;
        setLimit(
          page.budget.set
            ? { budget: page.budget.budget, spent: page.budget.spent }
            : { budget: null, spent: page.paidTotal }
        );
        if (!expenseId) return;
        const row = page.expenses.find((expense) => expense.id === expenseId);
        if (!row) {
          setError('지출을 찾지 못했어요. 목록에서 다시 골라주세요.');
          return;
        }
        setOriginal(row);
        setAmountText(formatAmount(String(row.amount)));
        setPicked(isVendorCategory(row.category ?? undefined) ? (row.category as VendorCategory) : null);
      })
      .catch((caught: Error) => {
        if (active && expenseId) setError(caught.message);
      });
    return () => {
      active = false;
    };
  }, [id, expenseId]);

  /* 결제인증 · 상담 정리 줄은 금액이 자료에서 왔다 — 고치면 출처가 거짓이 된다. */
  const locked = editing && (original === null || original.source !== 'manual');

  const amount = Number(amountText.replace(/[^\d]/g, ''));
  /*
   * 줄 이름 — 업체에서 들어왔으면 그 이름, 아니면 고른 항목 이름. 수정 모드에서 항목을 안
   * 바꿨으면 원래 줄 이름을 그대로 둔다(업체 이름으로 넣은 줄이 업종 이름으로 바뀌지 않게).
   */
  const label =
    editing && original && picked === initialCategory
      ? original.label
      : vendorName?.trim() || (picked ? VENDOR_CATEGORY_LABEL[picked] : '');
  const dirty = amountText !== initialAmountText || picked !== initialCategory;

  const reason =
    label.length === 0 ? '항목을 골라주세요' : !(amount > 0) ? '낸 금액을 숫자로 적어주세요' : null;
  const ready = reason === null && !locked && (!editing || dirty);

  function closeSheet() {
    if (editing) {
      dismissToOrReplace(`/wedding/${id}/expenses/list`);
      return;
    }
    dismissToOrReplace('/wedding?tab=budget');
  }

  function requestClose() {
    if (saving || autoBusy) return;
    if (choosing) {
      closeSheet();
      return;
    }
    requestDirtySheetClose(dirty, closeSheet);
  }

  async function save(): Promise<boolean> {
    if (editing && expenseId) {
      try {
        await updateExpense(id, expenseId, { label, amount, category: picked });
        showResultToast(copy['expense.saved']);
        return true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : '바꾸지 못했어요. 다시 시도해주세요.');
        return false;
      }
    }

    const body: CreateExpenseRequest = {
      label,
      amount,
      status: 'paid',
      spentOn: todayDay(),
      ...(picked ? { category: picked } : {}),
    };

    try {
      await addExpense(id, body);
      showResultToast('지출을 추가했어요');
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '넣지 못했어요. 다시 시도해주세요.');
      return false;
    }
  }

  /** 총예산을 넘기면 남은 예산 안내 문구, 아니면 null. 이 줄의 원래 금액은 빼고 센다. */
  function overBudgetMessage(): string | null {
    if (!limit) return null;
    const paid = !editing || original?.status === 'paid';
    const verdict = manualExpenseOverBudget({
      budget: limit.budget,
      spent: limit.spent,
      before: editing && original?.status === 'paid' ? original.amount : 0,
      after: paid ? amount : 0,
    });
    return verdict.over ? copy['expense.overBudget'].replace('{remaining}', manwon(verdict.remaining)) : null;
  }

  async function saveOnly() {
    if (!ready || saving) return;
    const overMessage = overBudgetMessage();
    if (overMessage) {
      showOsToast(overMessage, setToast);
      return;
    }
    setSaving(true);
    setError(null);
    const ok = await save();
    setSaving(false);
    if (ok) closeSheet();
  }

  function requestDelete() {
    if (!expenseId || !original || locked || saving) return;
    confirmDeleteExpense({
      weddingId: id,
      expense: original,
      onStart: () => {
        setSaving(true);
        setError(null);
      },
      onDeleted: () => {
        showResultToast(copy['expense.deleted']);
        closeSheet();
      },
      onError: setError,
      onSettled: () => setSaving(false),
    });
  }

  return (
    <View style={styles.host}>
      {editing ? <ExpenseListScreen /> : <WeddingScreen initialTab="budget" suppressBudgetPrompt />}

      <BottomSheet
        visible
        dismissible={!autoBusy}
        onRequestClose={requestClose}
        style={styles.sheetHost}
        testID={editing ? 'expense-edit-sheet' : 'expense-add-sheet'}>
        {choosing ? (
          <SheetPanel>
            <ExpenseAddChooser
              weddingId={id}
              onManual={() => setChoosing(false)}
              onClose={requestClose}
              onBusyChange={setAutoBusy}
            />
          </SheetPanel>
        ) : (
        <SheetPanel>
          <SheetHeader
            title={editing ? copy['expense.editTitle'] : copy['headerAdd.expense']}
            onClose={requestClose}
            closeDisabled={saving}
          />

          <ScrollView
            style={[styles.scroll, { maxHeight: Math.max(280, height * 0.58) }]}
            nestedScrollEnabled
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.fields}>
              <View style={styles.field}>
                <ThemedText type="f13" themeColor="textSecondary">
                  항목
                </ThemedText>
                <View style={styles.chips}>
                  {VENDOR_CATEGORIES.map((value) => (
                    <FilterChip
                      key={value}
                      label={VENDOR_CATEGORY_LABEL[value]}
                      selected={picked === value}
                      role="radio"
                      disabled={locked}
                      onPress={() => setPicked((current) => (current === value ? null : value))}
                    />
                  ))}
                </View>
              </View>
              <Field
                label="낸 금액"
                value={amountText}
                onChangeText={(text) => setAmountText(formatAmount(text))}
                editable={!locked}
                placeholder="예: 1,500,000"
                keyboardType="number-pad"
                maxLength={15}
                hint={amount > 0 ? manwon(amount) : null}
              />
            </View>

            {locked && original ? (
              <ThemedText type="t7" themeColor="textSecondary">
                {copy['expense.lockedSource'].replace('{source}', original.sourceLabel)}
              </ThemedText>
            ) : null}

            {error ? (
              <ThemedText type="t7" themeColor="negative">
                {error}
              </ThemedText>
            ) : null}
          </ScrollView>

          {dirty && reason ? (
            <ThemedText type="t7" themeColor="textSecondary">
              {reason}
            </ThemedText>
          ) : null}

          {/* 한 개(넣기)면 꽉 차고, 고칠 때(빼기 + 저장)는 정본 note.js sheetDock 1 : 1.4 · 사이 8 — 공용 CtaRow. */}
          <CtaRow gap={Spacing.two}>
            {/* «지출 넣고 인증하기»는 Pick 인증 촬영 삭제(2026-09-25)로 뺐다 — 남은 CTA가 Primary다. */}
            {editing ? (
              <ActionButton
                label={copy['expense.delete']}
                disabled={locked || saving}
                onPress={requestDelete}
              />
            ) : null}
            <ActionButton
              variant="primary"
              label={
                editing
                  ? saving
                    ? '저장하는 중…'
                    : copy['expense.save']
                  : saving
                    ? '넣는 중…'
                    : copy['expense.addCta']
              }
              disabled={!ready || saving}
              onPress={() => void saveOnly()}
            />
          </CtaRow>

          {/* iOS · 웹의 한도 토스트 — 시트(Modal) 위에 떠야 해서 시트 안에 둔다. 안드로이드는 시스템 토스트. */}
          <Toast message={toast} onHidden={() => setToast(null)} />
        </SheetPanel>
        )}
      </BottomSheet>
    </View>
  );
}

/** 숫자만 남기고 세 자리마다 쉼표. 12자리까지. */
function formatAmount(text: string): string {
  return text
    .replace(/[^0-9]/g, '')
    .slice(0, 12)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  sheetHost: { flexShrink: 1 },
  scroll: { flexShrink: 1 },
  content: { paddingBottom: Spacing.two, gap: 12 },
  /* note.js `sheetForm` — 칸 사이 `gap:12px`, `fieldWrap` — 라벨과 칸 사이 `gap:6px`. */
  fields: { gap: 12 },
  field: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
