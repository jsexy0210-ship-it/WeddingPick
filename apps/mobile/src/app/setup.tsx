import {
  STYLE_PICK_LIMIT_TOAST,
  preparationSkippedToast,
  skippedPreparationCategories,
  combineRegion,
  dDay,
  formatDateDot,
  type VendorCategory,
  type WeddingStyle,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';

import { ApiError, completeSetup, completeSignup, getCurrentUser, getSignupState } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';
import { Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

import { DelayedRecommendingView } from '@/features/loading/delayed-loader';
import { categoryKindsFor } from '@/features/loading/exclude';
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
  returnStep,
  stepDescription,
  stepProgress,
  stepsFor,
  styleCta,
  type Answers,
  type QuestionStep,
} from '@/features/onboarding/flow';
import { InlineToast, useInlineToast } from '@/features/onboarding/inline-toast';
import { OptionChip } from '@/features/onboarding/option-chip';
import { PrepStatus } from '@/features/onboarding/prep-status';
import { QuestionHead } from '@/features/onboarding/question-head';
import { RegionPicker } from '@/features/onboarding/region-picker';
import { StepFrame } from '@/features/onboarding/step-frame';
import { StyleGrid } from '@/features/onboarding/style-grid';
import {
  clearOnboardingAnswers,
  clearWeddingDraft,
  loadOnboardingAnswers,
  saveOnboardingAnswers,
  saveWeddingDraft,
} from '@/features/onboarding/wedding-draft';

/**
 * 초기 설정. 디자인 핸드오프 v3.22 20-onboarding-v2.dc.html · SPEC §13.6 · §13.7
 * (WP-APP-020 ~ 023).
 *
 *   예식일 1/5 → 지역 2/5 → 준비 현황 3/5 → 예산 4/5 → 스타일 5/5 → 완료
 *
 * **큰 질문 하나 = Step 하나.** 순서·건너뛰기·요약은 전부 `features/onboarding/flow.ts`
 * 가 정하고 이 화면은 그 답을 그린다. 답하면 그 질문은 화면 아래로 가라앉아 «라벨 ·
 * 값 · 바꾸기» 한 줄이 되고 새 질문이 위에서 내려온다(은행앱 방식 · v3.19).
 *
 * **상단 뒤로가기가 없다.** 첫 질문은 «다음»만, 두 번째부터 «이전 · 다음».
 * 안드로이드 물리 뒤로가기는 «이전»과 같고 첫 질문에서는 로그인으로 나간다.
 *
 * **«바꾸기»**(SPEC §13.6 «「바꾸기」 동작 정의»)는 그 질문만 다시 연다 — 진행바는
 * 그 Step으로 돌아가고 하단은 «다음» 하나뿐이며, 뒤에 답한 값은 그대로 두되 답 줄에서
 * 잠시 숨긴다. 고치고 «다음»을 누르면 원래 있던 Step으로 바로 복귀한다 — 3/5 · 4/5를
 * 다시 묻지 않는다. 연쇄 초기화는 없다 — 스타일은 업종과 무관한 축이라 준비 현황을
 * 바꿔도 지우지 않는다(v3.19 «범용 스타일»).
 *
 * **미정을 억지로 받지 않는다.** 예식일 · 지역 «아직 정하지 않았어요», 준비 현황
 * «아직 시작 전이에요», 예산 «아직 모르겠어요». 스타일만 최소 1개 필수다 — 추천의
 * 근거라 없으면 첫 화면에 보여줄 것이 없다. 최대 2개, 3번째는 추가하지 않고 토스트
 * «2개까지 고를 수 있어요»(SPEC §13.6 «선택 정책»). 5/5는 건너뛰지 않는다. 이미 고른
 * 스타일이 서버에 있으면(다시 들어온 계정) 초기화하지 않고 복원해서 보여준다.
 *
 * **스크롤은 화면 전체 하나다**(SPEC §13.5.5). 준비 현황이 뷰포트를 넘치면 화면이
 * 스크롤한다 — 목록 전용 스크롤을 두지 않는다. 5/5는 200 × 2행이라 스크롤이 없다.
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
 * 시안과 다른 값은 토큰이 이기는 곳뿐이다: CTA·입력칸 높이 52(size.ctaPrimary ·
 * size.field, 시안 56) · 15px 글자는 t6(16) · 13px은 t7(14).
 */
/** «바꾸기»로 다시 연 질문. `from`은 돌아갈 Step. */
type Editing = { step: QuestionStep; from: QuestionStep };

export default function SetupScreen() {
  const theme = useTheme();

  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [step, setStep] = useState<QuestionStep | 'done'>('date');
  /** 기기에 적어둔 답을 읽기 전에는 첫 질문을 그리지 않는다 — 잠깐 스쳤다 바뀌면 안 된다. */
  const [restored, setRestored] = useState(false);
  /** 가입이 아직 안 끝난 계정인가 — 그러면 답을 다 받은 뒤 가입부터 마친다. */
  const [needsSignup, setNeedsSignup] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  /** 서버에 이미 있는 스타일 — 5/5에 닿았을 때 아직 안 골랐으면 이걸로 복원한다. */
  const [seedStyle, setSeedStyle] = useState<readonly WeddingStyle[] | null>(null);
  /** 서버 응답이 올 때 이미 5/5에 있는지 보려고 지금 Step을 적어 둔다. */
  const stepRef = useRef<QuestionStep | 'done'>('date');
  const [sheetOpen, setSheetOpen] = useState(false);
  const limitToast = useInlineToast();
  /** 준비 현황에서 «앞 단계 비움» 토스트를 이미 보여준 상태(비운 업종 목록). 같은 상태로 다시 누르면 넘어간다. */
  const prepWarnedRef = useRef<string | null>(null);
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
    /*
     * 이미 고른 스타일이 있으면 복원한다(SPEC §13.6 «진입 — 기존 선택값을 초기화하지 않고
     * 복원»). 5/5에 들어설 때 `enter`가 채우고, 응답이 늦어 이미 5/5에 있으면 여기서 채운다.
     * 못 읽으면 없는 것 — 4/5 이전에는 채우지 않는다(채우면 5/5를 건너뛰게 된다).
     */
    void getCurrentUser()
      .then((me) => {
        if (me.styleTags.length === 0) return;

        setSeedStyle(me.styleTags);
        if (stepRef.current === 'style') {
          setAnswers((current) => (current.style === null ? { ...current, style: me.styleTags } : current));
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    if (!restored || step === 'done') return;

    void saveOnboardingAnswers(answers).catch(() => undefined);
  }, [answers, restored, step]);

  function update(patch: Partial<Answers>) {
    setError(null);
    setAnswers((current) => ({ ...current, ...patch }));
  }

  /** Step을 연다. 5/5에 처음 닿았고 서버에 고른 스타일이 있으면 그걸로 채운다. */
  const enter = useCallback(
    (target: QuestionStep) => {
      if (target === 'style' && answers.style === null && seedStyle !== null) {
        setAnswers((current) => (current.style === null ? { ...current, style: seedStyle } : current));
      }
      setStep(target);
    },
    [answers.style, seedStyle]
  );

  const goPrev = useCallback(() => {
    if (step === 'done' || editing !== null) return;

    const previous = prevStep(step, answers);

    setError(null);

    if (previous === null) {
      router.replace('/login');
    } else {
      enter(previous);
    }
  }, [step, answers, editing, enter]);

  /**
   * «바꾸기»로 연 질문을 닫는다. 원래 있던 Step으로 바로 돌아간다(`returnStep`).
   * 돌아갈 곳이 없으면 완료다. 연쇄 초기화는 없다.
   */
  const finishEdit = useCallback(() => {
    if (editing === null || step === 'done' || !canAdvance(step, answers)) return;

    const target = returnStep(editing.step, editing.from, answers);

    setEditing(null);
    setError(null);

    if (target === null) {
      void finish(answers);
    } else {
      enter(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish는 answers · sending만 읽고 여기서 answers를 직접 넘긴다.
  }, [editing, step, answers, enter]);

  /* 안드로이드 물리 뒤로가기 = «이전». 바꾸는 중에는 «다음»과 같고, 완료 화면에서는 아무 데도 가지 않는다. */
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'done') return true;

      if (editing !== null) {
        finishEdit();
      } else {
        goPrev();
      }

      return true;
    });

    return () => subscription.remove();
  }, [step, editing, goPrev, finishEdit]);

  async function finish(source: Answers = answers) {
    if (sending) return;

    setSending(true);
    setError(null);

    const region = source.region?.region ?? null;
    const styleTags = [...(source.style ?? [])];
    const draft = {
      weddingDate: source.date?.value ?? null,
      region: region === null ? null : combineRegion(region, source.region?.district ?? null),
      preparedCategories: source.prep?.categories ?? [],
      budgetBracket: source.budget,
      styleTags,
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
          /* 계약은 최소 1개를 받는다 — 5/5는 건너뛰지 않으므로 늘 있지만, 없으면 키를 아예 보내지 않는다. */
          ...(styleTags.length > 0 ? { styleTags } : {}),
        });

        void clearWeddingDraft().catch(() => undefined);
      } else {
        await saveWeddingDraft(draft);
      }

      setStep('done');
      /*
       * 남은 정리는 화면을 막지 않는다. `done`을 그린 뒤에 지워도 결과가 같고,
       * 여기서 기다리면 저장이 끝난 뒤에도 로더가 더 떠 있다.
       */
      void clearOnboardingAnswers().catch(() => undefined);
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

    /*
     * 준비 현황(3/5) — 앞 그룹을 비워두고 뒤 그룹만 고른 채 «다음»이면 한 번 알리고 머문다
     * (v3.23 «앞 단계도 확인해주세요 · 결정사 · 웨딩홀»). 막지는 않는다 — 같은 상태로 다시
     * 누르면 그대로 넘어간다. 진행 중이 아니라 이미 지난 업종을 빠뜨렸는지 짚어 주는 것뿐이다.
     */
    if (step === 'prep') {
      const skipped = skippedPreparationCategories(answers.prep?.categories ?? []);
      const signature = skipped.join(',');

      if (skipped.length > 0 && prepWarnedRef.current !== signature) {
        prepWarnedRef.current = signature;
        limitToast.show(preparationSkippedToast(skipped));
        return;
      }
    }

    if (editing !== null) {
      finishEdit();
      return;
    }

    const next = nextStep(step, answers);

    setError(null);

    if (next === null) {
      void finish();
    } else {
      enter(next);
    }
  }

  /** «바꾸기» — 그 질문만 다시 연다. 돌아갈 곳을 기억해 둔다. */
  function beginEdit(target: QuestionStep) {
    if (step === 'done') return;

    setError(null);
    setEditing({ step: target, from: step });
    enter(target);
  }

  if (!restored) {
    return <ThemedView style={styles.blank} />;
  }

  /*
   * 5/5에서 «완료»를 누른 뒤. 여기서 가입과 초기 설정 두 번을 서버에 보내는데,
   * 그동안 화면에는 CTA가 눌리지 않는 것 말고 아무 표시가 없어 멈춘 것처럼 보였다.
   * WP-ST-015 추천 계산 화면을 띄운다 — 700ms 안에 끝나면 이것도 뜨지 않는다.
   *
   * 순회에서 뺄 업종은 방금 받은 답에서 가져온다. 서버에 아직 안 들어가 있어
   * «나»의 스냅숏으로는 알 수 없고, 넘기지 않으면 방금 «결정 완료»로 고른 업종이
   * 로더에서 계속 돈다.
   */
  if (sending) {
    return <DelayedRecommendingView exclude={categoryKindsFor(answers.prep?.categories ?? [])} />;
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
  /* 바꾸는 중에는 «다음» 하나뿐이다(SPEC §13.6 «하단 CTA 다음 하나만 · 이전 버튼 없음»). */
  const previous = editing === null ? prevStep(step, answers) : null;
  const chosenStyles = answers.style ?? [];
  const date = answers.date?.value ?? null;
  const dateUndecided = answers.date !== null && date === null;
  const remaining = date ? dDay(date) : null;

  return (
    <>
      <StepFrame
        progress={progress.percent}
        label={progress.label}
        stepKey={step}
        answered={answeredRows(step, answers, editing !== null)}
        onEdit={beginEdit}
        prevLabel={previous === null ? undefined : PREV_CTA}
        onPrev={previous === null ? undefined : goPrev}
        nextLabel={step === 'style' ? styleCta(chosenStyles.length) : NEXT_CTA}
        nextDisabled={!canAdvance(step, answers) || sending}
        onNext={goNext}
        error={error}>
        <QuestionHead lines={STEP_TITLE_LINES[step]} description={stepDescription(step)} />

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

        {step === 'style' ? (
          <StyleGrid
            chosen={chosenStyles}
            onChange={(next) => update({ style: next })}
            onLimited={() => limitToast.show(STYLE_PICK_LIMIT_TOAST)}
          />
        ) : null}
      </StepFrame>

      <InlineToast toast={limitToast.toast} onHidden={limitToast.hide} />

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
    paddingHorizontal: Layout.fieldPaddingX,
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
