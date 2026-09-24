import type { CreateExpenseRequest } from '@weddingpick/api-contract';
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  formatDateDot,
  manwon,
  type VendorCategory,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { addExpense } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { requestDirtySheetClose } from '@/features/common/dirty-sheet-close';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { dayToTimestamp, isDay, todayDay } from '@/features/wedding/expense-day';
import {
  CheckBox,
  Field,
  ListRow,
  NoteCard,
  Section,
} from '@/features/wedding/screen-kit';
import { ActionButton, FilterChip, ProductSymbol, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import WeddingScreen from '../../index';

const PROOF_KINDS = ['영수증', '문자', '앱 화면 1장'] as const;

/**
 * `DESIGN_UNRESOLVED` — 정본(WP-NOTE-007)은 항목/예산/낸 금액을 한 화면에 묻고 사진을
 * 올리면 필드가 바로 채워지는 모델이다. 이 화면은 complete-view.tsx가
 * 같이 쓰는 «지출 하나 기록하기» 화면이라(업체 · 금액 · 낸 날짜 · 항목 카테고리) 정본과
 * 데이터 모델이 다르다 — 정본대로 필드를 바꾸면 그 두 화면의 흐름이 깨진다. 사진→필드
 * 자동 채움도 실제로 동기적으로 값을 돌려주는 서버 경로가 없어(Pick 인증은 별도 여러
 * 단계 플로우) 「채워져요」라고 적어 놓고 안 채우는 거짓 UI를 만들지 않았다. 헤더 ·
 * 카피 정리만 이번에 반영하고, 필드 모델 통합은 대표님 확인 뒤 별도 세션에서 판단한다.
 */

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
  const initialDay = todayDay();

  const [label, setLabel] = useState(vendorName ?? '');
  const [amountText, setAmountText] = useState('');
  const [day, setDay] = useState(initialDay);
  const [picked, setPicked] = useState<VendorCategory | null>(initialCategory);
  const [saving, setSaving] = useState<'expense' | 'proof' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(amountText.replace(/[^\d]/g, ''));
  const dayValid = isDay(day) && dayToTimestamp(day) !== null;
  const dirty =
    label !== (vendorName ?? '') ||
    amountText.length > 0 ||
    day !== initialDay ||
    picked !== initialCategory;

  const reason =
    label.trim().length === 0
      ? '업체 이름을 적어주세요'
      : !(amount > 0)
        ? '금액을 숫자로 적어주세요'
        : !dayValid
          ? '낸 날짜를 2027-05-16 형태로 적어주세요'
          : null;
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
      label: label.trim(),
      amount,
      status: 'paid',
      spentOn: day,
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
            <ThemedText type="t4">지출 추가</ThemedText>
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
              <Field
                label="업체"
                value={label}
                onChangeText={setLabel}
                placeholder="업체 이름"
                maxLength={60}
                returnKeyType="next"
              />
              <Field
                label="금액"
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
              <Field
                label="낸 날짜"
                value={day}
                onChangeText={setDay}
                placeholder={todayDay()}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                hint={dayValid ? formatDateDot(day) : '2027-05-16 형태로 적어주세요'}
                hintColor={dayValid ? 'textAssistive' : 'negative'}
              />
              <View style={styles.field}>
                <ThemedText type="t7" themeColor="textSecondary">
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
            </View>

            <Section label="자료를 올리면 실 제보가 돼요" style={styles.sheetSection}>
              {PROOF_KINDS.map((kind) => (
                <ListRow key={kind} left={<CheckBox checked />} title={kind} />
              ))}
            </Section>

            <NoteCard
              title="원본은 24시간 안에 지워요"
              body="확인이 끝나면 금액과 업체만 남기고 자료는 삭제해요."
            />

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
  content: { paddingBottom: Spacing.two, gap: Spacing.three },
  fields: { gap: Spacing.three },
  field: { gap: Spacing.one + Spacing.half },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
  sheetSection: { paddingHorizontal: 0 },
});
