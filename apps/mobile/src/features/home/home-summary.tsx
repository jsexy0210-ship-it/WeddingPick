import type { AppBootstrapResponse } from '@weddingpick/api-contract';
import { formatCount, manwon, type VendorCategory } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  ActionButton, Border, Layout, Radius, SeedIcon, Spacing, ThemedText, useTheme,
} from '@weddingpick/ui';
import strings from '../../../../../spec/strings.ko.json';
import { budgetProgress, pendingPreparations } from './canon-state';
import type { CategoryStatus } from './state';

const S = strings.home;

/** 완료한 업종은 제외하고 다음 미완료 업종으로 네 칸을 채운다. */
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
          {row.map((item) => (
            <Pressable
              key={item.category}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => onOpen(item.category)}
              style={({ pressed }) => [styles.card, {
                backgroundColor: item.state === 'picking' ? theme.tintSurface : theme.backgroundElement,
                borderColor: item.state === 'picking' ? theme.tintBorder : theme.border,
              }, pressed && styles.pressed]}>
              <View style={styles.cardTop}>
                <ThemedText type="f14" style={styles.bold}>{item.label}</ThemedText>
                <SeedIcon name="clockRegular" size={Layout.iconField} color={theme.textAssistive} />
              </View>
              <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1}>
                {item.pickCount > 0 ? S['pending.count'].replace('{n}', formatCount(item.pickCount)) : S['pending.before']}
              </ThemedText>
            </Pressable>
          ))}
          {/* 마지막 카드도 같은 두 열 폭을 유지한다. 빈 공간은 데이터/버튼이 아니다. */}
          {row.length === 1 ? <View style={styles.spacer} /> : null}
        </View>
      ))}
    </View>
  );
}

/** 히어로와 분리된 예산현황. bootstrap에 이미 있는 값을 사용한다. */
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
        <View style={[styles.budget, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.budgetTop}>
            <ThemedText type="f26" numeric style={styles.bold}>{manwon(budget.spent)}</ThemedText>
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
          <ThemedText type="f12" themeColor={budget.spent > budget.total ? 'negative' : 'textAssistive'}>
            {budget.spent > budget.total ? S['budget.exceeded'] : S['budget.note']}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

function SummaryHeading({ title, onMore }: { title: string; onMore: () => void }) {
  return (
    <View style={styles.heading}>
      <ThemedText type="t4">{title}</ThemedText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title} ${S.more}`} onPress={onMore} hitSlop={Spacing.two}>
        <ThemedText type="f13" themeColor="textAssistive">{S.more}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: Layout.gutter, marginBottom: Layout.sectionGap, gap: Layout.chipGap },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Layout.inlineGap, marginBottom: Spacing.one },
  row: { flexDirection: 'row', gap: Layout.gap2col },
  card: { flex: 1, minWidth: 0, padding: Layout.sectionHeadGap, borderRadius: Radius.medium, borderWidth: Border.hairline, gap: Spacing.one },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.one },
  spacer: { flex: 1 },
  bold: { fontWeight: 700 },
  pressed: { opacity: 0.8 },
  budget: { padding: Layout.cardPaddingCompactY, borderRadius: Radius.medium, gap: Layout.cardGap },
  budgetTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.two },
  track: { height: Spacing.two, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  empty: { gap: Layout.inlineGap },
});
