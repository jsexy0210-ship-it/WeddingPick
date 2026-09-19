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
import { ScrollView, StyleSheet, View } from 'react-native';

import { addExpense } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { requestDirtySheetClose } from '@/features/common/dirty-sheet-close';
import { dayToTimestamp, isDay, todayDay } from '@/features/wedding/expense-day';
import {
  CheckBox,
  Field,
  Hero,
  ListRow,
  NoteCard,
  Section,
} from '@/features/wedding/screen-kit';
import { ActionButton, FilterChip, Spacing, ThemedText } from '@weddingpick/ui';

import ExpensesScreen from './index';

const PROOF_KINDS = ['영수증', '문자', '앱 화면 1장'] as const;

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
    router.replace(`/wedding/${id}/expenses` as never);
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

    router.replace('/capture/payment/consent' as never);
  }

  return (
    <View style={styles.host}>
      <ExpensesScreen />

      <BottomSheet visible onRequestClose={requestClose} testID="expense-add-sheet">
        <SheetPanel>
          <View style={styles.sheetHead}>
            <ThemedText type="t4">지출 추가</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              지출 내역을 보면서 바로 추가할 수 있어요.
            </ThemedText>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Hero title="얼마를 내셨어요?" />

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

            <Section label="자료를 올리면 실 제보가 돼요">
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
          <ActionButton label="취소" disabled={saving !== null} onPress={requestClose} />
        </SheetPanel>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  sheetHead: { gap: Spacing.one },
  scroll: { flexShrink: 1 },
  content: { paddingBottom: Spacing.two, gap: Spacing.three },
  fields: { gap: Spacing.three },
  field: { gap: Spacing.one + Spacing.half },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
});
