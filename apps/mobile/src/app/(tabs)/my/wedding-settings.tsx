import type { CurrentUser } from '@weddingpick/api-contract';
import {
  BUDGET_BRACKET_LABEL,
  PREPARATION_NOT_STARTED_LABEL,
  WEDDING_REGIONS,
  VENDOR_CATEGORY_LABEL,
  WEDDING_STYLE_LABEL,
  combineRegion,
  formatDateDot,
  regionTokens,
  type VendorCategory,
  type WeddingBudgetBracket,
  type WeddingRegion,
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
import { BudgetGrid } from '@/features/onboarding/budget-grid';
import { DatePickerSheet } from '@/features/onboarding/date-picker-sheet';
import { UNDECIDED_LABEL, type Answers } from '@/features/onboarding/flow';
import { PrepStatus } from '@/features/onboarding/prep-status';
import { RegionPicker } from '@/features/onboarding/region-picker';
import { NoteBox, Section, SubScreen } from '@/features/settings/my-kit';

/** 준비 현황이 받는 업종 — 계약이 «기타»를 받지 않는다(`preparationCategorySchema`). */
type PreparedCategory = Exclude<VendorCategory, 'etc'>;

/** `docs/design/React_Native/my.jsx` WP-MY-003 · `spec/strings.ko.json` `my.setting.*`. */
const S = {
  title: '내 웨딩설정',
  date: '예식일',
  region: '지역',
  /* 정본 weddingSet k «예산». */
  budget: '예산',
  style: '스타일',
  prepared: '준비 현황',
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

/** 지금 펼쳐 놓은 편집기. 한 번에 하나만 연다 — «한 항목씩 고친다»가 이 화면의 규칙이다. */
type Editing = 'region' | 'budget' | 'prepared' | null;

/**
 * 내 웨딩설정 · WP-MY-003 · `docs/design/React_Native/my.jsx` 프레임 3. 한 카드에 다섯 행
 * (예식일 · 지역 · 준비 현황 · 예산 · 스타일) — 시안 `weddingSet` 순서 그대로다.
 *
 * 이 화면이 생기기 전에는 MY의 «내 웨딩 설정»이 온보딩 5문항(`/setup`)을 통째로 다시 열었다 —
 * 예식일 하나 고치러 다섯 질문을 다시 지나야 했다. 여기서는 행을 눌러 그 항목만 고친다.
 *
 * 고른 즉시 저장한다(`/v1/me/setup`). 저장 버튼을 따로 두지 않는 이유는 항목이 서로 얽히지
 * 않기 때문이다 — 예식일만 바꾸고 나가도 남길 것이 없다. 요청은 `queue`로 줄을 세워
 * 연달아 누른 순서대로 나간다.
 *
 * **예식일은 온보딩과 같은 예식일 시트(OS 날짜 선택기)를 그대로 쓴다.** 지역 · 예산 · 준비 현황은
 * 온보딩 2/5 · 4/5 · 3/5와 같은 부품을 행 아래에 펼친다 — 같은 질문을 다른 모양으로 두 번
 * 만들지 않는다.
 *
 * **스타일 행은 `/my/taste`(스타일 다시 고르기)로 연결된다** — 00-ia가 가리키던
 * «취향 다시 고르기»와 같은 화면이다 — 정본 WP-MY-014(my.jsx frame-016)(v3.24가 취향을 스타일 4종으로 합치면서
 * 하나가 됐다). 같은 화면을 두 줄로 세우지 않는다.
 *
 * **예산 행 라벨은 시안 원문(«예산»)을 그대로 옮기지 않고 「준비 예산」을 유지했다** —
 * `BUDGET_BRACKET_FIELD_LABEL`(`packages/domain/budget-bracket.ts`)이 v3.19부터 MY의 이
 * 자리를 「준비 예산」으로 못 박았고(전체 예산이 아니라 앞으로 쓸 예산이라는 뜻), 같은 이름의
 * 시험(`budget-bracket.test.ts`)이 그 값을 센다. 시안의 압축 표기와 기존 확정 용어가 부딪혀
 * 임의로 바꾸지 않았다 — 대표님·MASTER 판단이 필요하다.
 */
export default function WeddingSettingsScreen() {
  const theme = useTheme();
  const depthBack = useDepthBack();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);

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

  if (error) return <ErrorView message={error} onBack={depthBack} />;
  if (me === null) return <DelayedLoadingView />;

  const current = me;

  /**
   * 고친 항목 하나만 보낸다. 예식일 · 지역은 계약이 늘 요구하므로 지금 값을 그대로 돌려보내고
   * (지우지 않는다), 예산 · 준비 현황은 키를 안 보내면 서버가 건드리지 않는다.
   */
  function save(patch: {
    weddingDate?: string | null;
    region?: string | null;
    budgetBracket?: WeddingBudgetBracket;
    preparedCategories?: PreparedCategory[];
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
          ...(patch.budgetBracket !== undefined && { budgetBracket: patch.budgetBracket }),
          ...(patch.preparedCategories !== undefined && {
            preparedCategories: patch.preparedCategories,
          }),
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

  function toggle(next: Exclude<Editing, null>) {
    setEditing((now) => (now === next ? null : next));
  }

  const today = new Date().toISOString().slice(0, 10);
  const dateValue = current.weddingDate
    ? `${formatDateDot(current.weddingDate)}${current.weddingDate < today ? ` · ${S.passed}` : ''}`
    : UNDECIDED_LABEL;
  const preparedValue =
    current.preparedCategories.length > 0
      /* 정본 weddingSet v «웨딩홀» — 정한 업종 이름을 그대로 잇는다. */
      ? current.preparedCategories.map((category) => VENDOR_CATEGORY_LABEL[category as VendorCategory]).join(' · ')
      : PREPARATION_NOT_STARTED_LABEL;
  const styleValue =
    current.styleTags.length > 0
      ? current.styleTags.map((tag) => WEDDING_STYLE_LABEL[tag]).join(' · ')
      : S.none;

  return (
    <SubScreen title={S.title}>
      <Section>
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <SettingRow
            label={S.date}
            value={dateValue}
            onPress={() => {
              setEditing(null);
              setDateOpen(true);
            }}
          />

          <SettingRow
            label={S.region}
            value={current.region ?? UNDECIDED_LABEL}
            onPress={() => toggle('region')}
          />
          {editing === 'region' ? (
            <View style={styles.editor}>
              <RegionPicker
                value={splitRegion(current.region)}
                onChange={(next) =>
                  save({
                    region: next.region === null ? null : combineRegion(next.region, next.district),
                  })
                }
              />
            </View>
          ) : null}

          <SettingRow
            label={S.prepared}
            value={preparedValue}
            onPress={() => toggle('prepared')}
          />
          {editing === 'prepared' ? (
            <View style={styles.editor}>
              <PrepStatus
                selected={current.preparedCategories}
                notStarted={current.preparedCategories.length === 0}
                onChange={(next) => save({ preparedCategories: onlyPrepared(next) })}
                onNotStarted={() => save({ preparedCategories: [] })}
              />
            </View>
          ) : null}

          <SettingRow
            label={S.budget}
            value={current.budgetBracket ? BUDGET_BRACKET_LABEL[current.budgetBracket] : S.none}
            onPress={() => toggle('budget')}
          />
          {editing === 'budget' ? (
            <View style={styles.editor}>
              <BudgetGrid
                value={current.budgetBracket}
                onChange={(bracket) => {
                  save({ budgetBracket: bracket });
                  setEditing(null);
                }}
              />
            </View>
          ) : null}

          <SettingRow
            label={S.style}
            value={styleValue}
            last
            onPress={() => router.push('/my/taste' as never)}
          />
        </View>
      </Section>

      <Section>
        <NoteBox title={S.noteTitle} body={S.noteBody} />
      </Section>

      {/* 예식일 — OS 날짜 선택기 시트. 온보딩 1/5와 같은 시트다. */}
      <DatePickerSheet
        visible={dateOpen}
        value={current.weddingDate}
        onConfirm={(iso) => {
          setDateOpen(false);
          save({ weddingDate: iso });
        }}
        onDismiss={() => setDateOpen(false)}
      />

      <Toast message={toast} onHidden={() => setToast(null)} />
    </SubScreen>
  );
}

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
 * «서울특별시 강남구»(`combineRegion`). 온보딩 부품은 둘을 나눠 받으므로 여기서 되돌린다.
 *
 * 아홉 칩에 없는 문자열이면 `null`을 준다 — «미정을 골랐다»(`{ region: null }`)와
 * «아직 답하지 않았다»(`null`)는 다른 상태다(`features/onboarding/flow.ts`).
 */
function splitRegion(stored: string | null): Answers['region'] {
  if (stored === null) return { region: null, district: null };

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
  /* 펼친 편집기 — 행 아래 · 아래 여백만 준다. 부품이 제 여백을 갖고 있다. */
  /*
   * 펼쳐지는 편집기(`RegionPicker` · `BudgetGrid` · `PrepStatus`)는 **온보딩에서 그대로
   * 가져다 쓴다.** 그 셋은 시안 `padSec`(`0 24 24`)를 **자기가** 그리는 부품이라
   * `paddingHorizontal: Layout.gutter`를 안에 들고 있다. 그런데 여기서는 그것을
   * `Section` 안에 넣는데, `Section`도 같은 거터를 준다 — 좌우가 **24 + 24 = 48**이
   * 되어, 바로 위의 행들보다 한 칸 더 안으로 들어간 채 그려졌다. 대표님이 「중첩」이라
   * 부른 모양이 이것이다(2026-09-11).
   *
   * `Section`의 거터를 여기서 되돌린다. 그러면 안쪽 부품이 제 `padSec`를 그대로
   * 그려 행과 같은 24에 앉는다. 아래 여백도 부품이 이미 24를 들고 있어 여기서
   * 더하지 않는다.
   *
   * 부품 쪽을 고치지 않는 이유 — 온보딩(`app/setup.tsx`)은 거터를 주지 않는
   * `StepFrame` 안에서 같은 부품을 쓴다. 거기서 거터를 빼면 온보딩이 벽에 붙는다.
   */
  editor: {
    marginHorizontal: -Layout.gutter,
  },
});
