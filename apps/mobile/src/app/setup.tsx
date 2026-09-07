import type { Taste } from '@weddingpick/api-contract';
import { MINIMUM_AGE, WEDDING_DATE_HINT, dDay, formatWeddingDate, manwon } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { completeSetup, completeSignup, getCurrentUser, getSignupState, listVendorRegions, updateTaste } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';
import {
  ActionButton,
  FilterChip,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  WeddingCalendar,
  useTheme,
} from '@weddingpick/ui';
import { TastePicker } from '@/features/home/taste-picker';
import { OnboardingProgress } from '@/features/onboarding/progress';
import { saveWeddingDraft } from '@/features/onboarding/wedding-draft';

/** 예산 입력은 만원 단위로 받는다. 0을 여덟 개 세는 화면을 만들지 않는다. */
const MANWON = 10_000;

/** 한 화면에 하나씩 묻는다. 디자인 핸드오프 WP-APP-008~012. */
const STEPS = 4;

/**
 * 온보딩. 디자인 핸드오프 WP-APP-008~012.
 *
 * 받는 것은 **예식일 · 지역 · 총예산 · 분위기** 넷이다. 이름은 받지 않는다 —
 * v3.10이 닉네임을 최초 필수입력에서 뺐다. 총예산은 선택이고 비워둘 수 있다.
 *
 * **한 화면에 하나씩 묻는다.** 넷을 한 장에 몰아넣으면 첫 화면이 설문지처럼 보이고,
 * 그때 사람들은 답을 고르는 대신 창을 닫는다. 남은 단계를 위에 표시하는 이유도
 * 같다 — 끝이 보이지 않는 질문은 두 번째에서 끊긴다.
 *
 * 2026-09-04 정책 변경(비회원 진입 삭제)으로 이 화면은 **로그인 뒤**에 온다.
 * 그래도 기기에 적어두는 경로를 남겨둔다 — 토큰이 없는 상태로 여기에 닿으면
 * 값을 잃는 대신 적어두고 다음 로그인에 올린다.
 *
 * 예산을 구간이 아니라 금액으로 받는 이유: 계약의 `budgetAmount`가 단일 정수다
 * (`packages/api-contract/src/weddings.ts`). 구간을 숫자로 바꿔 저장하면 사용자가
 * 말한 적 없는 금액을 만들어내게 되고, 그 값이 나중에 화면에 그대로 나온다.
 */
export default function SetupScreen() {
  const theme = useTheme();

  const [step, setStep] = useState(1);
  const [date, setDate] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [regions, setRegions] = useState<string[] | null>(isServerConfigured ? null : []);
  /** 예산 입력 칸. 빈 칸은 "안 적음"이고, 그것은 `아직 모르겠어요`와 같은 뜻이다. */
  const [budget, setBudget] = useState('');
  const [tastes, setTastes] = useState<Taste[]>([]);
  const [name, setName] = useState<string | null>(null);
  /**
   * 가입이 아직 안 끝난 계정인가, 그리고 생년월일을 물어야 하는가.
   *
   * 별도의 «가입 마무리» 화면을 두지 않는다. 동의는 로그인 CTA의 안내로 받고,
   * 연령 확인은 여기 1/4에서 함께 한다 — 정책 v3.13 §N이 요구하는 두 가지를
   * 화면을 늘리지 않고 채운다. 소셜 제공자가 생년월일을 확인해 줬으면 묻지 않는다.
   */
  const [needsSignup, setNeedsSignup] = useState(false);
  const [askBirth, setAskBirth] = useState(false);
  const [birth, setBirth] = useState('');

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isServerConfigured) return;

    void getSignupState()
      .then((state) => {
        setNeedsSignup(!state.activated);
        setAskBirth(!state.activated && !state.birthDateVerified);
      })
      .catch(() => undefined);

    /*
     * 지역 목록은 업체가 실제로 있는 시도만 내려온다. 업체가 아직 없거나 API가
     * 닿지 않으면 빈 목록으로 두고 화면이 그 사실을 말한다.
     */
    void listVendorRegions()
      .then((response) => setRegions(response.regions.map((item) => item.name)))
      .catch(() => setRegions([]));
  }, []);

  const budgetAmount = budget.trim() === '' ? null : Number(budget.replace(/,/g, '')) * MANWON;
  const budgetValid = budgetAmount === null || (Number.isInteger(budgetAmount) && budgetAmount > 0);

  /** 이 단계를 넘어갈 수 있는가. 예산은 비워도 넘어간다 — 정책이 선택이라고 정했다. */
  const birthOk = !askBirth || /^\d{4}-\d{2}-\d{2}$/.test(birth);
  const canAdvance =
    step === 1
      ? date !== null && birthOk
      : step === 2
        ? region !== null
        : step === 3
          ? budgetValid
          : tastes.length > 0;

  function toggleTaste(taste: Taste) {
    setTastes((current) =>
      current.includes(taste) ? current.filter((one) => one !== taste) : [...current, taste]
    );
  }

  async function finish() {
    if (sending || date === null || region === null) return;

    setSending(true);
    setError(null);

    try {
      const draft = { weddingDate: date, region, budgetAmount };

      if (isServerConfigured && (await loadToken())) {
        /*
         * 가입을 먼저 끝낸다. 서버는 살아 있지 않은 계정의 다른 경로를 전부 막으므로
         * 순서를 바꾸면 예식일 저장이 거절된다. 필수 동의 두 가지는 로그인 CTA의
         * 안내로 이미 받았고, 여기서 서버에 기록한다.
         */
        if (needsSignup) {
          await completeSignup({
            birthDate: askBirth ? birth : undefined,
            consents: ['terms', 'privacy'],
          });
        }
        await completeSetup(draft);
        /*
         * 취향은 실패해도 온보딩을 되돌리지 않는다. 예식일과 지역이 올라갔는데
         * 취향 한 번 못 보냈다고 처음부터 다시 시키면 사용자는 같은 답을 네 번
         * 더 하게 된다. 못 보낸 것은 MY에서 다시 고를 수 있다.
         */
        await updateTaste(tastes).catch(() => undefined);
        await getCurrentUser()
          .then((me) => setName(me.displayName ?? null))
          .catch(() => undefined);
      } else {
        await saveWeddingDraft(draft);
      }

      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedView style={[styles.doneMark, { backgroundColor: theme.tint }]} />

            <ThemedView style={styles.headline}>
              <ThemedText type="t2">준비 끝났어요</ThemedText>
              <ThemedText type="t2">{name ? `${name}님 웨딩을 시작해요` : '웨딩을 시작해요'}</ThemedText>
            </ThemedView>

            <ThemedView style={styles.summary}>
              <SummaryRow label="예식일" value={formatWeddingDate(date ?? '')} />
              <SummaryRow label="지역" value={region ?? ''} />
              <SummaryRow
                label="총예산"
                value={budgetAmount === null ? '아직 모르겠어요' : manwon(budgetAmount)}
              />
              <SummaryRow label="분위기" value={`${tastes.length}개 골랐어요`} />
            </ThemedView>
          </ScrollView>

          <ThemedView style={styles.footer}>
            <ActionButton variant="primary" label="홈으로 가기" onPress={() => router.replace('/')} />
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.navBar}>
          <OnboardingProgress step={step} total={STEPS} />
        </ThemedView>

        <ScrollView contentContainerStyle={styles.content}>
          {step === 1 ? (
            <>
              <ThemedView style={styles.headline}>
                <ThemedText type="t2">예식일이 언제인가요?</ThemedText>
              </ThemedView>
              <ThemedText type="t6" themeColor="textSecondary">
                남은 기간에 맞춰 준비 순서를 잡아드려요
              </ThemedText>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="예식일 선택"
                onPress={() => {
                  setPending(date);
                  setCalendarOpen(true);
                }}>
                <ThemedView style={[styles.dateCard, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="t6" themeColor={date ? 'text' : 'textAssistive'}>
                    {date ? formatWeddingDate(date) : '예식일을 선택해주세요'}
                  </ThemedText>
                </ThemedView>
              </Pressable>

              {date ? (
                <ThemedText type="t7" themeColor="tint">
                  {dDay(date).text}
                </ThemedText>
              ) : null}

              {askBirth ? (
                <ThemedView style={styles.field}>
                  <ThemedText type="t6">생년월일</ThemedText>
                  <TextInput
                    value={birth}
                    onChangeText={(text) => setBirth(text.replace(/[^0-9-]/g, '').slice(0, 10))}
                    placeholder="2000-01-01"
                    placeholderTextColor={theme.textAssistive}
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                    accessibilityLabel="생년월일"
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                  />
                  <ThemedText type="t7" themeColor="textAssistive">
                    {`만 ${MINIMUM_AGE}세부터 이용할 수 있어요. 나이를 확인하는 데만 써요`}
                  </ThemedText>
                </ThemedView>
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <ThemedView style={styles.headline}>
                <ThemedText type="t2">어디에서 하시나요?</ThemedText>
              </ThemedView>
              <ThemedText type="t6" themeColor="textSecondary">
                그 지역의 확인된 정보로 맞춰드려요
              </ThemedText>

              {regions === null ? (
                <ThemedText type="t7" themeColor="textAssistive">
                  지역을 불러오는 중이에요
                </ThemedText>
              ) : regions.length === 0 ? (
                <ThemedText type="t7" themeColor="textAssistive">
                  지금은 지역을 불러올 수 없어요
                </ThemedText>
              ) : (
                <ThemedView style={styles.chips}>
                  {regions.map((item) => (
                    <FilterChip
                      key={item}
                      label={item}
                      selected={region === item}
                      onPress={() => setRegion(region === item ? null : item)}
                    />
                  ))}
                </ThemedView>
              )}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <ThemedView style={styles.headline}>
                <ThemedText type="t2">예산은 얼마나</ThemedText>
                <ThemedText type="t2">생각하고 계세요?</ThemedText>
              </ThemedView>
              <ThemedText type="t6" themeColor="textSecondary">
                나중에 바꿀 수 있어요
              </ThemedText>

              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                value={budget}
                onChangeText={(text) =>
                  setBudget(
                    text.replace(/[^0-9]/g, '').slice(0, 9).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                  )
                }
                keyboardType="number-pad"
                placeholder="예: 5000"
                placeholderTextColor={theme.textAssistive}
                accessibilityLabel="총예산 만원"
                maxLength={11}
              />
              <ThemedText type="t7" themeColor={budgetValid ? 'textAssistive' : 'negative'}>
                {budgetAmount === null
                  ? '만원 단위로 적어요. 아직 모르겠으면 비워둬도 돼요'
                  : budgetValid
                    ? manwon(budgetAmount)
                    : '1만원부터 적을 수 있어요. 아직 모르겠으면 비워둬도 돼요'}
              </ThemedText>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <ThemedView style={styles.headline}>
                <ThemedText type="t2">마음에 드는 분위기를</ThemedText>
                <ThemedText type="t2">골라주세요</ThemedText>
              </ThemedView>
              <ThemedText type="t6" themeColor="textSecondary">
                고른 사진으로 추천을 맞춰드려요
              </ThemedText>

              <TastePicker chosen={tastes} onToggle={toggleTaste} />
            </>
          ) : null}

          <ThemedText type="t7" themeColor="textAssistive">
            입력한 정보는 언제든 설정에서 바꿀 수 있어요
          </ThemedText>

          {error ? (
            <ThemedText type="t7" themeColor="negative">
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <ThemedView style={styles.footer}>
          <ActionButton
            variant="primary"
            label={
              step < STEPS ? '다음' : sending ? '저장하는 중…' : `${tastes.length}개 고르고 시작하기`
            }
            disabled={!canAdvance || sending}
            onPress={() => (step < STEPS ? setStep(step + 1) : void finish())}
          />
        </ThemedView>
      </SafeAreaView>

      <Modal visible={calendarOpen} transparent animationType="slide">
        <ThemedView style={[styles.scrim, { backgroundColor: theme.scrim }]}>
          <ThemedView style={styles.sheet}>
            <ThemedText type="t4">예식일 선택</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {pending ? dDay(pending).text : WEDDING_DATE_HINT}
            </ThemedText>

            <WeddingCalendar value={pending} onChange={setPending} />

            <ThemedView style={styles.sheetActions}>
              <ActionButton label="취소" onPress={() => setCalendarOpen(false)} />
              <ActionButton
                variant="primary"
                label="선택 완료"
                disabled={pending === null}
                onPress={() => {
                  setDate(pending);
                  setCalendarOpen(false);
                }}
              />
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.summaryRow}>
      <ThemedText type="t7" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="t6">{value}</ThemedText>
    </ThemedView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  navBar: { height: Layout.navBar },
  content: { paddingHorizontal: Layout.gutter, gap: Spacing.three, paddingBottom: Spacing.four },
  headline: { gap: 0 },
  field: { gap: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  input: {
    height: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
  },
  dateCard: {
    height: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  footer: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: Layout.gutter,
    gap: Spacing.two,
  },
  sheetActions: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end' },

  /* 완료 화면. 체크 원 하나로 끝났다는 것만 말하고 축하 장식은 두지 않는다. */
  doneMark: { width: 48, height: 48, borderRadius: Radius.pill },
  summary: { gap: Spacing.three },
  summaryRow: { gap: Spacing.one },
});
