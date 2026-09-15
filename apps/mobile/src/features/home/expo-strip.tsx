import type { ExpoItem } from '@weddingpick/api-contract';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  Border,
  Elevation,
  Layout,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';

/**
 * 박람회 — 2026-09-15 대표 사양 §16. 가까운 일정부터 최대 3건, 가로 슬라이드.
 *
 * 카드에 적는 것은 넷이다 — 기간 · 박람회명 · 장소 · 지역. 넷 다 `ExpoItem`에 있다.
 *
 * **종료된 박람회는 오지 않는다**(§16). 거르는 일은 부르는 쪽이 한다 — 이 컴포넌트는
 * 받은 것을 그린다.
 *
 * **우선순위의 「접근성」은 반영하지 않는다.** 역에서 몇 분인지, 주차가 되는지를 모아둔
 * 자리가 없다. 잴 수 없는 것으로 순서를 정한 척하지 않는다 — 지역과 일정만 본다.
 */
export type ExpoStripProps = {
  items: readonly ExpoItem[];
  onPressExpo: (expoId: string) => void;
  onPressMore: () => void;
};

export function ExpoStrip({ items, onPressExpo, onPressMore }: ExpoStripProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={[styles.head, styles.gutter]}>
        <View style={styles.headText}>
          <ThemedText type="f14" style={styles.semibold}>
            박람회
          </ThemedText>
          <ThemedText type="f12" themeColor="textAssistive" style={styles.sub}>
            가까운 일정부터 확인해보세요
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="박람회 전체 보기"
          onPress={onPressMore}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="f12" style={styles.semibold}>
            더보기
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}>
        {items.map((expo) => (
          <Card key={expo.id} expo={expo} onPress={() => onPressExpo(expo.id)} />
        ))}
        <View style={styles.tail} />
      </ScrollView>
    </View>
  );
}

function Card({ expo, onPress }: { expo: ExpoItem; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${expo.title} 상세`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.background, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="f10" numeric themeColor="textAssistive" style={styles.semibold} numberOfLines={1}>
        {expoPeriod(expo)}
      </ThemedText>
      <ThemedText type="f14" style={styles.title} numberOfLines={2}>
        {expo.title}
      </ThemedText>
      <View style={styles.place}>
        <SeedIcon name="locationRegular" size={Layout.iconMicro} color={theme.textAssistive} />
        <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1} style={styles.shrink}>
          {expo.venue} · {expo.region}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/**
 * «04.17~04.19» · 하루짜리는 «04.17».
 *
 * 며칠 남았는지를 적지 않는다 — 혜택 화면의 운영 기간 규칙과 같은 자리다. 언제 여는지는
 * 사실이고, 얼마 안 남았다는 것은 재촉이다.
 */
export function expoPeriod(expo: Pick<ExpoItem, 'startsAt' | 'endsAt'>): string {
  const start = monthDay(expo.startsAt);
  const end = monthDay(expo.endsAt);

  return start === end ? start : `${start}~${end}`;
}

function monthDay(value: string): string {
  const date = new Date(value);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${month}.${day}`;
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing.four },
  gutter: { paddingHorizontal: Layout.pageX },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Layout.sectionHeadGapCompact,
    gap: Spacing.two,
  },
  headText: { flex: 1, minWidth: 0 },
  semibold: { fontWeight: 600 },
  sub: { marginTop: Spacing.half },
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { flexDirection: 'row', gap: Layout.inlineGap, paddingLeft: Layout.pageX, paddingBottom: Spacing.one },
  tail: { width: Spacing.three },
  card: {
    width: Layout.cardRecommendWidth,
    padding: Layout.inlineGap,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    ...Elevation.figmaCard,
  },
  title: { fontWeight: 600, marginTop: Spacing.half },
  place: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.one },
  shrink: { flexShrink: 1, minWidth: 0 },
  pressed: { opacity: 0.8 },
});
