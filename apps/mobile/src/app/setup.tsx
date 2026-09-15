import {
  STYLE_PICK_LIMIT_TOAST,
  WEDDING_STYLES,
  WEDDING_STYLE_LABEL,
  combineRegion,
  shortDistrictName,
  formatDateDot,
  toggleStyle,
  type WeddingStyle,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { ApiError, completeSetup, completeSignup, getCurrentUser, getSignupState } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';
import { error as errorCopy } from '../../../../spec/strings.ko.json';
import { Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

import { DelayedRecommendingView } from '@/features/loading/delayed-loader';
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
  canAdvance,
  doneRows,
  nextStep,
  prevStep,
  resumeStep,
  stepDescription,
  stepProgress,
  stepsFor,
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
 * 초기 설정. 디자인 핸드오프 v3.22 20-onboarding-v2.dc.html · SPEC §13.6 · §13.7
 * (WP-APP-020 ~ 023).
 *
 *   예식일 1/3 → 지역 2/3 → 스타일 3/3 → 완료
 *
 * **다섯에서 셋으로 줄였다**(2026-09-14 대표 확정 · 피그마 `FlowScreens.tsx` 3단계).
 * 준비 현황과 예산은 첫 진입에서 묻지 않는다 — 없어진 값이 아니라 MY의 웨딩 설정
 * (`app/(tabs)/my/wedding-settings.tsx`)에서 계속 고칠 수 있다. 순서와 개수는
 * `features/onboarding/flow.ts`가 정한다.
 *
 * **큰 질문 하나 = Step 하나.** 순서·건너뛰기는 전부 `features/onboarding/flow.ts`가
 * 정하고 이 화면은 그 답을 그린다.
 *
 * **답 요약 줄(«라벨 · 값 · 바꾸기»)은 없다**(2026-09-15 대표 지시 「온보딩에 바꾸기
 * 정보 삭제해. 버튼 CTA는 하단에 유지한다」). 답한 질문이 화면 아래에 쌓이던
 * 은행앱 방식(v3.19)과 SPEC §13.6의 «「바꾸기」 동작 정의»가 이 지시로 폐기됐다 —
 * 되돌아가는 길은 «이전»이다. **하단 CTA는 그대로다.**
 *
 * **상단 뒤로가기가 없다.** 첫 질문은 «다음»만, 두 번째부터 «이전 · 다음».
 * 안드로이드 물리 뒤로가기는 «이전»과 같고 첫 질문에서는 로그인으로 나간다.
 *
 * **미정을 억지로 받지 않는다.** 예식일 · 지역 «아직 정하지 않았어요», 준비 현황
 * «아직 시작 전이에요», 예산 «아직 모르겠어요». 스타일만 최소 1개 필수다 — 추천의
 * 근거라 없으면 첫 화면에 보여줄 것이 없다. 최대 2개, 3번째는 추가하지 않고 토스트
 * «2개까지 고를 수 있어요»(SPEC §13.6 «선택 정책»). 3/3은 건너뛰지 않는다. 이미 고른
 * 스타일이 서버에 있으면(다시 들어온 계정) 초기화하지 않고 복원해서 보여준다.
 *
 * **스크롤은 화면 전체 하나다**(SPEC §13.5.5). 준비 현황이 뷰포트를 넘치면 화면이
 * 스크롤한다 — 목록 전용 스크롤을 두지 않는다. 3/3은 200 × 2행이라 스크롤이 없다.
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
 * 시안과 다른 값은 토큰이 이기는 곳뿐이다: CTA·입력칸 높이 52(size.ctaPrimary ·
 * size.field, 시안 56) · 15px 글자는 t6(16) · 13px은 t7(14).
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

  return value.district === null ? value.region : `${value.region} ${shortDistrictName(value.district)}`;
}

export default function SetupScreen() {
  const theme = useTheme();

  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [step, setStep] = useState<QuestionStep | 'done'>('date');
  /** 기기에 적어둔 답을 읽기 전에는 첫 질문을 그리지 않는다 — 잠깐 스쳤다 바뀌면 안 된다. */
  const [restored, setRestored] = useState(false);
  /** 서버에 이미 있는 스타일 — 3/3에 닿았을 때 아직 안 골랐으면 이걸로 복원한다. */
  const [seedStyle, setSeedStyle] = useState<readonly WeddingStyle[] | null>(null);
  /** 서버 응답이 올 때 이미 3/3에 있는지 보려고 지금 Step을 적어 둔다. */
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
     * 복원»). 3/3에 들어설 때 `enter`가 채우고, 응답이 늦어 이미 3/3에 있으면 여기서 채운다.
     * 못 읽으면 없는 것 — 그 앞에서는 채우지 않는다(채우면 3/3을 건너뛰게 된다).
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

  /** Step을 연다. 3/3에 처음 닿았고 서버에 고른 스타일이 있으면 그걸로 채운다. */
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
    /*
     * 준비 현황·예산은 3단계로 줄이면서 여기서 묻지 않는다(2026-09-14 대표 확정).
     * 초안의 칸은 그대로 두고 비워 보낸다 — 두 값은 MY의 웨딩 설정에서 채운다.
     */
    const draft = {
      weddingDate: source.date?.value ?? null,
      region: region === null ? null : combineRegion(region, source.region?.district ?? null),
      budgetBracket: null,
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
         * 순서를 바꾸면 예식일 저장이 거절된다. 필수 동의는 로그인 CTA의 안내로 이미
         * 받았다 — 여기서 서버에 기록한다. 나이는 보내지 않는다(로그인이 판정했다).
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

        /*
         * 준비 현황·예산은 키를 아예 보내지 않는다. 계약은 둘 다 선택 항목이라
         * (`completeSetupRequestSchema`) 빼도 되고, null을 보내면 MY에서 이미
         * 채워 둔 값을 지우게 된다.
         */
        await completeSetup({
          weddingDate: draft.weddingDate,
          region: draft.region,
          /* 계약은 최소 1개를 받는다 — 3/3은 건너뛰지 않으므로 늘 있지만, 없으면 키를 아예 보내지 않는다. */
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

      router.replace('/');
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

  /*
   * 결과 화면에서 «완료»를 누른 뒤. 여기서 가입과 초기 설정 두 번을 서버에 보내는데,
   * 그동안 화면에는 CTA가 눌리지 않는 것 말고 아무 표시가 없어 멈춘 것처럼 보였다.
   * WP-ST-015 추천 계산 화면을 띄운다 — 700ms 안에 끝나면 이것도 뜨지 않는다.
   *
   * **여기는 «오래 붙잡는» 기다림이다**(`features/loading/delayed-loader.tsx`의
   * `LoaderWait`). 계정을 만들고 설정을 올린 뒤 추천을 받아 홈으로 가는 길이라,
   * Depth 이동용 써클이 아니라 업종 순회를 그대로 쓴다.
   *
   * 3단계로 줄면서 준비 현황을 여기서 묻지 않으므로 뺄 업종이 없다 — 순회는
   * 열두 업종을 그대로 돈다. MY의 웨딩 설정에서 채운 값은 서버에 있고, 그쪽은
   * «나»의 스냅숏(`useCurrentUserSnapshot`)이 읽는다.
   */
  if (sending) {
    return <DelayedRecommendingView exclude={[]} />;
  }

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
  const chosenStyles = answers.style ?? [];
  const date = answers.date?.value ?? null;
  const dateUndecided = answers.date !== null && date === null;
  const regionUndecided = answers.region !== null && answers.region.region === null;

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
        <QuestionHead lines={STEP_TITLE_LINES[step]} description={stepDescription(step)} />

        {/*
          예식일 1/3 — 보기는 규격서의 65 줄(`OptionRow`). 피그마의 «2027년 1월 15일 · 2027년 상반기 ·
          아직 미정»은 시안용 가짜 값이라, 첫 줄이 날짜 선택(휠 시트 — 고르면 그 날짜가 줄에 선다)이고
          둘째 줄이 «아직 정하지 않았어요»다.
        */}
        {step === 'date' ? (
          <View style={styles.options}>
            <OptionRow
              label={date ? formatDateDot(date) : DATE_PICK_LABEL}
              selected={date !== null}
              onPress={() => setSheetOpen(true)}
            />
            <OptionRow
              label={UNDECIDED_LABEL}
              selected={dateUndecided}
              onPress={() => update({ date: { value: null } })}
            />
          </View>
        ) : null}

        {/*
          지역 2/3 — 예식일 1/3과 같은 두 줄이다. 첫 줄이 시트를 열고(시/도 · 시/군/구 휠 2열),
          둘째 줄이 «아직 정하지 않았어요»다. 2026-09-15 대표 지시로 줄 목록에서 시트로 바뀌었다.
        */}
        {step === 'region' ? (
          <View style={styles.options}>
            <OptionRow
              label={regionLabelOf(answers.region) ?? REGION_PICK_LABEL}
              selected={regionLabelOf(answers.region) !== null}
              onPress={() => setRegionSheetOpen(true)}
            />
            <OptionRow
              label={UNDECIDED_LABEL}
              selected={regionUndecided}
              onPress={() => update({ region: { region: null, district: null } })}
            />
          </View>
        ) : null}

        {/* 스타일 3/3 — 넷 중 1~2개(v3.24). 사진 타일은 규격서에 없어 65 줄로 바꿨고 파일은 지웠다. */}
        {step === 'style' ? (
          <View style={styles.options}>
            {WEDDING_STYLES.map((style) => (
              <OptionRow
                key={style}
                role="checkbox"
                label={WEDDING_STYLE_LABEL[style]}
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
      </StepFrame>

      <InlineToast toast={limitToast.toast} onHidden={limitToast.hide} />

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

const styles = StyleSheet.create({
  blank: { flex: 1 },
  /* 시안 padSec — 좌우 24 · 아래 24 · 사이 12. */
  section: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Layout.rowPaddingY,
  },
  /* 보기 묶음 — 규격서 «div 382×218 · mar 40 0 0 0», 줄 사이 «mar 0 0 12 0». 좌우는 화면 24. */
  options: {
    marginTop: Spacing.five + Spacing.two,
    paddingHorizontal: Layout.gutter,
    gap: Layout.inlineGap,
  },
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
