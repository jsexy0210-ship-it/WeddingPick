import type { Taste } from '@weddingpick/api-contract';
import {
  BUDGET_BRACKET_LABEL,
  MINIMUM_AGE,
  WEDDING_BUDGET_BRACKETS,
  WEDDING_DATE_HINT,
  dDay,
  formatWeddingDate,
  type WeddingBudgetBracket,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  completeSetup,
  completeSignup,
  getCurrentUser,
  getSignupState,
  listVendorRegions,
  updateTaste,
} from '@/api/client';
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
import { TASTE_LABEL } from '@/features/home/taste';
import { TastePicker } from '@/features/home/taste-picker';
import { OnboardingProgress } from '@/features/onboarding/progress';
import { saveWeddingDraft } from '@/features/onboarding/wedding-draft';

/** 한 화면에 하나씩 묻는다. 디자인 핸드오프 WP-APP-008~012. */
const STEPS = 4;

/**
 * 온보딩. 디자인 핸드오프 01-onboarding.dc.html #11d·#11e(WP-APP-008~012).
 * 문구는 `spec/strings.ko.json` `onboarding.*`의 확정 카피다.
 *
 * 받는 것은 **예식일 · 지역 · 총예산 · 분위기** 넷이다. 이름은 받지 않는다 —
 * v3.10이 닉네임을 최초 필수입력에서 뺐다.
 *
 * **한 화면에 하나씩 묻는다.** 넷을 한 장에 몰아넣으면 첫 화면이 설문지처럼 보이고,
 * 그때 사람들은 답을 고르는 대신 창을 닫는다. 남은 단계를 위에 표시하는 이유도
 * 같다 — 끝이 보이지 않는 질문은 두 번째에서 끊긴다.
 *
 * 2026-09-04 정책 변경(비회원 진입 삭제)으로 이 화면은 **로그인 뒤**에 온다.
 * 그래도 기기에 적어두는 경로를 남겨둔다 — 토큰이 없는 상태로 여기에 닿으면
 * 값을 잃는 대신 적어두고 다음 로그인에 올린다.
 *
 * 예산은 금액이 아니라 **구간**이다(#11e). 숫자를 직접 적게 하면 0을 여덟 개
 * 세는 화면이 되고, 시안이 정한 다섯 구간 밖의 값이 생긴다. 서버가 구간에서
 * 추천용 상한값을 파생한다 — 앱은 구간만 보낸다.
 *
 * 시안과 다른 값 두 곳, 이유가 있다.
 * - CTA·입력칸 높이는 시안의 56이 아니라 토큰 `size.ctaPrimary`·`size.field`의
 *   52다. `spec/tokens.json`이 시안보다 우선한다.
 * - 예산 제목의 «어느 정도»는 §3 금지어라 «얼마나»로 적는다(lint-copy).
 */
export default function SetupScreen() {
  const theme = useTheme();

  const [step, setStep] = useState(1);
  const [date, setDate] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [regions, setRegions] = useState<string[] | null>(isServerConfigured ? null : []);
  /** 다섯 구간 중 하나. `아직 모르겠어요`도 고른 것이다 — 안 고른 것(null)과 다르다. */
  const [bracket, setBracket] = useState<WeddingBudgetBracket | null>(null);
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

  const birthOk = !askBirth || /^\d{4}-\d{2}-\d{2}$/.test(birth);
  /** 이 단계를 넘어갈 수 있는가. 예산은 `아직 모르겠어요`가 있어 비워둘 이유가 없다. */
  const canAdvance =
    step === 1
      ? date !== null && birthOk
      : step === 2
        ? region !== null
        : step === 3
          ? bracket !== null
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
      const draft = { weddingDate: date, region, budgetBracket: bracket };

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
          <ScrollView contentContainerStyle={styles.doneContent}>
            <View style={[styles.doneMark, { backgroundColor: theme.tint }]}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path
                  d="m5 12.5 4.5 4.5L19 7.5"
                  stroke={theme.onTint}
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>

            <ThemedView style={styles.headline}>
              <ThemedText type="t2">준비 끝났어요</ThemedText>
              <ThemedText type="t2">{name ? `${name}님 웨딩을 시작해요` : '웨딩을 시작해요'}</ThemedText>
            </ThemedView>

            <ThemedView style={[styles.summary, { backgroundColor: theme.backgroundElement }]}>
              <SummaryRow label="예식일" value={formatWeddingDate(date ?? '')} />
              <SummaryRow label="지역" value={region ?? ''} />
              <SummaryRow label="총예산" value={BUDGET_BRACKET_LABEL[bracket ?? 'unknown']} />
              <SummaryRow
                label="취향"
                value={
                  tastes.length === 0
                    ? '고르지 않았어요'
                    : tastes.map((taste) => TASTE_LABEL[taste]).join(' · ')
                }
              />
            </ThemedView>
          </ScrollView>

          <ThemedView style={styles.footer}>
            <ActionButton
              variant="primary"
              size="xlarge"
              label="홈으로 가기"
              onPress={() => router.replace('/')}
            />
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <OnboardingProgress
          step={step}
          total={STEPS}
          onBack={step > 1 ? () => setStep(step - 1) : undefined}
        />

        <ScrollView contentContainerStyle={styles.content}>
          {step === 1 ? (
            <>
              <ThemedView style={styles.headline}>
                <ThemedText type="t2">예식일이 언제인가요?</ThemedText>
                <ThemedText type="body" themeColor="textSecondary">
                  남은 기간에 맞춰 준비 순서를 잡아드려요
                </ThemedText>
              </ThemedView>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="예식일 선택"
                onPress={() => {
                  setPending(date);
                  setCalendarOpen(true);
                }}
                style={[
                  styles.field,
                  {
                    backgroundColor: theme.background,
                    borderColor: date ? theme.tint : theme.track,
                  },
                ]}>
                <ThemedText
                  type="t5"
                  numeric
                  themeColor={date ? 'text' : 'textAssistive'}
                  style={date ? undefined : styles.regular}>
                  {date ? formatWeddingDate(date) : '예식일을 선택해주세요'}
                </ThemedText>
              </Pressable>

              {askBirth ? (
                <ThemedView style={styles.labeled}>
                  <ThemedText type="t6">생년월일</ThemedText>
                  <TextInput
                    value={birth}
                    onChangeText={(text) => setBirth(text.replace(/[^0-9-]/g, '').slice(0, 10))}
                    placeholder="2000-01-01"
                    placeholderTextColor={theme.textAssistive}
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                    accessibilityLabel="생년월일"
                    style={[
                      styles.field,
                      {
                        color: theme.text,
                        backgroundColor: theme.background,
                        borderColor: birthOk && birth ? theme.tint : theme.track,
                      },
                    ]}
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
                <ThemedText type="body" themeColor="textSecondary">
                  그 지역의 확인된 정보로 맞춰드려요
                </ThemedText>
              </ThemedView>

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
                      role="radio"
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
                <ThemedText type="body" themeColor="textSecondary">
                  나중에 바꿀 수 있어요
                </ThemedText>
              </ThemedView>

              <ThemedView style={styles.list}>
                {WEDDING_BUDGET_BRACKETS.map((option) => (
                  <BudgetRow
                    key={option}
                    bracket={option}
                    selected={bracket === option}
                    onPress={() => setBracket(option)}
                  />
                ))}
              </ThemedView>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <ThemedView style={styles.headline}>
                <ThemedText type="t2">마음에 드는 분위기를</ThemedText>
                <ThemedText type="t2">골라주세요</ThemedText>
                <ThemedText type="body" themeColor="textSecondary">
                  고른 사진으로 추천을 맞춰드려요
                </ThemedText>
              </ThemedView>

              <TastePicker chosen={tastes} onToggle={toggleTaste} />
            </>
          ) : null}

          {error ? (
            <ThemedText type="t7" themeColor="negative">
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <ThemedView style={styles.footer}>
          <ActionButton
            variant="primary"
            size="xlarge"
            label={
              step < STEPS ? '다음' : sending ? '저장하는 중…' : `${tastes.length}개 고르고 시작하기`
            }
            disabled={!canAdvance || sending}
            onPress={() => (step < STEPS ? setStep(step + 1) : void finish())}
          />
          {step === STEPS ? (
            /* 취향은 건너뛸 수 있다. 못 고른 것은 MY에서 다시 고를 수 있다. */
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="건너뛰기"
              disabled={sending}
              onPress={() => void finish()}
              style={styles.skip}>
              <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
                건너뛰기
              </ThemedText>
            </Pressable>
          ) : null}
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

/**
 * 예산 구간 한 줄. #11e — 왼쪽 라벨, 오른쪽 24px 동그라미 표시, 아래 1px 구분선.
 *
 * `아직 모르겠어요`만 늘 옅다(textAssistive). 나머지는 고르면 굵어진다.
 */
function BudgetRow({
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
      onPress={onPress}>
      <View style={styles.row}>
        <ThemedText
          type="t5"
          themeColor={bracket === 'unknown' ? 'textAssistive' : 'text'}
          style={selected ? undefined : styles.regular}>
          {label}
        </ThemedText>
        <View
          style={[
            styles.mark,
            selected
              ? { backgroundColor: theme.tint }
              : { borderWidth: 1.5, borderColor: theme.track },
          ]}>
          {selected ? (
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="m5 12.5 4.5 4.5L19 7.5"
                stroke={theme.onTint}
                strokeWidth={3.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ) : null}
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
    </Pressable>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.summaryRow}>
      <ThemedText type="t6" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="t6" numeric numberOfLines={1} style={[styles.bold, styles.summaryValue]}>
        {value}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  /* 시안 #11d·#11e: padding 12 24 0 · 블록 사이 24. */
  content: {
    paddingTop: Layout.rowPaddingY,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  /* 제목과 서브카피 사이 8. */
  headline: { gap: Spacing.two },
  labeled: { gap: Spacing.two },

  /* 입력칸. 토큰 size.field 52 · radius.control 6 · 테두리 1.5. */
  field: {
    height: Layout.field,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  regular: { fontWeight: 400 },
  bold: { fontWeight: 700 },

  /* 칩 사이 8 — spacing.gapChip. */
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },

  /* 목록. 행 사이 2 · 행 최소 56 · 상하 12 · 아래 1px 선. */
  list: { gap: Spacing.half },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.rowMinHeight,
    paddingVertical: Layout.rowPaddingY,
  },
  mark: {
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1 },

  /* 하단 CTA. 아래 32 — 시안 padding 0 24 32. */
  footer: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
  },
  /* 터치 영역 44 안에 14/19 글자를 가운데 두면 CTA와의 간격이 시안의 12가 된다. */
  skip: { minHeight: Layout.touchTarget, alignItems: 'center', justifyContent: 'center' },

  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: Layout.gutter,
    gap: Spacing.two,
  },
  sheetActions: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end' },

  /* 완료 화면. 시안 #11e 셋째 — 상단 56(내비게이션 바 자리) · 블록 사이 28. */
  doneContent: {
    paddingTop: Layout.navBar,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.four,
    gap: Layout.sectionGap,
  },
  doneMark: {
    width: Spacing.six,
    height: Spacing.six,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 요약 카드. radius.card 10 · 안쪽 20 · 행 사이 2. */
  summary: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Spacing.half,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  summaryValue: { flexShrink: 1, textAlign: 'right' },
});
