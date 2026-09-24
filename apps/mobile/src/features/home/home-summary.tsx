import type { AppBootstrapResponse } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  ActionButton,
  Border,
  CategoryIcon,
  DonutChart,
  Layout,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';
import strings from '../../../../../spec/strings.ko.json';
import { budgetProgress } from './canon-state';
import type { HomePrepCard } from './prep-groups';

const S = strings.home;

/**
 * 홈 「내 웨딩 준비」 — 항상 4칸(웨딩홀 · 스드메 · 본식 · 예물 · 신혼). .dc.html
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
      <SummaryHeading title={S['section.myPrep']} sub={sub} onMore={onMore} />
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
                    borderColor: contracted ? theme.tint : picking ? theme.tintBorder : theme.border,
                    borderWidth: contracted ? Border.selected : Border.hairline,
                  },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.cardTop}>
                  <CategoryIcon
                    kind={card.icon}
                    size={Layout.iconRow}
                    color={contracted || picking ? theme.tint : theme.textAssistive}
                  />
                  {contracted ? (
                    <SeedIcon name="checkFlowerFill" size={Layout.iconField} color={theme.tint} />
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
    </View>
  );
}

/** 히어로와 분리된 예산현황. bootstrap의 실제 예산만 보여준다. */
export function HomeBudget({ budget, onOpen }: {
  budget: AppBootstrapResponse['budget']; onOpen: () => void;
}) {
  const theme = useTheme();
  const progress = budgetProgress(budget);
  const budgetSub = budget && progress !== null
    ? budget.spent > budget.total ? '예산을 넘었어요' : `예산의 ${progress}%를 썼어요`
    : null;

  return (
    <View style={styles.section}>
      <SummaryHeading
        title={S['section.budget']}
        sub={budgetSub}
        onMore={onOpen}
      />
      {budget === null || progress === null ? (
        <View style={styles.empty}>
          <ThemedText type="f13" themeColor="textAssistive">{S['budget.empty']}</ThemedText>
          <ActionButton variant="secondary" label={S['budget.set']} onPress={onOpen} />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="예산현황 자세히"
          onPress={onOpen}
          style={({ pressed }) => [
            styles.budget,
            { backgroundColor: theme.background, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={S['budget.progress'].replace('{n}', String(progress))}
            accessibilityValue={{ min: 0, max: 100, now: progress }}
            style={styles.budgetTop}>
            <DonutChart
              size={72}
              holeSize={52}
              holeColor={theme.background}
              slices={[
                { key: 'used', value: progress, color: theme.tint },
                { key: 'remaining', value: 100 - progress, color: theme.chartMuted },
              ]}>
              <ThemedText type="f14" numeric style={styles.bold}>
                {budget.spent > budget.total ? '100%+' : `${progress}%`}
              </ThemedText>
            </DonutChart>
            <View style={styles.budgetCol}>
              <ThemedText type="f26" numeric style={styles.bold}>{manwon(budget.spent)}</ThemedText>
              <ThemedText type="f13" numeric themeColor="textAssistive">
                {S['budget.total'].replace('{amount}', manwon(budget.total))}
              </ThemedText>
            </View>
          </View>
          <ThemedText
            type="f12"
            themeColor={budget.spent > budget.total ? 'negative' : 'textAssistive'}>
            {budget.spent > budget.total ? S['budget.exceeded'] : S['budget.note']}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/**
 * 섹션 제목 줄 — .dc.html `secHeadPad`/`secHead`(타이틀 14/20/700 + 서브 12/17/뮤트,
 * 우측 「자세히」). `sub`가 null이면(예산현황) 서브카피 없이 제목만 쓴다.
 */
function SummaryHeading({ title, sub, onMore }: { title: string; sub: string | null; onMore: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.heading}>
      <View style={styles.headingCol}>
        <ThemedText type="f14" style={styles.bold}>{title}</ThemedText>
        {sub === null ? null : (
          <ThemedText type="f12" themeColor="textAssistive">{sub}</ThemedText>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} ${S.more}`}
        onPress={onMore}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
        <ThemedText type="f13" themeColor="textAssistive">{S.more}</ThemedText>
        <SeedIcon name="chevronRightRegular" size={Layout.iconField} color={theme.textAssistive} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * .dc.html `secNoPad`/`hsec` — 헤더→본문 gap은 12px 하나뿐이다(그 값을
   * `heading.marginBottom`에 둔다). `section` 자체는 더 안 벌리므로 gap 없음.
   */
  section: {
    paddingHorizontal: Layout.gutter,
    marginBottom: 24,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
    marginBottom: Layout.inlineGap,
  },
  more: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  headingCol: { flex: 1, minWidth: 0, gap: Spacing.half },
  /* .dc.html `prepGridPad` — grid gap:8px, 가로·세로 둘 다. */
  grid: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  /*
   * .dc.html `prepCard(kind)` — 세 상태 모두 `padding:14px;...gap:2px`다(스크립트로
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
  empty: { gap: Layout.inlineGap },
});
