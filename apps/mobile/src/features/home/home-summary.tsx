import type { AppBootstrapResponse } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SeedIconName } from '@weddingpick/ui';
import {
  Border,
  CanonGray,
  DonutChart,
  Layout,
  LineHeight,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';
import strings from '../../../../../spec/strings.ko.json';
import { budgetProgress } from './canon-state';
import type { HomePrepCard } from './prep-groups';
import { PrepCheckFill, PrepGroupIcon } from './prep-icons';
import { HOME_PAGE_X } from '@/features/home/home-layout';

const S = strings.home;

/** 홈 섹션 목적지 행의 꺾쇠. */
export const MORE_CHEVRON = 14;

/** 모든 홈 섹션에서 미리보기 아래 같은 자리와 크기로 쓰는 이동 행. */
export function HomeDestinationLink({
  destination, action, icon, onPress,
}: {
  destination: string;
  action: string;
  icon: SeedIconName;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination} ${action}`}
      onPress={onPress}
      style={({ pressed }) => [styles.destination, { borderTopColor: theme.border }, pressed && styles.pressed]}>
      <View style={styles.destinationLabel}>
        <SeedIcon name={icon} size={Layout.iconField} color={theme.textAssistive} />
        <ThemedText type="f13" style={styles.bold}>{destination}</ThemedText>
      </View>
      <View style={styles.destinationAction}>
        <ThemedText type="f13" themeColor="tint" style={styles.bold}>{action}</ThemedText>
        <SeedIcon name="chevronRightRegular" size={MORE_CHEVRON} color={theme.tint} />
      </View>
    </Pressable>
  );
}

/**
 * 홈 「내 웨딩 준비」 — 항상 4칸(웨딩홀 · 스드메 · 본식 · 예물 · 신혼). home.jsx
 * WP-HOME-001~003. 옛 구현(«남은 스케줄»)은 12업종 중 미완료만 최대 4개 승격해
 * 보여줬고, 완료해도 카드가 사라지지 않는 정본과 달랐다 — `prep-groups.ts`의
 * `homePrepCards`가 만든 4장을 그대로 그린다.
 */
export function MyWeddingPrep({
  cards, sub, onOpen, onMore,
}: {
  cards: readonly HomePrepCard[];
  sub: string;
  onOpen: (card: HomePrepCard) => void;
  onMore: () => void;
}) {
  const theme = useTheme();
  const rows = [cards.slice(0, 2), cards.slice(2, 4)].filter((row) => row.length > 0);

  return (
    <View style={styles.section}>
      <SummaryHeading title={S['section.myPrep']} sub={sub} />
      <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0]!.key} style={styles.row}>
          {row.map((card) => {
            const contracted = card.state === 'contracted';
            const picking = card.state === 'picking';
            return (
              <Pressable
                key={card.key}
                accessibilityRole="button"
                accessibilityLabel={card.label}
                onPress={() => onOpen(card)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: contracted || picking ? theme.tintSurface : theme.backgroundElement,
                    borderColor: contracted ? theme.tint : picking ? theme.tintBorder : CanonGray.gray200,
                    borderWidth: contracted ? Border.selected : Border.hairline,
                  },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.cardTop}>
                  <PrepGroupIcon
                    group={card.key}
                    size={Layout.iconRow}
                    color={contracted || picking ? theme.tint : theme.textDisabled}
                  />
                  {contracted ? (
                    <PrepCheckFill size={Layout.iconField} color={theme.tint} />
                  ) : picking ? (
                    <SeedIcon name="clockRegular" size={Layout.iconField} color={theme.tint} />
                  ) : (
                    <View style={[styles.todoMark, { borderColor: theme.track }]} />
                  )}
                </View>
                <ThemedText type="f14" style={styles.bold} numberOfLines={1}>
                  {card.label}
                </ThemedText>
                <ThemedText
                  type="f12"
                  themeColor={contracted || picking ? 'tint' : 'textAssistive'}
                  style={styles.detail}
                  numberOfLines={1}>
                  {card.detail}
                </ThemedText>
              </Pressable>
            );
          })}
          {row.length === 1 ? <View style={styles.spacer} /> : null}
        </View>
      ))}
      </View>
      <HomeDestinationLink destination="Pick" action="담은곳 보기" icon="heartRegular" onPress={onMore} />
    </View>
  );
}

/** 히어로와 분리된 예산현황. bootstrap의 실제 예산만 보여준다. */
export function HomeBudget({ budget, hasWedding = true, onOpen }: {
  budget: AppBootstrapResponse['budget']; hasWedding?: boolean; onOpen: () => void;
}) {
  const theme = useTheme();
  const progress = budgetProgress(budget);
  /* 예산만 등록하고 지출이 없으면 예산 미입력으로 오해하지 않게 지출 부재를 말한다. */
  const noSpend = budget !== null && budget.spent === 0;
  /*
   * 2026-09-25 대표 지시 — 「홈화면의 예산현황 그대로 노출한다. 정보가 없을 경우 서브 문구에
   * 정보를 입력해주세요 등으로 안내한다」. 예산이 없어도 빈 카드로 바꾸지 않고 같은 도넛 · 금액
   * 모양을 0으로 그리며, 서브 문구가 입력을 안내한다.
   */
  const hasBudget = budget !== null && progress !== null;
  const shownProgress = progress ?? 0;
  const spent = budget?.spent ?? 0;
  const budgetSub = hasBudget
    ? budget.spent > budget.total
      ? '예산을 넘었어요'
      : noSpend ? S['budget.subOnboarding'] : `예산의 ${progress}%를 썼어요`
    : S['budget.subEmpty'];

  return (
    <View style={styles.section}>
      <SummaryHeading title={S['section.budget']} sub={budgetSub} />
      <View
        style={[
          styles.budget,
          { backgroundColor: theme.background, borderColor: theme.border },
        ]}>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={S['budget.progress'].replace('{n}', String(shownProgress))}
          accessibilityValue={{ min: 0, max: 100, now: shownProgress }}
          style={styles.budgetTop}>
          <DonutChart
            size={72}
            holeSize={52}
            holeColor={theme.background}
            slices={[
              { key: 'used', value: shownProgress, color: theme.tint },
              { key: 'remaining', value: 100 - shownProgress, color: theme.chartMuted },
            ]}>
            <ThemedText type="f14" numeric style={styles.bold}>
              {hasBudget && budget.spent > budget.total ? '100%+' : `${shownProgress}%`}
            </ThemedText>
          </DonutChart>
          <View style={styles.budgetCol}>
            <ThemedText type="f26" numeric style={styles.bold}>{manwon(spent)}</ThemedText>
            <ThemedText type="f13" numeric themeColor="textAssistive">
              {hasBudget ? S['budget.total'].replace('{amount}', manwon(budget.total)) : S['budget.totalEmpty']}
            </ThemedText>
          </View>
        </View>
        <ThemedText
          type="f12"
          themeColor={hasBudget && budget.spent > budget.total ? 'negative' : 'textAssistive'}>
          {!hasBudget ? S['budget.noteEmpty'] : budget.spent > budget.total ? S['budget.exceeded'] : noSpend ? S['budget.noSpend'] : S['budget.note']}
        </ThemedText>
      </View>
      <HomeDestinationLink
        destination={hasWedding ? '웨딩노트' : 'MY'}
        action={hasWedding ? '예산현황 보기' : '내 웨딩 설정'}
        icon={hasWedding ? 'calendarRegular' : 'profileRegular'}
        onPress={onOpen}
      />
    </View>
  );
}

/**
 * 섹션 제목 줄 — 제목과 서브카피. 이동 행은 미리보기 아래에 따로 둔다.
 */
function SummaryHeading({ title, sub }: { title: string; sub: string | null }) {
  return (
    <View style={styles.heading}>
      <View style={styles.headingCol}>
        <ThemedText type="f14" style={styles.bold}>{title}</ThemedText>
        {sub === null ? null : (
          <ThemedText type="f12" themeColor="textAssistive" style={styles.sub}>{sub}</ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * home.jsx `secNoPad`/`hsec` — 헤더→본문 gap은 12px 하나뿐이다(그 값을
   * `heading.marginBottom`에 둔다). `section` 자체는 더 안 벌리므로 gap 없음.
   */
  section: {
    /* `hsec` · `prepGridPad` 좌우 20 — 홈 전용 여백(home-layout). */
    paddingHorizontal: HOME_PAGE_X,
    marginBottom: 24,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
    marginBottom: Layout.inlineGap,
  },
  destination: {
    minHeight: 48,
    marginTop: Layout.inlineGap,
    paddingVertical: Spacing.three,
    borderTopWidth: Border.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
  },
  destinationLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexShrink: 1 },
  destinationAction: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half },
  /* home.js `secSub` 12/17. */
  sub: { lineHeight: LineHeight.lh17 },
  /* home.js `prepDetail` 12/17 · 500 · margin-top 2. */
  detail: { lineHeight: LineHeight.lh17, fontWeight: 500, marginTop: Spacing.half },
  headingCol: { flex: 1, minWidth: 0, gap: Spacing.half },
  /*
   * 준비 카드의 2×2 gap. 아래 간격은 공통 목적지 행이 갖는다.
   */
  grid: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  /*
   * home.jsx `prepCard(kind)` — 세 상태 모두 `padding:14px;...gap:2px`다(스크립트로
   * 뽑아 확인: scripts/canon/extract-style.mjs --key prepTop/prepLabel). 기존
   * Layout.cardPadding(20)·cardPaddingCompactY(18)·Spacing.one(4)을 그대로 물려받았던
   * 옛 카드 스타일을 재사용했었는데, 실제 prepCard 값과 달라 다시 맞췄다.
   */
  card: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    borderRadius: Radius.medium,
    borderWidth: Border.hairline,
    gap: Spacing.half,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  todoMark: {
    width: Layout.iconField,
    height: Layout.iconField,
    borderRadius: Radius.pill,
    borderWidth: Border.selected,
  },
  spacer: { flex: 1 },
  bold: { fontWeight: 700 },
  pressed: { opacity: 0.8 },
  budget: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    gap: Layout.cardGap,
  },
  budgetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  budgetCol: { flex: 1, minWidth: 0, gap: Spacing.half },
});
