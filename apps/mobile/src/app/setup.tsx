import {
  STYLE_PICK_LIMIT_TOAST,
  WEDDING_STYLES,
  WEDDING_STYLE_LABEL,
  budgetBracketForAmount,
  combineRegion,
  dDay,
  formatDateDot,
  toggleStyle,
  type WeddingStyle,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';

import { ApiError, completeSetup, completeSignup, getCurrentUser, getSignupState } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';
import { error as errorCopy } from '../../../../spec/strings.ko.json';
import {
  Border,
  CanonGray,
  FontSize,
  Layout,
  LineHeight,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

import { HomeSkeleton } from '@/features/home/home-skeleton';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import { BudgetAmount } from '@/features/onboarding/budget-amount';
import { DatePickerSheet } from '@/features/onboarding/date-picker-sheet';
import {
  DONE_CTA,
  DONE_DESCRIPTION,
  DONE_PROGRESS,
  DONE_TITLE_LINES,
  EDIT_CTA,
  EMPTY_ANSWERS,
  NEXT_CTA,
  PREP_CARDS,
  PREV_CTA,
  STEP_TITLE_LINES,
  STYLE_DESCRIPTION,
  UNDECIDED_LABEL,
  canAdvance,
  doneRows,
  isPrepCardSelected,
  nextStep,
  prevStep,
  resumeStep,
  settleAnswer,
  stepDescription,
  stepProgress,
  stepsFor,
  togglePrepCard,
  type Answers,
  type QuestionStep,
} from '@/features/onboarding/flow';
import { InlineToast, useInlineToast } from '@/features/onboarding/inline-toast';
import { OptionRow } from '@/features/onboarding/option-row';
import { QuestionHead } from '@/features/onboarding/question-head';
import { RegionPickerSheet } from '@/features/onboarding/region-picker-sheet';
import { StepFrame } from '@/features/onboarding/step-frame';
import {
  clearOnboardingAnswers,
  clearWeddingDraft,
  loadOnboardingAnswers,
  saveOnboardingAnswers,
  saveWeddingDraft,
} from '@/features/onboarding/wedding-draft';

/**
 * 초기 설정 — `docs/design/React_Native/home.jsx`
 * WP-AUTH-002 ~ 007.
 *
 *   예식일 1/5 → 지역 2/5 → 진행 상황 3/5 → 예산 4/5 → 스타일 5/5 → 완료
 *
 * **셋에서 다시 다섯이 됐다**(2026-09-22 v3.28). 2026-09-14의 3단계는 그때의 피그마
 * 기준이었고 v3.28이 그 위에 선다. 준비 현황과 예산은 MY의 웨딩 설정
 * (`app/(tabs)/my/wedding-settings.tsx`)에서도 계속 고칠 수 있다. 순서와 개수는
 * `features/onboarding/flow.ts`가 정한다.
 *
 * **큰 질문 하나 = Step 하나.** 순서·건너뛰기는 전부 `features/onboarding/flow.ts`가
 * 정하고 이 화면은 그 답을 그린다.
 *
 * 질문 화면에는 답 줄이 없다 — 시안 다섯 장 모두 진행바 · 질문 · 입력 · dock뿐이다.
 * 답을 다시 보는 자리는 완료 화면 하나이고 거기의 «바꾸기»가 해당 질문을 다시 연다
 * (WP-AUTH-007 「여기서 바꾸면 해당 단계로 돌아갑니다」). **하단 CTA는 다섯 질문
 * 모두 «다음»이다.**
 *
 * **상단 뒤로가기가 없다.** 첫 질문은 «다음»만, 두 번째부터 «이전 · 다음».
 * 안드로이드 물리 뒤로가기는 «이전»과 같고 첫 질문에서는 로그인으로 나간다.
 *
 * **미정을 억지로 받지 않는다.** 예식일은 «아직 정하지 않았어요» 칩, 진행 상황 · 예산은
 * 아무것도 안 고르고 «다음»을 누르면 미정이다(`settleAnswer`). **지역은 필수다**(2026-09-25
 * 대표 지시 「지역 선택 필수값이다」) — 시/도를 골라야 «다음»이 켜진다. 스타일만 최소 1개 필수다 — 추천의 근거라 없으면 첫 화면에
 * 보여줄 것이 없다. 최대 2개이며 3번째 선택은 정본 토스트로 알린다(CLAUDE.md
 * v3.24 · 대조표 「4종 버튼 · 최대 2개」). 이미 고른 스타일이 서버에 있으면(다시
 * 들어온 계정) 초기화하지 않고 복원해서 보여준다.
 *
 * **스크롤은 화면 전체 하나다**(SPEC §13.5.5). 목록 전용 스크롤을 두지 않는다.
 *
 * **만 14세 확인은 여기 없다.** 로그인(`POST /v1/auth/sessions`)이 판정하고 서버에
 * 기록한다 — 이 화면은 동의만 보낸다. 예전에는 여기서 `ageVerified: true`를 함께
 * 보냈는데, 그것은 확인이 아니라 **늘 같은 값을 넣는 자리**였고 서버가 그것으로
 * 관문을 지켰다(2026-09-10에 만 14세 미만 계정이 실제로 들어온 원인 중 하나다).
 * 2026-09-04 정책(비회원 진입 삭제)으로 이 화면은 로그인 뒤에 온다. 그래도 토큰이
 * 없으면 기기에 적어두고 다음 로그인에 올린다(`after-sign-in`).
 *
 * 답하는 중인 값은 기기에 적어둔다 — 앱을 닫았다 열어도 답한 데까지 이어서 묻는다.
 * 서버에 올리고 나면 지운다.
 *
 * 화면의 모양·수치·줄바꿈은 `docs/design/React_Native/home.jsx`를 따른다.
 * 예산 금액은 현재 API가 받는 검색용 구간으로 저장한다.
 */
/** 예식일 첫 줄 — 아직 안 골랐을 때. 고르면 그 날짜가 이 자리에 선다. */
const DATE_PICK_LABEL = '날짜 고르기';

/** 지역 첫 줄 — 아직 안 골랐을 때. 고르면 «서울 강남»처럼 그 지역이 이 자리에 선다. */
const REGION_PICK_LABEL = '지역 고르기';

/**
 * 고른 지역을 줄에 적는 말. 아직 안 골랐거나 «미정»이면 null — 그 자리는
 * «지역 고르기»가 선다.
 *
 * **보이는 것만 짧게 줄인다**(`shortDistrictName`) — 「서울 강남구」가 아니라
 * 「서울 강남」이다. 저장하는 값은 「강남구」 그대로고, 「중구」처럼 두 글자인
 * 이름은 그 함수가 손대지 않는다.
 */
function regionLabelOf(value: Answers['region']): string | null {
  if (value === null || value.region === null) return null;

  return value.district === null ? value.region : `${value.region} ${value.district}`;
}

export default function SetupScreen() {
  const theme = useTheme();

  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [step, setStep] = useState<QuestionStep | 'done'>('date');
  /** 기기에 적어둔 답을 읽기 전에는 첫 질문을 그리지 않는다 — 잠깐 스쳤다 바뀌면 안 된다. */
  const [restored, setRestored] = useState(false);
  /** 서버에 이미 있는 스타일 — 5/5에 닿았을 때 아직 안 골랐으면 이걸로 복원한다. */
  const [seedStyle, setSeedStyle] = useState<readonly WeddingStyle[] | null>(null);
  /** 서버 응답이 올 때 이미 5/5에 있는지 보려고 지금 Step을 적어 둔다. */
  const stepRef = useRef<QuestionStep | 'done'>('date');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [regionSheetOpen, setRegionSheetOpen] = useState(false);
  const limitToast = useInlineToast();
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

    /*
     * 이미 고른 스타일이 있으면 복원한다(SPEC §13.6 «진입 — 기존 선택값을 초기화하지 않고
     * 복원»). 5/5에 들어설 때 `enter`가 채우고, 응답이 늦어 이미 5/5에 있으면 여기서 채운다.
     * 못 읽으면 없는 것 — 그 앞에서는 채우지 않는다(채우면 5/5를 건너뛰게 된다).
     */
    let active = true;
    void (async () => {
      const token = await loadToken();
      if (!token) return null;
      const state = await getSignupState();
      if (!active || !state.activated || await loadToken() !== token) return null;
      const me = await getCurrentUser();
      return await loadToken() === token ? me : null;
    })()
      .then((me) => {
        if (!active || !me || me.styleTags.length === 0) return;

        setSeedStyle(me.styleTags);
        if (stepRef.current === 'style') {
          setAnswers((current) => (current.style === null ? { ...current, style: me.styleTags } : current));
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
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
    if (step === 'done') return;

    const previous = prevStep(step, answers);

    setError(null);

    if (previous === null) {
      router.replace('/login');
    } else {
      enter(previous);
    }
  }, [step, answers, enter]);

  /* 안드로이드 물리 뒤로가기 = «이전». 완료 화면에서는 아무 데도 가지 않는다. */
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'done') return true;

      goPrev();

      return true;
    });

    return () => subscription.remove();
  }, [step, goPrev]);

  /**
   * 서버에 보낸다. **완료 화면에서 «완료»를 눌렀을 때만 부른다.**
   *
   * 2026-09-11 대표 지시 — 「결과는 사용자 입력한 값을 보여주기만 하고 정보를
   * 저장하지 않는다. 완료 버튼을 눌러야만 저장 단계로 진행한다」.
   *
   * 예전에는 마지막 답을 받은 그 자리에서 이걸 불렀다. 그래서 결과 화면을 그리기
   * 전에 서버 왕복을 **차례로 두세 번** 기다렸다 — `getSignupState()` → (필요하면)
   * `completeSignup()` → `completeSetup()`. 답을 다 넣고도 요약이 안 뜨는 시간이
   * 그 왕복들이었다. 결과는 이미 손에 있는 답으로 그릴 수 있으므로 기다릴 이유가
   * 없다(`goNext` 참고).
   *
   * **안의 순서는 그대로다**(PR #192 · `features/auth/session-recovery` 규칙).
   * 가입 상태를 캐시 없이 먼저 묻고, 활성 계정일 때만 보호 API를 부르고, 제출
   * 직전에 토큰을 다시 확인한다. 바꾼 것은 **언제 부르는가**뿐이다.
   */
  async function finish(source: Answers = answers) {
    if (sending) return;

    setSending(true);
    setError(null);

    const region = source.region?.region ?? null;
    const styleTags = [...(source.style ?? [])];
    /* 진행 상황(3/5) — 고른 카드의 업종 전부. 빈 배열은 «아직 시작 전». */
    const preparedCategories = [...(source.prep?.categories ?? [])];
    /* 예산(4/5)은 현재 API 계약에 맞춰 만원 값을 검색용 구간으로 옮긴다. */
    const budgetBracket = budgetBracketForAmount(source.budget?.amount ?? 0);
    const draft = {
      weddingDate: source.date?.value ?? null,
      region: region === null ? null : combineRegion(region, source.region?.district ?? null),
      budgetBracket,
      preparedCategories,
      styleTags,
    };

    try {
      if (isServerConfigured) {
        const token = await loadToken();
        if (!token) {
          router.replace('/login');
          return;
        }
        /*
         * 가입을 먼저 끝낸다. 서버는 살아 있지 않은 계정의 다른 경로를 전부 막으므로
         * 순서를 바꾸면 예식일 저장이 거절된다.
         *
         * **v3.29부터 필수 동의는 보통 이 화면에 오기 전에 끝나 있다** — 약관 동의 ·
         * 권한 안내(WP-AUTH-010, `app/login/consent.tsx`)가 로그인 직후에 따로 서서
         * `completeSignup`을 그때 부른다. 여기 남은 호출은 그 화면을 거치지 않은
         * 옛 흐름 · 서버 미설정 개발 환경을 위한 안전장치다 — `signup.activated`가
         * 이미 true면 아래 분기를 타지 않는다. 나이는 보내지 않는다(로그인이 판정했다).
         */
        // 화면 진입 시 조회가 늦거나 실패해도 가입 완료로 간주하지 않는다.
        const signup = await getSignupState();
        if (await loadToken() !== token) {
          router.replace('/login');
          return;
        }
        if (!signup.activated) {
          const completed = await completeSignup({ consents: ['terms', 'privacy'] });
          if (!completed.activated) throw new Error(errorCopy['general.body']);
        }

        if (await loadToken() !== token) {
          router.replace('/login');
          return;
        }

        await completeSetup({
          weddingDate: draft.weddingDate,
          region: draft.region,
          preparedCategories: draft.preparedCategories,
          budgetBracket: draft.budgetBracket,
          /* 계약은 최소 1개를 받는다 — 5/5는 건너뛰지 않으므로 늘 있지만, 없으면 키를 아예 보내지 않는다. */
          ...(styleTags.length > 0 ? { styleTags } : {}),
        });

        if (await loadToken() !== token) {
          router.replace('/login');
          return;
        }

        void clearWeddingDraft().catch(() => undefined);
      } else {
        await saveWeddingDraft(draft);
      }

      /*
       * 남은 정리는 화면을 막지 않는다. 홈으로 옮긴 뒤에 지워도 결과가 같고,
       * 여기서 기다리면 저장이 끝난 뒤에도 로더가 더 떠 있다.
       */
      void clearOnboardingAnswers().catch(() => undefined);

      dismissToOrReplace('/');
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

    /* 진행 상황 · 예산은 아무것도 안 고르고 누르면 그 자체가 미정 답이다. */
    const settled = settleAnswer(step, answers);
    if (settled !== answers) setAnswers(settled);

    const next = nextStep(step, settled);

    setError(null);

    if (next === null) {
      /*
       * **여기서 저장하지 않는다.** 결과 화면은 방금 받은 답을 그대로 보여줄 뿐이라
       * 서버를 기다릴 것이 없다 — 저장은 «완료»가 시작한다(`finish` 참고).
       */
      setStep('done');
    } else {
      enter(next);
    }
  }

  if (!restored) {
    return <ThemedView style={styles.blank} />;
  }

  /* 저장부터 홈의 첫 자료가 준비될 때까지 같은 홈 골격을 유지한다. */
  if (sending) return <HomeSkeleton />;

  if (step === 'done') {
    return (
      <StepFrame
        label={DONE_PROGRESS.label}
        stepKey="done"
        nextLabel={DONE_CTA}
        /*
         * **저장은 여기서 시작한다**(2026-09-11 대표 지시). 위의 요약은 이미 손에
         * 있는 답으로 그린 것이라 서버와 무관하고, 이 버튼을 누르기 전까지 아무것도
         * 보내지 않는다. 실패하면 `error`가 이 화면에 뜨고 답은 그대로 남는다 —
         * 다시 누르면 된다.
         */
        onNext={() => void finish()}
        error={error}>
        <QuestionHead lines={DONE_TITLE_LINES} description={DONE_DESCRIPTION} />

        {/* 시안 sumCard — gray50 · radius 10 · 행 56 · 좌우 16 · 행 사이 hairline. */}
        <View style={styles.section}>
          <View style={[styles.summary, { backgroundColor: theme.backgroundElement }]}>
            {doneRows(answers).map((row, index, rows) => (
              <View
                key={row.step}
                style={[
                  styles.summaryRow,
                  index < rows.length - 1 && { borderBottomWidth: Border.hairline, borderBottomColor: theme.line },
                ]}>
                <ThemedText type="f14" themeColor="textAssistive" style={styles.summaryKey}>
                  {row.label}
                </ThemedText>
                <ThemedText type="f16" numeric numberOfLines={1} style={styles.summaryValue}>
                  {row.value}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${row.label} ${EDIT_CTA}`}
                  onPress={() => enter(row.step)}
                  style={({ pressed }) => [pressed && styles.pressed]}>
                  <ThemedText type="f14" themeColor="tint" style={styles.summaryEdit}>
                    {EDIT_CTA}
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </StepFrame>
    );
  }

  const progress = stepProgress(step);
  const previous = prevStep(step, answers);
  const chosenStyles = answers.style ?? [];
  const date = answers.date?.value ?? null;
  const dateUndecided = answers.date !== null && date === null;
  const preparedCategories = answers.prep?.categories ?? [];
  const remaining = date ? dDay(date) : null;

  return (
    <>
      <StepFrame
        label={progress.label}
        stepKey={step}
        prevLabel={previous === null ? undefined : PREV_CTA}
        onPrev={previous === null ? undefined : goPrev}
        nextLabel={NEXT_CTA}
        nextDisabled={!canAdvance(step, answers) || sending}
        onNext={goNext}
        error={error}>
        {/* 시안 qBlock — 다섯 질문 모두 같은 크기(28/38 · 20/24/24). 답 줄은 없다. */}
        <QuestionHead lines={STEP_TITLE_LINES[step]} description={stepDescription(step)} />

        {/* 예식일 1/5 — 56px 날짜 필드 + D-day + «아직 정하지 않았어요» chip. */}
        {step === 'date' ? (
          <View style={styles.selectionSection}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="예식일 선택"
              onPress={() => setSheetOpen(true)}
              style={({ pressed }) => [
                styles.selectionField,
                { borderColor: theme.tint },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="f16" numeric style={styles.selectionFieldLabel}>
                {date ? formatDateDot(date) : DATE_PICK_LABEL}
              </ThemedText>
            </Pressable>

            {date && remaining ? (
              <View style={styles.ddayRow}>
                <ThemedText type="f14" themeColor="textAssistive" style={styles.ddayLabel}>
                  오늘부터
                </ThemedText>
                <ThemedText type="f16" themeColor="tint" numeric style={styles.ddayValue}>
                  {remaining.kind === 'upcoming' ? `${remaining.days}일` : '오늘'}
                </ThemedText>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: dateUndecided }}
              onPress={() => update({ date: { value: null } })}
              style={({ pressed }) => [
                styles.undecidedChip,
                { backgroundColor: dateUndecided ? theme.tintSurface : CanonGray.gray100 },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="f15" style={[styles.bold, { color: dateUndecided ? theme.tint : CanonGray.gray700 }]}>
                {UNDECIDED_LABEL}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {/* 지역 2/5 — 56px 필드가 시/도 · 시/군/구 2열 휠 바텀시트를 연다. 지역은 필수 — 시/도를 골라야 «다음»이 켜진다(2026-09-25 대표 지시). */}
        {step === 'region' ? (
          <View style={styles.selectionSection}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="지역 선택"
              onPress={() => setRegionSheetOpen(true)}
              style={({ pressed }) => [
                styles.selectionField,
                { borderColor: theme.tint },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="f16" style={styles.selectionFieldLabel}>
                {regionLabelOf(answers.region) ?? REGION_PICK_LABEL}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {/* 진행 상황 3/5 — 시안 PREP_CATS 카드 넷(이름 17/700 · 부제 13 · 체크). 여러 개 고른다. */}
        {step === 'prep' ? (
          <View style={styles.prepOptions}>
            {PREP_CARDS.map((card) => (
              <OptionRow
                key={card.key}
                role="checkbox"
                variant="prep"
                label={card.name}
                description={card.description}
                selected={isPrepCardSelected(card, preparedCategories)}
                onPress={() => update({ prep: { categories: togglePrepCard(card, preparedCategories) } })}
              />
            ))}
          </View>
        ) : null}

        {/* 예산 4/5 — 만원 금액 직접 입력 + 빠른 입력 칩 + 안내 한 줄. */}
        {step === 'budget' ? (
          <BudgetAmount
            value={answers.budget?.amount ?? null}
            onChange={(amount) => update({ budget: { amount } })}
          />
        ) : null}

        {/* 스타일 5/5 — 설명 한 줄이 붙은 4버튼. 최대 2개이며 사진 타일은 쓰지 않는다. */}
        {step === 'style' ? (
          <View style={styles.styleOptions}>
            {WEDDING_STYLES.map((style) => (
              <OptionRow
                key={style}
                role="checkbox"
                label={WEDDING_STYLE_LABEL[style]}
                description={STYLE_DESCRIPTION[style]}
                selected={chosenStyles.includes(style)}
                onPress={() => {
                  const { next, limited } = toggleStyle(chosenStyles, style);

                  if (limited) limitToast.show(STYLE_PICK_LIMIT_TOAST);
                  else update({ style: next });
                }}
              />
            ))}
          </View>
        ) : null}

        {step === 'style' ? (
          <View style={styles.toastWrap}>
            <InlineToast toast={limitToast.toast} onHidden={limitToast.hide} placement="inline" />
          </View>
        ) : null}

      </StepFrame>

      <RegionPickerSheet
        visible={regionSheetOpen}
        value={answers.region?.region ? { region: answers.region.region, district: answers.region.district } : null}
        onConfirm={(picked) => {
          update({ region: picked });
          setRegionSheetOpen(false);
        }}
        onDismiss={() => setRegionSheetOpen(false)}
      />

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

/* 시안 sumK — 요약 라벨 칸 폭 72. */
const SUMMARY_KEY_WIDTH = 72;

const styles = StyleSheet.create({
  blank: { flex: 1 },
  /* 시안 padSec — 좌우 24 · 아래 24 · 사이 12. */
  section: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Layout.rowPaddingY,
  },
  selectionSection: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.listGap,
    gap: Layout.inlineGap,
  },
  selectionField: {
    height: 56,
    borderRadius: Radius.control,
    borderWidth: Border.selected,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  selectionFieldLabel: {
    fontSize: FontSize.dateWheel,
    fontWeight: 700,
  },
  ddayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
    paddingHorizontal: Spacing.half,
  },
  /* home.js `ddayLabel` 14 · `ddayVal` 16/700 — 줄 높이 normal(18 · 21). */
  ddayLabel: { lineHeight: LineHeight.micro },
  ddayValue: { fontWeight: 700, lineHeight: LineHeight.t7Loose },
  undecidedChip: {
    alignSelf: 'flex-start',
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    justifyContent: 'center',
  },

  /* 시안 prepSec — 좌우 24 · 아래 20 · 카드 사이 10. */
  prepOptions: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.listGap,
    gap: Layout.iconTextGap,
  },
  /* 시안 styleBtnWrap — 좌우 24 · 아래 16 · 카드 사이 10. */
  styleOptions: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.three,
    gap: Layout.iconTextGap,
  },
  toastWrap: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.listGap,
    alignItems: 'center',
  },
  bold: { fontWeight: 700 },
  pressed: { opacity: 0.8 },
  /* 시안 sumCard — gray50 · radius 10. 행은 56 · 좌우 16 · 사이 12 · 라벨 폭 72. */
  summary: {
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    minHeight: Layout.rowMinHeight,
    paddingHorizontal: Spacing.three,
  },
  summaryKey: { width: SUMMARY_KEY_WIDTH, flexShrink: 0 },
  summaryValue: { flex: 1, minWidth: 0, fontWeight: 700 },
  summaryEdit: { fontWeight: 700 },
});
