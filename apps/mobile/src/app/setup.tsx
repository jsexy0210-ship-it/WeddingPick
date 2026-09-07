import type { Taste } from '@weddingpick/api-contract';
import {
  BUDGET_BRACKET_LABEL,
  MINIMUM_AGE,
  REGION_DISTRICTS,
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
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  completeSetup,
  completeSignup,
  getCurrentUser,
  getSignupState,
  updateTaste,
} from '@/api/client';
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

/** 한 화면에 하나씩 묻는다. 디자인 핸드오프 WP-APP-008~012. */
const STEPS = 4;

/** 아직 지나지 않은 다음 그 계절의 연도. 예: 지금이 11월이면 봄쯤은 내년이다. */
function nextSeasonYear(month: number): number {
  const now = new Date();

  return now.getMonth() + 1 <= month ? now.getFullYear() : now.getFullYear() + 1;
}

/**
 * 시안 #11d의 dateHints 3행. 시안은 예시 연도를 "2027년"으로 박아뒀지만, 실제
 * 화면은 오늘 기준으로 계산해야 한다 — 그대로 옮기면 그 해가 지나고 나서도
 * "2027년 봄쯤"이라고 말하게 된다.
 *
 * 계약(`completeSetupRequestSchema.weddingDate`)이 날짜를 필수로 받기 때문에,
 * "아직 정하지 않았어요"는 값을 비워두는 대신 달력을 그대로 연다 — 시안에 없는
 * 값을 지어내 보내지 않는다. 나머지 둘은 그 계절 중순으로 채우고, 달력에서
 * 다시 고를 수 있다.
 */
function dateHints(): { name: string; sub: string; pick: (() => string) | null }[] {
  const spring = nextSeasonYear(4);
  const fall = nextSeasonYear(10);

  return [
    { name: '아직 정하지 않았어요', sub: '나중에 입력', pick: null },
    { name: `${spring}년 봄쯤 생각 중`, sub: '3~5월', pick: () => `${spring}-04-15` },
    { name: `${fall}년 가을쯤 생각 중`, sub: '9~11월', pick: () => `${fall}-10-15` },
  ];
}

/**
 * 온보딩. 디자인 핸드오프 01-onboarding.dc.html #11d·#11e(WP-APP-008~012).
 * 문구는 `spec/strings.ko.json` `onboarding.*`의 확정 카피다.
 *
 * **화면은 디자인이 내려준 값대로만 만든다.** 서버의 필드 모양이나 응답 목록이
 * 화면의 선택지·입력 방식·문구를 정하지 않는다 — 예산은 시안의 다섯 구간이고,
 * 지역은 시안의 아홉 칩이다(업체가 있는 시도만 보여주지 않는다). 서버는 화면이
 * 보내는 값을 받아들이도록 맞춘다(`packages/domain` budget-bracket · wedding-region).
 *
 * 받는 것은 **예식일 · 지역 · 총예산 · 분위기** 넷이다. 이름은 받지 않는다 —
 * v3.10이 닉네임을 최초 필수입력에서 뺐다. 한 화면에 하나씩 묻는다 — 넷을 한
 * 장에 몰아넣으면 첫 화면이 설문지처럼 보이고, 그때 사람들은 창을 닫는다.
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

  const [step, setStep] = useState(1);
  const [date, setDate] = useState<string | null>(null);
  const [region, setRegion] = useState<WeddingRegion | null>(null);
  /** 구·군. 시안 #11d districts — 시/도를 더 좁힌다. 고르지 않아도 다음으로 갈 수 있다. */
  const [district, setDistrict] = useState<string | null>(null);
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
      const draft = {
        weddingDate: date,
        region: combineRegion(region, district),
        budgetBracket: bracket,
      };

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
            <DoneMark />

            <ThemedView style={styles.headline}>
              <ThemedText type="t2">준비 끝났어요</ThemedText>
              <ThemedText type="t2">{name ? `${name}님 웨딩을 시작해요` : '웨딩을 시작해요'}</ThemedText>
            </ThemedView>

            <ThemedView style={[styles.summary, { backgroundColor: theme.backgroundElement }]}>
              <SummaryRow label="예식일" value={formatWeddingDateLong(date ?? '')} />
              <SummaryRow label="지역" value={district ? `${region} ${district}` : (region ?? '')} />
              <SummaryRow label="총예산" value={BUDGET_BRACKET_LABEL[bracket ?? 'unknown']} />
              <SummaryRow
                label="취향"
                value={
                  tastes.length === 0
                    ? '고르지 않았어요'
                    : tastes.map((taste) => TASTE_SHORT_LABEL[taste]).join(' · ')
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
          onBack={
            step > 1
              ? () => {
                  setError(null);
                  setStep(step - 1);
                }
              : undefined
          }
        />

        <ScrollView contentContainerStyle={[styles.content, step === 4 && styles.contentTaste]}>
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
                        borderColor: birthOk && birth ? theme.tint : theme.fieldBorder,
                      },
                    ]}
                  />
                  <ThemedText type="t7" themeColor="textAssistive">
                    {`만 ${MINIMUM_AGE}세부터 이용할 수 있어요. 나이를 확인하는 데만 써요`}
                  </ThemedText>
                </ThemedView>
              ) : null}

              <ThemedView style={styles.list}>
                {dateHints().map((hint) => (
                  <DateHintRow
                    key={hint.name}
                    hint={hint}
                    onPress={() => {
                      if (hint.pick === null) {
                        setPending(date);
                        setCalendarOpen(true);

                        return;
                      }

                      setDate(hint.pick());
                    }}
                  />
                ))}
              </ThemedView>
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

              <ThemedView style={styles.chips}>
                {WEDDING_REGIONS.map((item) => (
                  <RegionChip
                    key={item}
                    label={item}
                    selected={region === item}
                    onPress={() => {
                      setRegion(item);
                      setDistrict(null);
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
                      onPress={() => setDistrict(district === item ? null : item)}
                    />
                  ))}
                </ThemedView>
              ) : null}
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
            label={step < STEPS ? '다음' : `${tastes.length}개 고르고 시작하기`}
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

/** 예식일 힌트 한 줄. 시안 #11d — 왼쪽 이름, 오른쪽 보조 문구, 아래 1px 구분선. */
function DateHintRow({
  hint,
  onPress,
}: {
  hint: { name: string; sub: string };
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={hint.name} onPress={onPress}>
      <View style={styles.row}>
        <ThemedText type="t5" style={styles.regular}>
          {hint.name}
        </ThemedText>
        <ThemedText type="t6" numeric themeColor="textAssistive">
          {hint.sub}
        </ThemedText>
      </View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
    </Pressable>
  );
}

/**
 * 구·군 한 줄. 시안 #11d districts — 왼쪽 이름, 오른쪽 24px 표시 원, 아래 1px 구분선.
 * 다시 누르면 선택이 풀린다 — 구까지는 참고일 뿐 필수가 아니다.
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
 * 지역 칩. 시안 #11d chip() — 채움형, 16px 700, 미선택 gray100/ink2, 선택 코랄/흰색.
 * 높이만 시안 40이 아니라 토큰 size.chip 36이다.
 */
function RegionChip({
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

  /* 시안 #11d·#11e: padding 12 24 0 · 블록 사이 24. 아래 여백은 footer가 맡는다. */
  content: {
    paddingTop: Layout.rowPaddingY,
    paddingHorizontal: Layout.gutter,
    gap: Spacing.four,
  },
  /* 4/4만 제목 블록과 격자 사이가 20이다(#11e). */
  contentTaste: { gap: Layout.gapHeadlineGrid },
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
    gap: Layout.sectionGap,
  },
  doneMark: {
    width: Spacing.six,
    height: Spacing.six,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 요약 카드. radius.card 10 · 안쪽 20 · 행 사이 2 · 행 상하 9. */
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
  summaryValue: { flexShrink: 1, textAlign: 'right' },
});
