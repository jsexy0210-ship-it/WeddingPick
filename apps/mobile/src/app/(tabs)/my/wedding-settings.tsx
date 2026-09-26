import type { CurrentUser } from '@weddingpick/api-contract';
import {
  WEDDING_REGIONS,
  WEDDING_STYLE_LABEL,
  combineRegion,
  formatDateDot,
  regionTokens,
  type VendorCategory,
  type WeddingRegion,
  type WeddingStyle,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Border,
  ErrorView,
  Layout,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  Toast,
  useTheme,
} from '@weddingpick/ui';
import { ApiError, completeSetup, getCurrentUser } from '@/api/client';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { useDepthBack } from '@/features/navigation/depth-back';
import { DateWheelSheet, OptionWheelSheet } from '@/features/common/wheel-picker-sheet';
import { firstSelectable, toIso, YEAR_SPAN } from '@/features/onboarding/calendar';
import { UNDECIDED_LABEL } from '@/features/onboarding/flow';
import { RegionPickerSheet, type PickedRegion } from '@/features/onboarding/region-picker-sheet';
import { NoteBox, Section, SubScreen, SubScreenStatus } from '@/features/settings/my-kit';
import { StylePickSheet } from '@/features/settings/style-pick-sheet';
import {
  prepCategoriesFromKey,
  prepComboKeyOf,
  prepOptions,
  prepValueLabel,
} from '@/features/settings/wedding-setting-options';

/** 준비 현황이 받는 업종 — 계약이 «기타»를 받지 않는다(`preparationCategorySchema`). */
type PreparedCategory = Exclude<VendorCategory, 'etc'>;

/** `docs/design/React_Native/my.jsx` WP-MY-003 · `spec/strings.ko.json` `my.setting.*`. */
const S = {
  title: '내 웨딩설정',
  date: '예식일',
  region: '지역',
  style: '스타일',
  prepared: '준비 현황',
  /*
   * 휠 시트 제목 — 예식일 · 지역은 이미 쓰던 것(지역은 정본 home.jsx:247 「지역 선택」),
   * 나머지 둘은 같은 꼴로 지었다(정본에 이 화면의 시트 그림이 없다 — DESIGN_UNRESOLVED).
   */
  dateTitle: '예식일 선택',
  prepTitle: '준비 현황 선택',
  styleTitle: '스타일 선택',
  /** 예식일이 지난 상태(운영 데이터 상태). */
  passed: '지났어요',
  none: '아직 안 골랐어요',
  saved: '설정을 바꿨어요',
  /* 정본 my.jsx frame-003 noteBox(my.jsx:186). */
  noteTitle: '바꾸면 추천이 다시 계산돼요',
  noteBody: '지금까지 고른 곳과 지출 기록은 그대로 남아요.',
  loadError: '지금 설정을 불러오지 못했어요',
  saveError: '바꾸지 못했어요',
} as const;

/** 지금 열린 휠 시트. 한 번에 하나만 연다 — «한 항목씩 고친다»가 이 화면의 규칙이다. */
type Sheet = 'date' | 'region' | 'prepared' | 'style' | null;

/**
 * 내 웨딩설정 · WP-MY-003 · `docs/design/React_Native/my.jsx` 프레임 3. 한 카드에 네 행
 * (예식일 · 지역 · 준비 현황 · 스타일) — 시안 `weddingSet` 순서 그대로다.
 *
 * **예산 행은 뺐다**(2026-09-26 대표 지시 「MY 내 웨딩설정에서 예산은 삭제한다」). 정본
 * weddingSet에는 «예산»이 있지만 대표 지시가 이긴다. 저장 요청은 `budgetBracket` 키를 아예
 * 보내지 않는다 — 서버는 키가 없으면 적어 둔 예산을 건드리지 않는다
 * (`apps/api/src/test/setup.test.ts` 「예산을 안 보내면 건드리지 않는다」). 온보딩 4/5에서 고른
 * 예산은 그대로 남는다.
 *
 * 이 화면이 생기기 전에는 MY의 «내 웨딩 설정»이 온보딩 5문항(`/setup`)을 통째로 다시 열었다 —
 * 예식일 하나 고치러 다섯 질문을 다시 지나야 했다. 여기서는 행을 눌러 그 항목만 고친다.
 *
 * **행을 누르면 전부 휠 바텀시트가 뜬다**(2026-09-26 대표 지시 「모든 항목 휠 바텀시트 ·
 * 날짜 외에는 1열 휠」). 그 전에는 지역 · 준비 현황이 행 아래에 온보딩 부품을 펼쳤고,
 * 스타일은 `/my/taste`로 넘어갔다.
 *
 *   예식일     공용 날짜 휠(`DateWheelSheet` · 년 · 월 · 일 3열) — 그대로
 *   지역       온보딩 지역 휠(`RegionPickerSheet`) — 정본 home.js:712~714 `wheels`가 시/도 ·
 *              시/군/구 **두 열**이다. 1열로 줄이면 구를 고를 길이 없어 적어 둔 구가 사라진다.
 *   준비 현황  1열 휠(`OptionWheelSheet`) — 보기는 `wedding-setting-options.ts`
 *   스타일     휠이 아니다 — 다중 선택 시트(`StylePickSheet`). 2026-09-26 대표 지시 「개수제한
 *              없다」로 1~4개를 고르는데, 1열 휠은 하나만 가리킨다.
 *
 * 저장은 시트의 「확인」을 누를 때 한 번 한다(`/v1/me/setup`) — 굴리기만 하고 닫으면 그대로다.
 * 저장 버튼을 화면에 따로 두지 않는 이유는 항목이 서로 얽히지 않기 때문이다. 요청은 `queue`로
 * 줄을 세워 연달아 고친 순서대로 나간다.
 *
 * `/my/taste`(WP-MY-014 스타일 다시 고르기)는 지우지 않는다 — 저장된 링크가 열 수 있다.
 */
/** 예식일로 고를 수 있는 범위 — 온보딩과 같다. 과거는 안 되고(내일부터) 올해부터 5년 뒤 12월 31일까지. */
function weddingDateRange(today: Date): { min: string; max: string } {
  const first = firstSelectable(today);

  return { min: toIso(first.year, first.month, first.day), max: toIso(today.getFullYear() + YEAR_SPAN - 1, 12, 31) };
}

export default function WeddingSettingsScreen() {
  const theme = useTheme();
  const depthBack = useDepthBack();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);

  /** 저장 요청 줄. 연달아 누른 것이 순서대로 나가고, 앞의 것이 끝나야 뒤의 것이 나간다. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const optimistic = useRef<CurrentUser | null>(null);

  useEffect(() => {
    void getCurrentUser()
      .then((next) => {
        optimistic.current = next;
        setMe(next);
      })
      .catch((caught: Error) => setError(caught.message ?? S.loadError));
  }, []);

  if (error) return <SubScreenStatus title={S.title}><ErrorView message={error} onBack={depthBack} /></SubScreenStatus>;
  if (me === null) return <SubScreenStatus title={S.title}><DelayedLoadingView /></SubScreenStatus>;

  const current = me;

  /**
   * 고친 항목 하나만 보낸다. 예식일 · 지역은 계약이 늘 요구하므로 지금 값을 그대로 돌려보내고
   * (지우지 않는다), 준비 현황 · 스타일은 키를 안 보내면 서버가 건드리지 않는다. 예산은 이 화면이
   * 다루지 않으므로 키를 한 번도 보내지 않는다 — 서버에 적힌 값이 그대로 남는다.
   */
  function save(patch: {
    weddingDate?: string | null;
    region?: string | null;
    preparedCategories?: PreparedCategory[];
    styleTags?: WeddingStyle[];
  }) {
    /* 화면을 먼저 바꾼다 — 눌렀는데 아무 일도 안 일어나는 순간을 만들지 않는다. */
    const next = { ...(optimistic.current ?? current), ...patch };
    optimistic.current = next;
    setMe(next);

    queue.current = queue.current
      .then(() =>
        completeSetup({
          weddingDate: next.weddingDate,
          region: next.region,
          ...(patch.preparedCategories !== undefined && {
            preparedCategories: patch.preparedCategories,
          }),
          ...(patch.styleTags !== undefined && { styleTags: patch.styleTags }),
        })
      )
      .then((saved) => {
        if (optimistic.current === next) {
          optimistic.current = saved;
          setMe(saved);
          setToast(S.saved);
        }
      })
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace('/login');
          return undefined;
        }
        /* 못 바꿨으면 서버가 아는 값으로 되돌린다 — 화면만 바뀐 채로 두지 않는다. */
        if (optimistic.current === next) {
          setToast(caught instanceof Error ? caught.message : S.saveError);
        }
        return getCurrentUser()
          .then((saved) => {
            if (optimistic.current === next) {
              optimistic.current = saved;
              setMe(saved);
            }
          })
          .catch(() => undefined);
      });
  }

  const today = new Date().toISOString().slice(0, 10);
  const dateValue = current.weddingDate
    ? `${formatDateDot(current.weddingDate)}${current.weddingDate < today ? ` · ${S.passed}` : ''}`
    : UNDECIDED_LABEL;
  /* 정본 weddingSet v «웨딩홀» — 온보딩 3/5 카드 이름으로 적는다(휠 칸과 같은 글자). */
  const preparedValue = prepValueLabel(onlyPrepared(current.preparedCategories as VendorCategory[]));
  const styleValue =
    current.styleTags.length > 0
      ? current.styleTags.map((tag) => WEDDING_STYLE_LABEL[tag]).join(' · ')
      : S.none;

  return (
    <SubScreen title={S.title}>
      <Section>
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <SettingRow label={S.date} value={dateValue} onPress={() => setSheet('date')} />
          <SettingRow label={S.region} value={current.region ?? UNDECIDED_LABEL} onPress={() => setSheet('region')} />
          <SettingRow label={S.prepared} value={preparedValue} onPress={() => setSheet('prepared')} />
          <SettingRow label={S.style} value={styleValue} last onPress={() => setSheet('style')} />
        </View>
      </Section>

      <Section>
        <NoteBox title={S.noteTitle} body={S.noteBody} />
      </Section>

      {/* 예식일 — 로그인 이후 공용 날짜 휠. 범위는 온보딩과 같다: 내일부터 올해+5년 12월 31일. */}
      <DateWheelSheet
        visible={sheet === 'date'}
        title={S.dateTitle}
        {...weddingDateRange(new Date())}
        value={current.weddingDate}
        onConfirm={(iso) => {
          setSheet(null);
          save({ weddingDate: iso });
        }}
        onDismiss={() => setSheet(null)}
      />

      {/* 지역 — 온보딩 2/5와 같은 시/도 · 시/군/구 휠(정본 home.js wheelSheet). */}
      <RegionPickerSheet
        visible={sheet === 'region'}
        value={splitRegion(current.region)}
        onConfirm={(picked: PickedRegion) => {
          setSheet(null);
          save({ region: combineRegion(picked.region, picked.district) });
        }}
        onDismiss={() => setSheet(null)}
      />

      <OptionWheelSheet
        visible={sheet === 'prepared'}
        title={S.prepTitle}
        accessibilityLabel={S.prepared}
        options={PREP_OPTIONS}
        value={prepComboKeyOf(onlyPrepared(current.preparedCategories as VendorCategory[]))}
        onConfirm={(key) => {
          setSheet(null);
          save({ preparedCategories: prepCategoriesFromKey(key) });
        }}
        onDismiss={() => setSheet(null)}
      />

      {/*
        스타일 — 휠이 아니라 다중 선택 시트(2026-09-26 대표 지시 「개수제한 없다」 · 최소 1).
        1열 휠은 하나만 가리켜 여럿을 못 고른다 — 같은 공용 바텀시트에 온보딩 5/5 보기를 둔다.
      */}
      <StylePickSheet
        visible={sheet === 'style'}
        title={S.styleTitle}
        value={current.styleTags}
        onConfirm={(styles) => {
          setSheet(null);
          save({ styleTags: styles });
        }}
        onDismiss={() => setSheet(null)}
      />

      <Toast message={toast} onHidden={() => setToast(null)} />
    </SubScreen>
  );
}

/** 휠 보기 — 온보딩 답 그대로(`wedding-setting-options.ts`). 화면이 그릴 때마다 새로 만들지 않는다. */
const PREP_OPTIONS = prepOptions();

/** 4-3 정본: 작은 라벨 위에 현재 값을 놓는 64px 2단 행. */
function SettingRow({
  label,
  value,
  last = false,
  onPress,
}: {
  label: string;
  value: string;
  last?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${value}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.settingRow,
          /* 정본 행 선은 inset 그림자 — 행 높이 64 안에 든다. */
          last ? null : { borderBottomWidth: Border.hairline, borderBottomColor: theme.border },
          pressed && styles.pressed,
        ]}>
        <View style={styles.settingText}>
          <ThemedText type="f13" themeColor="textAssistive" numberOfLines={1}>
            {label}
          </ThemedText>
          <ThemedText type="f15" numberOfLines={1} style={styles.settingValue}>
            {value}
          </ThemedText>
        </View>
        <ProductSymbol name="chevronRight" size={Layout.iconField} color={theme.textDisabled} />
      </Pressable>
    </View>
  );
}

/**
 * 서버는 지역을 한 문자열로 들고 있다 — 시/도만 고르면 «서울», 구까지 고르면 공식 이름으로
 * «서울특별시 강남구»(`combineRegion`). 지역 휠은 둘을 나눠 받으므로 여기서 되돌린다.
 *
 * 비었거나 아홉 시/도에 없는 문자열이면 `null` — 휠은 첫 시/도에서 시작한다(짐작하지 않는다).
 */
function splitRegion(stored: string | null): PickedRegion | null {
  if (stored === null) return null;

  const tokens = regionTokens(stored);
  const head = tokens[0] ?? '';

  if (!(WEDDING_REGIONS as readonly string[]).includes(head)) return null;

  const district = tokens.slice(1).join(' ');

  return { region: head as WeddingRegion, district: district.length > 0 ? district : null };
}

/** «기타»는 준비 단계가 아니라 계약이 받지 않는다 — 화면에도 없는 값이지만 형을 좁힌다. */
function onlyPrepared(categories: readonly VendorCategory[]): PreparedCategory[] {
  return categories.filter((category): category is PreparedCategory => category !== 'etc');
}

const styles = StyleSheet.create({
  card: {
    borderWidth: Border.hairline,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  settingRow: {
    minHeight: Layout.rowMinHeight + Spacing.two,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
  },
  /* 정본 setCol gap 3. */
  settingText: { flex: 1, minWidth: 0, gap: Layout.cardNameGap },
  settingValue: { fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
