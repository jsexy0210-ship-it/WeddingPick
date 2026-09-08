import { combineRegion, dDay, formatDateDot, type VendorCategory } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';

import { ApiError, completeSetup, completeSignup, getSignupState, updateTaste } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';
import { Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { BudgetGrid } from '@/features/onboarding/budget-grid';
import { DatePickerSheet } from '@/features/onboarding/date-picker-sheet';
import {
  DONE_CTA,
  DONE_PROGRESS,
  DONE_TITLE_LINES,
  EMPTY_ANSWERS,
  NEXT_CTA,
  PREV_CTA,
  STEP_TITLE_LINES,
  UNDECIDED_LABEL,
  answeredRows,
  canAdvance,
  ddayParts,
  doneRows,
  nextStep,
  prevStep,
  resumeStep,
  stepDescription,
  stepProgress,
  stepsFor,
  tasteCategoryFor,
  tasteCta,
  type Answers,
  type QuestionStep,
} from '@/features/onboarding/flow';
import { OptionChip } from '@/features/onboarding/option-chip';
import { PrepStatus } from '@/features/onboarding/prep-status';
import { QuestionHead } from '@/features/onboarding/question-head';
import { RegionPicker } from '@/features/onboarding/region-picker';
import { StepFrame } from '@/features/onboarding/step-frame';
import { TasteGrid } from '@/features/onboarding/taste-grid';
import {
  clearOnboardingAnswers,
  clearWeddingDraft,
  loadOnboardingAnswers,
  saveOnboardingAnswers,
  saveWeddingDraft,
} from '@/features/onboarding/wedding-draft';

/**
 * 초기 설정. 디자인 핸드오프 v3.22 20-onboarding-v2.dc.html(WP-APP-020 ~ 023).
 *
 *   예식일 1/5 → 지역 2/5 → 준비 현황 3/5 → 예산 4/5 → 취향 5/5 → 완료
 *
 * **큰 질문 하나 = Step 하나.** 순서·건너뛰기·요약은 전부 `features/onboarding/flow.ts`
 * 가 정하고 이 화면은 그 답을 그린다. 답하면 그 질문은 화면 아래로 가라앉아 «라벨 ·
 * 값 · 바꾸기» 한 줄이 되고 새 질문이 위에서 내려온다(은행앱 방식 · v3.19).
 *
 * **상단 뒤로가기가 없다.** 첫 질문은 «다음»만, 두 번째부터 «이전 · 다음».
 * 안드로이드 물리 뒤로가기는 «이전»과 같고 첫 질문에서는 로그인으로 나간다.
 * «바꾸기»는 그 질문만 다시 열고 뒤의 답은 그대로 둔다 — 그 뒤 «다음»은 아직
 * 안 답한 질문으로 바로 간다.
 *
 * **미정을 억지로 받지 않는다.** 예식일 · 지역 «아직 정하지 않았어요», 준비 현황
 * «아직 시작 전이에요», 예산 «아직 모르겠어요». 취향만 최소 1장 필수다 — 추천의
 * 근거라 없으면 첫 화면에 보여줄 것이 없다. 취향은 준비 현황에서 남은 첫 업종
 * 하나만 묻고, 전부 준비했으면 5/5를 통째로 건너뛴다.
 *
 * **스크롤은 화면 전체 하나다**(SPEC §13.5.5). 준비 현황이 뷰포트를 넘치면 화면이
 * 스크롤한다 — 목록 전용 스크롤을 두지 않는다.
 *
 * **만 14세 확인은 여기 없다.** 로그인 화면(WP-AUTH-001)의 체크박스 하나로 끝난다 —
 * 이 화면에 닿았다는 것 자체가 확인을 마쳤다는 뜻이라 `completeSignup`에
 * `ageVerified: true`를 그대로 보낸다. 2026-09-04 정책(비회원 진입 삭제)으로 이
 * 화면은 로그인 뒤에 온다. 그래도 토큰이 없으면 기기에 적어두고 다음 로그인에
 * 올린다(`after-sign-in`).
 *
 * 답하는 중인 값은 기기에 적어둔다 — 앱을 닫았다 열어도 답한 데까지 이어서 묻는다.
 * 서버에 올리고 나면 지운다.
 *
 * 시안과 다른 값은 토큰이 이기는 곳뿐이다: CTA·셀렉트·입력칸 높이 52(size.ctaPrimary ·
 * size.field, 시안 56) · 15px 글자는 t6(16) · 13px은 t7(14).
 */
export default function SetupScreen() {
  const theme = useTheme();

  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [step, setStep] = useState<QuestionStep | 'done'>('date');
  /** 기기에 적어둔 답을 읽기 전에는 첫 질문을 그리지 않는다 — 잠깐 스쳤다 바뀌면 안 된다. */
  const [restored, setRestored] = useState(false);
  /** 가입이 아직 안 끝난 계정인가 — 그러면 답을 다 받은 뒤 가입부터 마친다. */
  const [needsSignup, setNeedsSignup] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadOnboardingAnswers().then((saved) => {
      if (saved) {
        setAnswers(saved);
        /* 전부 답했는데 못 보낸 상태면 마지막 질문을 다시 연다. */
        setStep(resumeStep(saved) ?? stepsFor(saved).at(-1) ?? 'date');
      }

      setRestored(true);
    });
  }, []);

  useEffect(() => {
    if (!isServerConfigured) return;

    void getSignupState()
      .then((state) => setNeedsSignup(!state.activated))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!restored || step === 'done') return;

    void saveOnboardingAnswers(answers).catch(() => undefined);
  }, [answers, restored, step]);

  function update(patch: Partial<Answers>) {
    setError(null);
    setAnswers((current) => ({ ...current, ...patch }));
  }

  const goPrev = useCallback(() => {
    if (step === 'done') return;

    const previous = prevStep(step, answers);

    setError(null);

    if (previous === null) {
      router.replace('/login');
    } else {
      setStep(previous);
    }
  }, [step, answers]);

  /* 안드로이드 물리 뒤로가기 = «이전». 완료 화면에서는 아무 데도 가지 않는다. */
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step !== 'done') goPrev();

      return true;
    });

    return () => subscription.remove();
  }, [step, goPrev]);

  async function finish() {
    if (sending) return;

    setSending(true);
    setError(null);

    const category = tasteCategoryFor(answers);
    const taste = category !== null && answers.taste?.category === category ? answers.taste : null;
    const region = answers.region?.region ?? null;
    const draft = {
      weddingDate: answers.date?.value ?? null,
      region: region === null ? null : combineRegion(region, answers.region?.district ?? null),
      preparedCategories: answers.prep?.categories ?? [],
      budgetBracket: answers.budget,
      taste,
    };

    try {
      if (isServerConfigured && (await loadToken())) {
        /*
         * 가입을 먼저 끝낸다. 서버는 살아 있지 않은 계정의 다른 경로를 전부 막으므로
         * 순서를 바꾸면 예식일 저장이 거절된다. 만 14세 확인은 로그인 화면에서 이미
         * 끝났고 필수 동의도 로그인 CTA의 안내로 이미 받았다 — 여기서 서버에 기록한다.
         */
        if (needsSignup) {
          await completeSignup({ ageVerified: true, consents: ['terms', 'privacy'] });
        }

        await completeSetup({
          weddingDate: draft.weddingDate,
          region: draft.region,
          /* «기타»는 준비 단계가 아니라 계약이 받지 않는다 — 화면에도 없는 값이지만 형을 좁힌다. */
          preparedCategories: draft.preparedCategories.filter(
            (category): category is Exclude<VendorCategory, 'etc'> => category !== 'etc'
          ),
          budgetBracket: draft.budgetBracket,
        });

        /*
         * 취향은 실패해도 온보딩을 되돌리지 않는다. 예식일과 지역이 올라갔는데
         * 취향 한 번 못 보냈다고 처음부터 다시 시키면 사용자는 같은 답을 여러 번
         * 더 하게 된다. 못 보낸 것은 MY에서 다시 고를 수 있다.
         */
        if (taste) {
          await updateTaste({ category: taste.category, keys: taste.keys }).catch(() => undefined);
        }

        await clearWeddingDraft();
      } else {
        await saveWeddingDraft(draft);
      }

      await clearOnboardingAnswers();
      setStep('done');
    } catch (caught) {
      // 세션이 끝났으면(401) 이 화면에 머물 이유가 없다 — 로그인으로 보낸다.
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login');
        return;
      }
      setError(caught instanceof Error ? caught.message : '저장하지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  function goNext() {
    if (step === 'done') return;

    const next = nextStep(step, answers);

    setError(null);

    if (next === null) {
      void finish();
    } else {
      setStep(next);
    }
  }

  if (!restored) {
    return <ThemedView style={styles.blank} />;
  }

  if (step === 'done') {
    return (
      <StepFrame
        progress={DONE_PROGRESS.percent}
        label={DONE_PROGRESS.label}
        stepKey="done"
        nextLabel={DONE_CTA}
        onNext={() => router.replace('/')}>
        <QuestionHead lines={DONE_TITLE_LINES} />

        <View style={styles.section}>
          <View style={[styles.summary, { backgroundColor: theme.backgroundElement }]}>
            {doneRows(answers).map((row) => (
              <View key={row.step} style={styles.summaryRow}>
                <ThemedText type="t6" themeColor="textSecondary">
                  {row.label}
                </ThemedText>
                <ThemedText type="t6" numeric numberOfLines={1} style={styles.summaryValue}>
                  {row.value}
                </ThemedText>
              </View>
            ))}
          </View>

          <View style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="t5">MY에서 언제든 바꿀 수 있어요</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              정보를 바꾸면 추천도 함께 달라져요.
            </ThemedText>
          </View>
        </View>
      </StepFrame>
    );
  }

  const progress = stepProgress(step);
  const previous = prevStep(step, answers);
  const tasteCategory = tasteCategoryFor(answers);
  const tasteKeys = answers.taste?.category === tasteCategory ? answers.taste.keys : [];
  const date = answers.date?.value ?? null;
  const dateUndecided = answers.date !== null && date === null;
  const remaining = date ? dDay(date) : null;

  return (
    <>
      <StepFrame
        progress={progress.percent}
        label={progress.label}
        stepKey={step}
        answered={step === 'taste' ? [] : answeredRows(step, answers)}
        onEdit={(target) => {
          setError(null);
          setStep(target);
        }}
        prevLabel={previous === null ? undefined : PREV_CTA}
        onPrev={previous === null ? undefined : goPrev}
        nextLabel={step === 'taste' ? tasteCta(tasteKeys.length) : NEXT_CTA}
        nextDisabled={!canAdvance(step, answers) || sending}
        onNext={goNext}
        error={error}>
        <QuestionHead lines={STEP_TITLE_LINES[step]} description={stepDescription(step, answers)} />

        {step === 'date' ? (
          <View style={styles.section}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="예식일 선택"
              onPress={() => setSheetOpen(true)}
              style={[
                styles.field,
                date
                  ? { backgroundColor: theme.background, borderColor: theme.tint }
                  : { backgroundColor: theme.backgroundElement, borderColor: 'transparent' },
              ]}>
              <ThemedText type="t5" numeric themeColor={date ? 'text' : 'textDisabled'}>
                {date ? formatDateDot(date) : '예식일을 선택해주세요'}
              </ThemedText>
            </Pressable>

            {remaining?.kind === 'upcoming' ? (
              <View style={styles.dday}>
                <ThemedText type="body" themeColor="textSecondary">
                  {ddayParts(remaining.days).prefix}
                </ThemedText>
                <ThemedText type="t5" numeric themeColor="tint">
                  {ddayParts(remaining.days).number}
                </ThemedText>
                <ThemedText type="body" themeColor="textSecondary">
                  {ddayParts(remaining.days).suffix}
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.chips}>
              <OptionChip
                label={UNDECIDED_LABEL}
                selected={dateUndecided}
                onPress={() => update({ date: { value: null } })}
              />
            </View>
          </View>
        ) : null}

        {step === 'region' ? (
          <RegionPicker value={answers.region} onChange={(next) => update({ region: next })} />
        ) : null}

        {step === 'prep' ? (
          <PrepStatus
            selected={answers.prep?.categories ?? []}
            notStarted={answers.prep !== null && answers.prep.categories.length === 0}
            onChange={(categories: VendorCategory[]) => update({ prep: { categories } })}
            onNotStarted={() => update({ prep: { categories: [] } })}
          />
        ) : null}

        {step === 'budget' ? (
          <BudgetGrid value={answers.budget} onChange={(next) => update({ budget: next })} />
        ) : null}

        {step === 'taste' && tasteCategory !== null ? (
          <TasteGrid
            category={tasteCategory}
            keys={tasteKeys}
            onToggle={(key) =>
              update({
                taste: {
                  category: tasteCategory,
                  keys: tasteKeys.includes(key) ? tasteKeys.filter((one) => one !== key) : [...tasteKeys, key],
                },
              })
            }
          />
        ) : null}
      </StepFrame>

      <DatePickerSheet
        visible={sheetOpen}
        value={date}
        onConfirm={(iso) => {
          update({ date: { value: iso } });
          setSheetOpen(false);
        }}
        onDismiss={() => setSheetOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1 },
  /* 시안 padSec — 좌우 24 · 아래 24 · 사이 12. */
  section: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Layout.rowPaddingY,
  },
  /* 예식일 필드. 토큰 size.field 52(시안 56) · radius.control 6 · 좌우 16 · 테두리 1.5. */
  field: {
    height: Layout.field,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  /* «예식일까지 250일 남았어요» — 숫자만 코랄. baseline 정렬 · 사이 8 · 좌우 2. */
  dday: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    paddingHorizontal: Spacing.half,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  /* 완료 요약 — gray50 · radius 10 · 안쪽 20 · 행 상하 9. 안쪽 상자 없음. */
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
    paddingVertical: Layout.summaryRowPaddingY,
  },
  summaryValue: { flexShrink: 1, textAlign: 'right', fontWeight: 700 },
  note: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Spacing.two,
  },
});
