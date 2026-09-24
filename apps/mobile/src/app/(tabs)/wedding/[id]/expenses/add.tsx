import type { CreateExpenseRequest } from '@weddingpick/api-contract';
import { VENDOR_CATEGORIES, VENDOR_CATEGORY_LABEL, manwon, type VendorCategory } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { addExpense } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { requestDirtySheetClose } from '@/features/common/dirty-sheet-close';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { todayDay } from '@/features/wedding/expense-day';
import { Field } from '@/features/wedding/screen-kit';
import { ActionButton, FilterChip, ProductSymbol, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import WeddingScreen from '../../index';

/**
 * 예산 추가 시트 — WP-NOTE-007 · `docs/design/React_Native/note.jsx` frame-006.
 *
 *   formHead  타이틀 «예산 추가» + 우측 36px 회색 원형 X
 *   칸        정본 `budgetFields` 순서대로 항목 · 예산 · 낸 금액 셋을 그린다. 서버가 받는 것
 *             (`createExpenseRequest`)은 항목(업종 → 줄 이름) · 낸 금액뿐이라 그 둘만 보내고,
 *             날짜는 오늘로 넣는다.
 *
 * 정본에 없는 «업체» · «낸 날짜» 칸, «자료를 올리면 실 제보가 돼요» 목록과 «원본은 24시간
 * 안에 지워요» 안내는 지웠다. `DESIGN_UNRESOLVED`로 남긴 것:
 *   - «예산» 칸 — 항목별 예산을 담을 서버 값이 없다(buckets에 budget 없음). 칸은 그리되
 *     `BUDGET_BACKEND_PENDING` 동안 잠가 둔다(2026-09-25 대표 결정). 서버가 붙으면 이 스위치와
 *     잠금을 함께 걷는다
 *   - «사진으로 채우기» 칸과 «읽었어요 · 확인 필요» 딱지 — 사진을 읽어 바로 돌려주는
 *     서버 경로가 없다(Pick 인증은 여러 단계 흐름). 채워 준다고 적고 안 채우는 칸을 만들지 않는다
 *   - 아래 두 단추 «직접입력 · 자동입력» — 자동입력이 위 사진 칸과 한 기능이라 함께 미뤘다.
 *     지금은 «지출만 넣기 · 지출 넣고 인증하기»(Pick 인증 흐름으로)를 그대로 둔다
 */

/** 항목별 예산 저장 경로가 서버에 없다 — 붙으면 false로 바꾸고 `save()`에 예산을 싣는다. */
const BUDGET_BACKEND_PENDING = true;

function isVendorCategory(value: string | undefined): value is VendorCategory {
  return value !== undefined && (VENDOR_CATEGORIES as readonly string[]).includes(value);
}

/**
 * /expenses/add 딥링크는 부모 지출 화면 + DLG-D 입력 시트로 연결한다.
 */
export default function AddExpenseRoute() {
  const { id, vendorName, category } = useLocalSearchParams<{
    id: string;
    vendorName?: string;
    category?: string;
  }>();

  const { height } = useWindowDimensions();
  const theme = useTheme();
  const initialCategory = isVendorCategory(category) ? category : null;

  const [amountText, setAmountText] = useState('');
  const [picked, setPicked] = useState<VendorCategory | null>(initialCategory);
  const [saving, setSaving] = useState<'expense' | 'proof' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(amountText.replace(/[^\d]/g, ''));
  /* 줄 이름 — 업체에서 들어왔으면 그 이름, 아니면 고른 항목 이름. */
  const label = vendorName?.trim() || (picked ? VENDOR_CATEGORY_LABEL[picked] : '');
  const dirty = amountText.length > 0 || picked !== initialCategory;

  const reason =
    label.length === 0 ? '항목을 골라주세요' : !(amount > 0) ? '낸 금액을 숫자로 적어주세요' : null;
  const ready = reason === null;

  function closeSheet() {
    dismissToOrReplace('/wedding?tab=budget');
  }

  function requestClose() {
    if (saving) return;
    requestDirtySheetClose(dirty, closeSheet);
  }

  async function save(): Promise<boolean> {
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

  async function saveOnly() {
    if (!ready || saving) return;
    setSaving('expense');
    setError(null);
    const ok = await save();
    setSaving(null);
    if (ok) closeSheet();
  }

  async function saveAndVerify() {
    if (!ready || saving) return;
    setSaving('proof');
    setError(null);
    const ok = await save();
    setSaving(null);
    if (!ok) return;

    router.replace('/capture/payment/consent?from=budget' as never);
  }

  return (
    <View style={styles.host}>
      <WeddingScreen initialTab="budget" suppressBudgetPrompt />

      <BottomSheet visible onRequestClose={requestClose} style={styles.sheetHost} testID="expense-add-sheet">
        <SheetPanel>
          <View style={styles.sheetHead}>
            <ThemedText type="t4">예산 추가</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={requestClose}
              hitSlop={4}
              style={({ pressed }) => [
                styles.formClose,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ProductSymbol name="close" size={16} color={theme.text} />
            </Pressable>
          </View>

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
                      onPress={() => setPicked((current) => (current === value ? null : value))}
                    />
                  ))}
                </View>
              </View>
              <Field
                label="예산"
                value=""
                placeholder="예: 4,000,000"
                keyboardType="number-pad"
                editable={!BUDGET_BACKEND_PENDING}
                testID="expense-add-budget"
              />
              <Field
                label="낸 금액"
                value={amountText}
                onChangeText={(text) =>
                  setAmountText(
                    text
                      .replace(/[^0-9]/g, '')
                      .slice(0, 12)
                      .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                  )
                }
                placeholder="예: 1,500,000"
                keyboardType="number-pad"
                maxLength={15}
                hint={amount > 0 ? manwon(amount) : null}
              />
            </View>

            {error ? (
              <ThemedText type="t7" themeColor="negative">
                {error}
              </ThemedText>
            ) : null}
          </ScrollView>

          {!ready && dirty && reason ? (
            <ThemedText type="t7" themeColor="textSecondary">
              {reason}
            </ThemedText>
          ) : null}

          <View style={styles.actions}>
            <ActionButton
              label={saving === 'expense' ? '넣는 중…' : '지출만 넣기'}
              disabled={!ready || saving !== null}
              onPress={() => void saveOnly()}
            />
            <ActionButton
              variant="primary"
              label={saving === 'proof' ? '넣는 중…' : '지출 넣고 인증하기'}
              disabled={!ready || saving !== null}
              onPress={() => void saveAndVerify()}
            />
          </View>
        </SheetPanel>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  sheetHost: { flexShrink: 1 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  formClose: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  scroll: { flexShrink: 1 },
  content: { paddingBottom: Spacing.two, gap: 12 },
  /* note.js `sheetForm` — 칸 사이 `gap:12px`, `fieldWrap` — 라벨과 칸 사이 `gap:6px`. */
  fields: { gap: 12 },
  field: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
});
