import type { Taste } from '@weddingpick/api-contract';
import {
  BUDGET_BRACKET_LABEL,
  REGION_DISTRICTS,
  TERMS,
  WEDDING_BUDGET_BRACKETS,
  WEDDING_DATE_HINT,
  WEDDING_REGIONS,
  combineRegion,
  dDay,
  formatWeddingDateLong,
  type WeddingBudgetBracket,
  type WeddingRegion,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { completeSetup, completeSignup, getCurrentUser, getSignupState, updateTaste } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';
import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Motion,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  WeddingCalendar,
  useTheme,
} from '@weddingpick/ui';
import { TASTE_SHORT_LABEL } from '@/features/home/taste';
import { TastePicker } from '@/features/home/taste-picker';
import { OnboardingProgress } from '@/features/onboarding/progress';
import { saveWeddingDraft } from '@/features/onboarding/wedding-draft';

/** 예식일 · 지역 · 예산, 이 순서로 한 화면에서 이어 묻는다. 디자인 핸드오프 v3.14 WP-APP-020. */
type QuestionIndex = 0 | 1 | 2;
/** 질문 화면(WP-APP-020) · 취향 화면(WP-APP-021) · 완료(WP-APP-022). */
type Screen = 'questions' | 'taste' | 'done';

/** 질문이 열릴 때마다 진행바가 이 값으로 채워진다(시안 8%→38%→68%). */
const QUESTION_PROGRESS: Record<QuestionIndex, number> = { 0: 8, 1: 38, 2: 68 };

/**
 * 예식일 칩은 «아직 미정이에요» 하나뿐이다(2026-09-08 결정). 시안의 «봄»·«가을»
 * 칩은 뺐다 — "다가오는 그 계절"을 오늘 기준으로 계산하면 9월에 접속한 사람에게
 * 5주 뒤 가을 예식을 권하게 되어 기준이 애매했다.
 *
 * 누르면 **날짜 없이 다음 질문으로 간다.** 예식일은 비워둘 수 있다
 * (`completeSetupRequestSchema.weddingDate` nullable) — 홈은 lifecycle의
 * «기대반 설렘반 / 아직 예식일이 없어요»로 부른다. 달력을 열지 않는다.
 */
const UNDECIDED_LABEL = '아직 미정이에요';

/**
 * 초기 설정. 디자인 핸드오프 v3.14 20-onboarding-v2.dc.html(WP-APP-020~022).
 * 문구는 `spec/strings.ko.json` `onboarding.*`의 확정 카피다.
 *
 * **4단계 → 2단계.** 예식일 · 지역 · 예산은 목록에서 하나 고르는 같은 성격이라
 * 한 화면(WP-APP-020)에서 이어 묻는다. 값을 고르면 그 질문이 위로 접혀 한 줄
 * (`AnsweredRow`)이 되고 다음 질문이 열린다 — `active`가 지금 열려 있는 질문을
 * 가리킨다. 취향(WP-APP-021)은 사진을 훑는 다른 성격이라 화면을 나눈다.
 *
 * **되돌아가기는 「바꾸기」로 한다.** 뒤로가기로 화면을 되감지 않는다 — 상단
 * 뒤로가기는 온보딩 전체를 나가 로그인으로 돌아가는 데만 쓴다(v3.14 README
 * "구현 주의 2").
 *
 * **화면은 디자인이 내려준 값대로만 만든다.** 서버의 필드 모양이나 응답
 * 목록이 화면의 선택지·입력 방식·문구를 정하지 않는다 — 예산은 시안의 다섯
 * 구간이고, 지역은 시안의 아홉 칩이다. 서버는 화면이 보내는 값을 받아들이도록
 * 맞춘다(`packages/domain` budget-bracket · wedding-region).
 *
 * **만 14세 확인은 여기 없다.** v3.13부터 로그인 화면(WP-AUTH-001)의 체크박스
 * 하나로 끝난다 — 체크하지 않으면 카카오 로그인 자체가 시작되지 않으므로
 * (`login/index.tsx`), 이 화면에 닿았다는 것 자체가 이미 확인을 마쳤다는
 * 뜻이다. `completeSignup`에는 그래서 `ageVerified: true`를 그대로 보낸다.
 *
 * 2026-09-04 정책 변경(비회원 진입 삭제)으로 이 화면은 **로그인 뒤**에 온다.
 * 그래도 기기에 적어두는 경로를 남겨둔다 — 토큰이 없는 상태로 여기에 닿으면
 * 값을 잃는 대신 적어두고 다음 로그인에 올린다.
 *
 * 시안과 다른 값은 토큰이 이기는 곳뿐이다: CTA·입력칸 높이 52(size.ctaPrimary ·
 * size.field, 시안 56) · 칩 높이 36(size.chip, 시안 40) · 상단 바 좌우 24(gutter,
 * 시안 좌 12). 예산 제목의 «어느 정도»는 §3 금지어라 «얼마나»로 적는다.
 */
export default function SetupScreen() {
  const theme = useTheme();

  const [screen, setScreen] = useState<Screen>('questions');
  const [active, setActive] = useState<QuestionIndex>(0);

  const [date, setDate] = useState<string | null>(null);
  /** «아직 미정이에요»를 골랐는가. 날짜 없이 답한 것이라 안 고른 것(둘 다 없음)과 다르다. */
  const [undecided, setUndecided] = useState(false);
  const [region, setRegion] = useState<WeddingRegion | null>(null);
  /** 구·군. 시/도를 더 좁힌다. 고르지 않아도 다음으로 갈 수 있다. */
  const [district, setDistrict] = useState<string | null>(null);
  /** 다섯 구간 중 하나. `아직 모르겠어요`도 고른 것이다 — 안 고른 것(null)과 다르다. */
  const [bracket, setBracket] = useState<WeddingBudgetBracket | null>(null);
  const [tastes, setTastes] = useState<Taste[]>([]);
  const [name, setName] = useState<string | null>(null);
  /** 가입이 아직 안 끝난 계정인가 — 그러면 답을 다 받은 뒤 가입부터 마친다. */
  const [needsSignup, setNeedsSignup] = useState(false);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isServerConfigured) return;

    void getSignupState()
      .then((state) => setNeedsSignup(!state.activated))
      .catch(() => undefined);
  }, []);

  /** 값을 고르면 다음 질문이 열린다 — 예산(마지막 질문)만 「다음」을 눌러야 넘어간다. */
  function answer(index: QuestionIndex) {
    if (index < 2) setActive((index + 1) as QuestionIndex);
  }

  function reopen(index: QuestionIndex) {
    setError(null);
    setActive(index);
  }

  function toggleTaste(taste: Taste) {
    setTastes((current) =>
      current.includes(taste) ? current.filter((one) => one !== taste) : [...current, taste]
    );
  }

  const canAdvance =
    active === 0 ? date !== null || undecided : active === 1 ? region !== null : bracket !== null;

  async function finish() {
    if (sending || region === null || (date === null && !undecided)) return;

    setSending(true);
    setError(null);

    try {
      const draft = {
        weddingDate: date,
        region: combineRegion(region, district),
        budgetBracket: bracket,
      };

      if (isServerConfigured && (await loadToken())) {
        /*
         * 가입을 먼저 끝낸다. 서버는 살아 있지 않은 계정의 다른 경로를 전부 막으므로
         * 순서를 바꾸면 예식일 저장이 거절된다. 만 14세 확인은 로그인 화면에서 이미
         * 끝났고 필수 동의도 로그인 CTA의 안내로 이미 받았다 — 여기서 서버에 기록한다.
         */
        if (needsSignup) {
          await completeSignup({ ageVerified: true, consents: ['terms', 'privacy'] });
        }
        await completeSetup(draft);
        /*
         * 취향은 실패해도 온보딩을 되돌리지 않는다. 예식일과 지역이 올라갔는데
         * 취향 한 번 못 보냈다고 처음부터 다시 시키면 사용자는 같은 답을 여러 번
         * 더 하게 된다. 못 보낸 것은 MY에서 다시 고를 수 있다.
         */
        await updateTaste(tastes).catch(() => undefined);
        await getCurrentUser()
          .then((me) => setName(me.displayName ?? null))
          .catch(() => undefined);
      } else {
        await saveWeddingDraft(draft);
      }

      setScreen('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  if (screen === 'done') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.doneContent}>
            <DoneMark />

            <ThemedView style={styles.headline}>
              <ThemedText type="t2">준비 끝났어요</ThemedText>
              <ThemedText type="t2">{name ? `${name}님 웨딩을 시작해요` : '웨딩을 시작해요'}</ThemedText>
            </ThemedView>

            <ThemedView style={[styles.summary, { backgroundColor: theme.backgroundElement }]}>
              <SummaryRow
                label="예식일"
                value={date !== null ? formatWeddingDateLong(date) : UNDECIDED_LABEL}
              />
              <SummaryRow label="지역" value={district ? `${region} ${district}` : (region ?? '')} />
              <SummaryRow label="총예산" value={BUDGET_BRACKET_LABEL[bracket ?? 'unknown']} />
              <SummaryRow
                label="취향"
                last
                value={
                  tastes.length === 0
                    ? '고르지 않았어요'
                    : tastes.map((taste) => TASTE_SHORT_LABEL[taste]).join(' · ')
                }
              />
            </ThemedView>

            <ThemedView style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="t5">MY에서 언제든 바꿀 수 있어요</ThemedText>
              <ThemedText type="t6" themeColor="textSecondary">
                내 웨딩 정보를 바꾸면 추천도 새로 반영돼요
              </ThemedText>
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

  const progress = screen === 'taste' ? 100 : QUESTION_PROGRESS[active];
  const label = screen === 'taste' ? '2/2' : '1/2';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* 뒤로가기는 화면을 되감지 않는다 — 온보딩 전체를 나가 로그인으로 간다. */}
        <OnboardingProgress progress={progress} label={label} onBack={() => router.replace('/login')} />

        {screen === 'taste' ? (
          /*
           * 취향 화면은 스크롤하지 않는다 — 격자가 남는 높이를 나눠 갖는다
           * (`TastePicker fill`). 사진 여섯 장이 한 눈에 들어와야 훑는 화면이다.
           */
          <View style={[styles.content, styles.contentTaste, styles.fill]}>
            <ThemedView style={styles.headline}>
              <ThemedText type="t2">마음에 드는 분위기를</ThemedText>
              <ThemedText type="t2">골라주세요</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                2장 이상 고르면 더 정확해져요
              </ThemedText>
            </ThemedView>

            <TastePicker chosen={tastes} onToggle={toggleTaste} fill />

            {error ? (
              <ThemedText type="t7" themeColor="negative">
                {error}
              </ThemedText>
            ) : null}
          </View>
        ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {screen === 'questions' ? (
            <ThemedView style={styles.list}>
              {active > 0 && (date !== null || undecided) ? (
                <AnsweredRow
                  label="예식일"
                  value={date !== null ? formatWeddingDateLong(date) : UNDECIDED_LABEL}
                  onPress={() => reopen(0)}
                />
              ) : null}
              {active > 1 && region !== null ? (
                <AnsweredRow
                  label="지역"
                  value={district ? `${region} ${district}` : region}
                  onPress={() => reopen(1)}
                />
              ) : null}
            </ThemedView>
          ) : null}

          {screen === 'questions' && active === 0 ? (
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
                    borderColor: date ? theme.tint : theme.fieldBorder,
                  },
                ]}>
                <ThemedText
                  type="t5"
                  numeric
                  themeColor={date ? 'text' : 'textAssistive'}
                  style={date ? undefined : styles.regular}>
                  {date ? formatWeddingDateLong(date) : '예식일을 선택해주세요'}
                </ThemedText>
              </Pressable>

              <ThemedView style={styles.chips}>
                <Chip
                  label={UNDECIDED_LABEL}
                  selected={undecided}
                  onPress={() => {
                    /* 날짜 없이 답한 것이다 — 달력을 열지 않고 다음 질문으로 간다. */
                    setDate(null);
                    setUndecided(true);
                    answer(0);
                  }}
                />
              </ThemedView>
            </>
          ) : null}

          {screen === 'questions' && active === 1 ? (
            <>
              <ThemedView style={styles.headline}>
                <ThemedText type="t2">어디에서 하시나요?</ThemedText>
                <ThemedText type="body" themeColor="textSecondary">
                  그 지역의 {TERMS.verifiedData}로 맞춰드려요
                </ThemedText>
              </ThemedView>

              <ThemedView style={styles.chips}>
                {WEDDING_REGIONS.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={region === item}
                    onPress={() => {
                      setRegion(item);
                      setDistrict(null);
                      answer(1);
                    }}
                  />
                ))}
              </ThemedView>

              {region && REGION_DISTRICTS[region] ? (
                <ThemedView style={styles.list}>
                  {REGION_DISTRICTS[region]!.map((item) => (
                    <DistrictRow
                      key={item}
                      label={item}
                      selected={district === item}
                      onPress={() => {
                        setDistrict(district === item ? null : item);
                        answer(1);
                      }}
                    />
                  ))}
                </ThemedView>
              ) : null}
            </>
          ) : null}

          {screen === 'questions' && active === 2 ? (
            <>
              <ThemedView style={styles.headline}>
                <ThemedText type="t2">예산은 얼마나</ThemedText>
                <ThemedText type="t2">생각하세요?</ThemedText>
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

          {error ? (
            <ThemedText type="t7" themeColor="negative">
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>
        )}

        <ThemedView style={styles.footer}>
          {screen === 'questions' ? (
            <ActionButton
              variant="primary"
              size="xlarge"
              label="다음"
              disabled={!canAdvance}
              onPress={() => (active < 2 ? answer(active) : setScreen('taste'))}
            />
          ) : (
            /* 취향은 건너뛸 수 없다(v3.14) — 추천의 근거라 최소 1장은 받는다. */
            <ActionButton
              variant="primary"
              size="xlarge"
              label={`${tastes.length}개 고르고 시작하기`}
              disabled={tastes.length === 0 || sending}
              onPress={() => void finish()}
            />
          )}
        </ThemedView>
      </SafeAreaView>

      <Modal visible={calendarOpen} transparent animationType="slide">
        <ThemedView style={[styles.scrim, { backgroundColor: theme.scrim }]}>
          <ThemedView style={styles.sheet}>
            <ThemedText type="t3">예식일 선택</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {pending ? dDay(pending).text : WEDDING_DATE_HINT}
            </ThemedText>

            <WeddingCalendar value={pending} onChange={setPending} />

            <ThemedView style={styles.sheetActions}>
              <ActionButton label="취소" onPress={() => setCalendarOpen(false)} />
              <ActionButton
                variant="primary"
                label="완료"
                disabled={pending === null}
                onPress={() => {
                  setDate(pending);
                  setUndecided(false);
                  setCalendarOpen(false);
                  answer(0);
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
 * 답을 마친 질문 한 줄. 시안 20-onboarding-v2 answeredRow — 코랄 체크 원 ·
 * 라벨 · 값(말줄임) · 「바꾸기」. 누르면 그 질문이 다시 펼쳐진다(뒤로가기가
 * 아니라 이 줄이 되돌아가는 유일한 길이다).
 */
function AnsweredRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const scale = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(scale, {
      toValue: 1,
      duration: Motion.checkPop.duration,
      easing: Easing.bezier(...Motion.checkPop.bezier),
      useNativeDriver: true,
    }).start();
  }, [scale]);

  return (
    <View style={styles.answeredRow}>
      <Animated.View
        style={[styles.answeredCheck, { backgroundColor: theme.tint, transform: [{ scale }] }]}>
        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
          <Path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke={theme.onTint}
            strokeWidth={3.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
      <ThemedText type="t6" themeColor="textAssistive">
        {label}
      </ThemedText>
      <ThemedText type="t6" numeric numberOfLines={1} style={[styles.bold, styles.answeredValue]}>
        {value}
      </ThemedText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} 바꾸기`} onPress={onPress} hitSlop={8}>
        <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
          바꾸기
        </ThemedText>
      </Pressable>
    </View>
  );
}

/**
 * 칩 하나. 예식일 힌트(가로 3개)와 지역 시/도(가로 9개)가 함께 쓴다 — 시안
 * 20-onboarding-v2 chip() — 채움형, 16px 700, 미선택 gray100/ink2, 선택 코랄/흰색.
 * 높이만 시안 40이 아니라 토큰 size.chip 36이다.
 */
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? theme.tint : theme.backgroundSelected }]}>
      <ThemedText type="t6" themeColor={selected ? 'onTint' : 'textStrong'} style={styles.bold}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/**
 * 구·군 한 줄. 왼쪽 이름, 오른쪽 24px 표시 원, 아래 1px 구분선. 다시 누르면
 * 선택이 풀린다 — 구까지는 참고일 뿐 필수가 아니다.
 */
function DistrictRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}>
      <View style={styles.row}>
        <ThemedText type="t5" style={selected ? undefined : styles.regular}>
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

/**
 * 예산 구간 한 줄. 왼쪽 라벨(+선택 시 보조 설명), 오른쪽 24px 동그라미 표시,
 * 아래 1px 구분선. `아직 모르겠어요`만 늘 옅다(textAssistive).
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
  /* 실측 없는 구간별 통계는 지어내지 않는다(§1 "판단 근거가 없으면 추천하지 않는다") —
     시안이 고정 문구로 두는 «아직 모르겠어요»만 보조 설명을 단다. */
  const meta = bracket === 'unknown' ? '나중에 정해도 괜찮아요' : null;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.budgetLabel}>
          <ThemedText
            type="t5"
            themeColor={bracket === 'unknown' ? 'textAssistive' : 'text'}
            style={selected ? undefined : styles.regular}>
            {label}
          </ThemedText>
          {meta ? (
            <ThemedText type="t7" numeric themeColor="textAssistive">
              {meta}
            </ThemedText>
          ) : null}
        </View>
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

/** 완료 화면 체크 원. 진입할 때 한 번 튄다 — spec/tokens.json motion.checkPop. */
function DoneMark() {
  const theme = useTheme();
  const scale = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(scale, {
      toValue: 1,
      duration: Motion.checkPop.duration,
      easing: Easing.bezier(...Motion.checkPop.bezier),
      useNativeDriver: true,
    }).start();
  }, [scale]);

  return (
    <Animated.View
      style={[styles.doneMark, { backgroundColor: theme.tint, transform: [{ scale }] }]}>
      <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
        <Path
          d="m5 12.5 4.5 4.5L19 7.5"
          stroke={theme.onTint}
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * 요약 한 줄. 카드 안에 다시 상자를 그리지 않는다 — `ThemedView`는 바탕색을
 * 칠하므로 카드 안에서 쓰면 이중 박스가 된다. 행 사이는 1px 선으로만 가른다.
 */
function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.summaryRow,
        !last && { borderBottomWidth: 1, borderBottomColor: theme.border },
      ]}>
      <ThemedText type="t6" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="t6" numeric numberOfLines={1} style={[styles.bold, styles.summaryValue]}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  content: {
    paddingTop: Layout.rowPaddingY,
    paddingHorizontal: Layout.gutter,
    gap: Spacing.four,
  },
  /* 취향 화면만 제목 블록과 격자 사이가 20이다. */
  contentTaste: { gap: Layout.gapHeadlineGrid, paddingBottom: Spacing.two },
  fill: { flex: 1 },
  /* 제목과 서브카피 사이 8. */
  headline: { gap: Spacing.two },

  /* 답을 마친 질문 줄. 체크 20 · 라벨 15 · 값 15/700 · 바꾸기 14/700. */
  answeredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: Layout.touchTarget,
  },
  answeredCheck: {
    width: 20,
    height: 20,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answeredValue: { flex: 1 },

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

  /* 칩 사이 8 — spacing.gapChip. 칩은 토큰 size.chip 36 · 좌우 16 · pill. */
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    height: Layout.chip,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 목록. 행 사이 2 · 행 최소 56 · 상하 12 · 아래 1px 선. */
  list: { gap: Spacing.half },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.rowMinHeight,
    paddingVertical: Layout.rowPaddingY,
  },
  budgetLabel: { flex: 1, gap: 2 },
  mark: {
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1 },

  /* 하단 CTA. 시안 고정 108 = 24 + CTA 52 + 32(padding 0 24 32). */
  footer: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
  },

  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: Layout.gutter,
    gap: Spacing.two,
  },
  sheetActions: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end' },

  /* 완료 화면. 상단 56(내비게이션 바 자리) · 블록 사이 28. */
  doneContent: {
    paddingTop: Layout.navBar,
    paddingHorizontal: Layout.gutter,
    gap: Layout.sectionGap,
  },
  doneMark: {
    width: Spacing.six,
    height: Spacing.six,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 요약 카드. radius.card 10 · 안쪽 20. 행은 1px 선으로만 가른다 — 안쪽 상자 없음. */
  summary: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Layout.summaryRowPaddingY,
  },
  summaryValue: { flexShrink: 1, textAlign: 'right' },
  /* 안내 카드 — MY에서 바꿀 수 있다는 안내. radius.card 10 · 안쪽 20 · 행 사이 8. */
  note: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Spacing.two,
  },
});
