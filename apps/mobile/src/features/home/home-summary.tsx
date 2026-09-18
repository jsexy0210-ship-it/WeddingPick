import type { AppBootstrapResponse } from '@weddingpick/api-contract';
import { formatCount, manwon, type VendorCategory } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  ActionButton,
  Border,
  CategoryIcon,
  type CategoryIconKind,
  Layout,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';
import strings from '../../../../../spec/strings.ko.json';
import { budgetProgress, pendingPreparations } from './canon-state';
import type { CategoryStatus } from './state';

const S = strings.home;

/** 완료한 업종은 제외하고 다음 미완료 업종을 정본의 2×2 네 칸으로 표시한다. */
export function PendingPreparation({
  statuses, onOpen, onMore, onComplete,
}: {
  statuses: readonly CategoryStatus[];
  onOpen: (category: VendorCategory) => void;
  onMore: () => void;
  onComplete: () => void;
}) {
  const theme = useTheme();
  const items = pendingPreparations(statuses);
  const rows = [items.slice(0, 2), items.slice(2, 4)].filter((row) => row.length > 0);

  return (
    <View style={styles.section}>
      <SummaryHeading title={S['section.pending']} onMore={onMore} />
      {items.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText type="f14">{S['pending.done']}</ThemedText>
          <ActionButton variant="secondary" label={S['note.open']} onPress={onComplete} />
        </View>
      ) : rows.map((row) => (
        <View key={row[0]!.category} style={styles.row}>
          {row.map((item) => {
            const icon = categoryIconKind(item.category);
            const active = item.state === 'picking';
            return (
              <Pressable
                key={item.category}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => onOpen(item.category)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: active ? theme.tintSurface : theme.backgroundElement,
                    borderColor: active ? theme.tintBorder : theme.border,
                  },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.cardTop}>
                  {icon ? (
                    <CategoryIcon
                      kind={icon}
                      size={Layout.iconRow}
                      color={active ? theme.tint : theme.textAssistive}
                    />
                  ) : (
                    <View style={styles.categoryIconSpacer} />
                  )}
                  {active ? (
                    <SeedIcon name="clockRegular" size={Layout.iconField} color={theme.tint} />
                  ) : (
                    <View style={[styles.todoMark, { borderColor: theme.track }]} />
                  )}
                </View>
                <ThemedText type="f14" style={styles.bold} numberOfLines={1}>
                  {item.label}
                </ThemedText>
                <ThemedText
                  type="f12"
                  themeColor={active ? 'tint' : 'textAssistive'}
                  numberOfLines={1}>
                  {item.pickCount > 0
                    ? S['pending.count'].replace('{n}', formatCount(item.pickCount))
                    : S['pending.before']}
                </ThemedText>
              </Pressable>
            );
          })}
          {row.length === 1 ? <View style={styles.spacer} /> : null}
        </View>
      ))}
    </View>
  );
}

/** 히어로와 분리된 예산현황. bootstrap의 실제 예산만 보여준다. */
export function HomeBudget({ budget, onOpen }: {
  budget: AppBootstrapResponse['budget']; onOpen: () => void;
}) {
  const theme = useTheme();
  const progress = budgetProgress(budget);

  return (
    <View style={styles.section}>
      <SummaryHeading title={S['section.budget']} onMore={onOpen} />
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
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <View style={styles.budgetTop}>
            <View>
              <ThemedText type="f12" themeColor="textAssistive">지금까지 쓴 금액</ThemedText>
              <ThemedText type="f26" numeric style={styles.bold}>{manwon(budget.spent)}</ThemedText>
            </View>
            <ThemedText type="f13" numeric themeColor="textAssistive">
              {S['budget.total'].replace('{amount}', manwon(budget.total))}
            </ThemedText>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={S['budget.progress'].replace('{n}', String(progress))}
            accessibilityValue={{ min: 0, max: 100, now: progress }}
            style={[styles.track, { backgroundColor: theme.track }]}>
            <View style={[styles.fill, { width: `${progress}%`, backgroundColor: theme.tint }]} />
          </View>
          <View style={styles.budgetBottom}>
            <ThemedText
              type="f12"
              themeColor={budget.spent > budget.total ? 'negative' : 'textAssistive'}>
              {budget.spent > budget.total ? S['budget.exceeded'] : S['budget.note']}
            </ThemedText>
            <SeedIcon name="chevronRightRegular" size={Layout.iconField} color={theme.textAssistive} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

function SummaryHeading({ title, onMore }: { title: string; onMore: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.heading}>
      <ThemedText type="f20" style={styles.bold}>{title}</ThemedText>
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

function categoryIconKind(category: VendorCategory): CategoryIconKind | null {
  switch (category) {
    case 'wedding_info_company': return 'agency';
    case 'hall': return 'hall';
    case 'studio': return 'studio';
    case 'dress': return 'dress';
    case 'makeup': return 'makeup';
    case 'hair': return 'hair';
    case 'snap': return 'snap';
    case 'bouquet': return 'bouquet';
    case 'goods': return 'ring';
    case 'dowry': return 'dowry';
    case 'honeymoon': return 'honeymoon';
    case 'invitation': return 'invitation';
    case 'etc': return null;
  }
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Layout.gutter,
    marginBottom: Layout.sectionGap,
    gap: Layout.gap2col,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
    marginBottom: Layout.sectionHeadGap - Layout.gap2col,
  },
  more: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  row: { flexDirection: 'row', gap: Layout.gap2col },
  card: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: Layout.cardPadding,
    paddingVertical: Layout.cardPaddingCompactY,
    borderRadius: Radius.medium,
    borderWidth: Border.hairline,
    gap: Spacing.one,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  categoryIconSpacer: { width: Layout.iconRow, height: Layout.iconRow },
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
    paddingHorizontal: Layout.cardPadding,
    paddingVertical: Layout.cardPaddingCompactY,
    borderRadius: Radius.medium,
    borderWidth: Border.hairline,
    gap: Layout.cardGap,
  },
  budgetTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  budgetBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  track: { height: Spacing.two, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  empty: { gap: Layout.inlineGap },
});
