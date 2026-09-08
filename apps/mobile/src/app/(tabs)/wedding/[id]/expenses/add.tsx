import type { CreateExpenseRequest } from '@weddingpick/api-contract';
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  formatDateDot,
  type VendorCategory,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addExpense } from '@/api/client';
import { BackButton } from '@/components/back-button';
import { dayToTimestamp, isDay, todayDay } from '@/features/wedding/expense-day';
import {
  ActionButton,
  FilterChip,
  Layout,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/** 실 제보가 되는 자료 3가지. 입력이 아니라 안내다 — 올리는 일은 다음 화면이 한다. */
const PROOF_KINDS = ['영수증', '문자', '앱 화면 1장'] as const;

/** 안내 행의 체크 원. 시안 `check` 20. */
const CHECK_SIZE = 20;

function isVendorCategory(value: string | undefined): value is VendorCategory {
  return value !== undefined && (VENDOR_CATEGORIES as readonly string[]).includes(value);
}

/**
 * 지출 추가 · Pick 인증 통합. WP-OUR-014(v3.22 SPEC 13.10).
 *
 * **지출 입력과 Pick 인증을 한 화면에서 처리한다.** 업체 · 금액 · 낸 날짜 · 항목을
 * 지출로 저장하고, 자료(영수증 · 문자 · 앱 화면)를 올리면 실 제보로도 반영된다.
 * 자료가 없어도 지출은 저장된다 — 인증을 강제하지 않는다. 두 흐름을 따로 두면
 * 사용자가 같은 일을 두 번 한다.
 *
 * 진입은 웨딩일정 지출과 최종 결정 직후(WP-PICK-006). 그때가 사용자가 금액을
 * 기억하고 있는 유일한 때라, `vendorName` · `category`를 파라미터로 받아 미리 채운다.
 *
 *   dock 좌  지출만 넣기        아웃라인 → 저장 후 지출내역으로
 *   dock 우  지출 넣고 인증하기  coral   → 저장 후 결제인증 등록으로(값을 넘겨 채운다)
 */
export default function AddExpenseScreen() {
  const { id, vendorName, category } = useLocalSearchParams<{
    id: string;
    vendorName?: string;
    category?: string;
  }>();
  const theme = useTheme();

  const [label, setLabel] = useState(vendorName ?? '');
  const [amountText, setAmountText] = useState('');
  const [day, setDay] = useState(() => todayDay());
  const [picked, setPicked] = useState<VendorCategory | null>(
    isVendorCategory(category) ? category : null
  );
  const [saving, setSaving] = useState<'expense' | 'proof' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(amountText.replace(/[^\d]/g, ''));
  const dayValid = isDay(day) && dayToTimestamp(day) !== null;

  const reason =
    label.trim().length === 0
      ? '업체 이름을 적어주세요'
      : !(amount > 0)
        ? '금액을 숫자로 적어주세요'
        : !dayValid
          ? '낸 날짜를 2027-05-16 형태로 적어주세요'
          : null;
  const ready = reason === null;

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

  /** 지출만 넣기 — 저장하고 지출내역으로 돌아간다. */
  async function saveOnly() {
    if (!ready || saving) return;

    setSaving('expense');
    setError(null);

    const ok = await save();

    setSaving(null);
    if (ok) router.back();
  }

  /**
   * 지출 넣고 인증하기 — 저장한 뒤 결제인증 등록으로 간다. 적은 값을 그대로 넘겨
   * 같은 것을 두 번 적지 않게 한다. `replace`라 인증 화면에서 돌아오면 지출내역이다.
   */
  async function saveAndVerify() {
    if (!ready || saving) return;

    setSaving('proof');
    setError(null);

    const ok = await save();

    setSaving(null);
    if (!ok) return;

    router.replace({
      pathname: '/capture/payment/register',
      params: {
        merchantName: label.trim(),
        paidAmount: String(amount),
        paidAt: dayToTimestamp(day) ?? day,
      },
    } as never);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* close nav — 흐름 밖으로 빠지는 자리라 «<» 대신 «✕». */}
        <View style={styles.nav}>
          <BackButton variant="close" fallback={`/wedding/${id}/expenses`} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ThemedText type="t2">얼마를 내셨어요?</ThemedText>

          {/* 필드 4 — 업체 · 금액 · 낸 날짜 · 항목 */}
          <View style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              업체
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              value={label}
              onChangeText={setLabel}
              placeholder="예: 스튜디오 이로"
              placeholderTextColor={theme.textAssistive}
              maxLength={60}
              returnKeyType="next"
              accessibilityLabel="업체"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              금액 (원)
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              value={amountText}
              onChangeText={(text) =>
                setAmountText(
                  text.replace(/[^0-9]/g, '').slice(0, 12).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                )
              }
              placeholder="예: 1,500,000"
              placeholderTextColor={theme.textAssistive}
              keyboardType="number-pad"
              maxLength={15}
              accessibilityLabel="금액"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              낸 날짜
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              value={day}
              onChangeText={setDay}
              placeholder={todayDay()}
              placeholderTextColor={theme.textAssistive}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              accessibilityLabel="낸 날짜"
            />
            {/* 표기는 전역 고정 `2027.05.16(토)` — 적은 값이 읽히는 대로 보여준다. */}
            <ThemedText type="t7" themeColor={dayValid ? 'textAssistive' : 'negative'} numeric>
              {dayValid ? formatDateDot(day) : '2027-05-16 형태로 적어주세요'}
            </ThemedText>
          </View>

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

          {/* 자료를 올리면 실 제보가 돼요 — 3행 체크. 입력이 아니라 안내다. */}
          <View style={[styles.proofCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="t5">자료를 올리면 실 제보가 돼요</ThemedText>
            <View style={styles.proofList}>
              {PROOF_KINDS.map((kind) => (
                <View key={kind} style={styles.proofRow}>
                  <View
                    style={[
                      styles.proofCheck,
                      { borderColor: theme.tint, backgroundColor: theme.tintSubtle },
                    ]}>
                    <ProductSymbol name="check" size={12} color={theme.tint} />
                  </View>
                  <ThemedText type="t6" themeColor="textSecondary">
                    {kind}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>

          {/* note — 원본 24시간 내 삭제. 이 화면에서도 적는다(SPEC 13.10). */}
          <View style={[styles.note, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="t7" themeColor="textSecondary">
              원본은 24시간 안에 지우고 금액과 업체만 남겨요
            </ThemedText>
          </View>

          {error ? (
            <ThemedText type="t7" themeColor="negative">
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        {/* dock — 좌 아웃라인 «지출만 넣기» · 우 coral «지출 넣고 인증하기». Primary는 하나다. */}
        <View style={[styles.dock, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          {!ready && (label.length > 0 || amountText.length > 0) ? (
            <ThemedText type="t7" themeColor="textAssistive">
              {reason}
            </ThemedText>
          ) : null}
          <View style={styles.dockRow}>
            <View style={styles.dockButton}>
              <ActionButton
                variant="ghost"
                size="xlarge"
                label={saving === 'expense' ? '넣는 중…' : '지출만 넣기'}
                disabled={!ready || saving !== null}
                onPress={() => void saveOnly()}
              />
            </View>
            <View style={styles.dockButton}>
              <ActionButton
                variant="primary"
                size="xlarge"
                label={saving === 'proof' ? '넣는 중…' : '지출 넣고 인증하기'}
                disabled={!ready || saving !== null}
                onPress={() => void saveAndVerify()}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  /* close nav — 56 · 좌우 24. */
  nav: {
    height: Layout.navBar,
    paddingHorizontal: Layout.gutter,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.two,
    paddingBottom: Layout.sectionGap,
    gap: Spacing.four,
  },
  field: { gap: Spacing.two },
  input: {
    height: Layout.field,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  /* 안내 카드 — radius 10 · padding 20 · 제목→행 14. */
  proofCard: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Layout.sectionHeadGap,
  },
  proofList: { gap: Spacing.two },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.rowPaddingY,
    minHeight: Layout.touchTarget,
  },
  proofCheck: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  note: {
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: Layout.rowPaddingY,
  },
  /* dock — 위 선 1 · 좌우 24 · 상하 12 · 버튼 사이 8. */
  dock: {
    borderTopWidth: 1,
    paddingHorizontal: Layout.gutter,
    paddingVertical: Layout.rowPaddingY,
    gap: Spacing.two,
  },
  dockRow: { flexDirection: 'row', gap: Spacing.two },
  dockButton: { flex: 1 },
});
