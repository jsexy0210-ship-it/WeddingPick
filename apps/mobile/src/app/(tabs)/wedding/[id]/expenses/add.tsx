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
import { dayToTimestamp, isDay, todayDay } from '@/features/wedding/expense-day';
import { FilterChip, Layout, Spacing, ThemedText } from '@weddingpick/ui';
import {
  CheckBox,
  Dock,
  DockButton,
  Field,
  Hero,
  ListRow,
  NavBar,
  NoteCard,
  Screen,
  Section,
} from '@/features/wedding/screen-kit';

/** 실 제보가 되는 자료 3가지. 입력이 아니라 안내다 — 올리는 일은 다음 화면이 한다. */
const PROOF_KINDS = ['영수증', '문자', '앱 화면 1장'] as const;

function isVendorCategory(value: string | undefined): value is VendorCategory {
  return value !== undefined && (VENDOR_CATEGORIES as readonly string[]).includes(value);
}

/**
 * 지출 추가 · Pick 인증 통합. WP-OUR-014(v3.22 SPEC 13.10).
 *
 *   close nav
 *   hero      «얼마를 내셨어요?»
 *   필드 4     업체 · 금액 · 낸 날짜 · 항목
 *   3행 체크   «자료를 올리면 실 제보가 돼요» — 영수증 · 문자 · 앱 화면 1장
 *   note      «원본은 24시간 안에 지워요»
 *   dock      «지출만 넣기»(아웃라인) + «지출 넣고 인증하기»(coral)
 *
 * **지출 입력과 Pick 인증을 한 화면에서 처리한다.** 자료가 없어도 지출은 저장된다 —
 * 인증을 강제하지 않는다. 진입은 웨딩일정 지출과 최종 결정 직후(WP-PICK-006). 그때가
 * 금액을 기억하는 유일한 때라 `vendorName` · `category`를 파라미터로 받아 미리 채운다.
 */
export default function AddExpenseScreen() {
  const { id, vendorName, category } = useLocalSearchParams<{
    id: string;
    vendorName?: string;
    category?: string;
  }>();

  const [label, setLabel] = useState(vendorName ?? '');
  const [amountText, setAmountText] = useState('');
  const [day, setDay] = useState(() => todayDay());
  const [picked, setPicked] = useState<VendorCategory | null>(isVendorCategory(category) ? category : null);
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

  /** 지출만 넣기 — 저장하고 돌아간다. */
  async function saveOnly() {
    if (!ready || saving) return;

    setSaving('expense');
    setError(null);

    const ok = await save();

    setSaving(null);
    if (!ok) return;

    /* 링크로 곧장 들어와 되돌아갈 곳이 없으면 지출 요약으로. */
    if (router.canGoBack()) router.back();
    else router.replace(`/wedding/${id}/expenses` as never);
  }

  /**
   * 지출 넣고 인증하기 — 저장한 뒤 Pick 인증 등록으로 간다. 적은 값을 그대로 넘겨
   * 같은 것을 두 번 적지 않게 한다. `replace`라 인증 화면에서 돌아오면 지출이다.
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
    <Screen>
      <NavBar title="지출 추가" variant="close" />

      <ScrollView
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
              setAmountText(text.replace(/[^0-9]/g, '').slice(0, 12).replace(/\B(?=(\d{3})+(?!\d))/g, ','))
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
            /* 표기는 전역 고정 `2027.05.16(토)` — 적은 값이 읽히는 대로 보여준다. */
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

        {/* 자료를 올리면 실 제보가 돼요 — 3행 체크. 입력이 아니라 안내다. */}
        <Section label="자료를 올리면 실 제보가 돼요">
          {PROOF_KINDS.map((kind) => (
            <ListRow key={kind} left={<CheckBox checked />} title={kind} />
          ))}
        </Section>

        {/* note — 원본 24시간 내 삭제. 이 화면에서도 적는다(SPEC 13.10). */}
        <View style={styles.noteWrap}>
          <NoteCard title="원본은 24시간 안에 지워요" body="확인이 끝나면 금액과 업체만 남기고 자료는 삭제해요." />
        </View>

        {error ? (
          <ThemedText type="t7" themeColor="negative" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>

      {/* dock — 좌 아웃라인 «지출만 넣기» · 우 coral «지출 넣고 인증하기». Primary는 하나다. */}
      <Dock note={!ready && (label.length > 0 || amountText.length > 0) ? reason : null}>
        <DockButton
          variant="ghost"
          label={saving === 'expense' ? '넣는 중…' : '지출만 넣기'}
          disabled={!ready || saving !== null}
          onPress={() => void saveOnly()}
        />
        <DockButton
          variant="primary"
          label={saving === 'proof' ? '넣는 중…' : '지출 넣고 인증하기'}
          disabled={!ready || saving !== null}
          onPress={() => void saveAndVerify()}
        />
      </Dock>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  fields: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four, gap: Spacing.three },
  field: { gap: Spacing.one + Spacing.half },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  noteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four },
  error: { paddingHorizontal: Layout.gutter },
});
