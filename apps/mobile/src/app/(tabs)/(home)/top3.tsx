import type { Top3Item, Top3Response } from '@weddingpick/api-contract';
import {
  TOP3_REASON_LABEL,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  manwon,
  type VendorCategory,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTop3 } from '@/api/client';
import {
  ActionButton,
  EmptyView,
  ErrorView,
  FilterChip,
  Layout,
  LoadingView,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/**
 * TOP3 전체보기. WP-HOME-004.
 *
 * 홈 탭에서 진입. 카테고리를 선택하면 해당 업종 TOP3를 보여준다.
 * 추천 이유와 실제 결제 데이터를 함께 표시한다.
 */
export default function Top3Screen() {
  const [category, setCategory] = useState<VendorCategory>('hall');
  const [data, setData] = useState<Top3Response | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getTop3({ category })
      .then((result) => {
        setError(null);
        setData(result);
      })
      .catch((e: Error) => setError(e.message));
  }, [category]);

  useEffect(load, [load]);

  function handleCategoryChange(cat: VendorCategory) {
    setData(null);
    setError(null);
    setCategory(cat);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.pageHeader}>
            <ThemedText type="t4">TOP 3</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              Pick 인증 데이터 기반 추천이에요. 광고는 이 순위에 영향을 줄 수 없어요.
            </ThemedText>
          </ThemedView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}>
            {VENDOR_CATEGORIES.map((cat) => (
              <FilterChip
                key={cat}
                label={VENDOR_CATEGORY_LABEL[cat]}
                selected={category === cat}
                onPress={() => handleCategoryChange(cat)}
              />
            ))}
          </ScrollView>

          {error ? (
            <ErrorView message={error} onBack={() => router.back()} />
          ) : !data ? (
            <LoadingView />
          ) : data.items.length > 0 ? (
            <>
              {data.region || data.category ? (
                <ThemedText type="t7" themeColor="textSecondary">
                  {[data.region, VENDOR_CATEGORY_LABEL[data.category]]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              ) : null}

              {data.items.map((item, index) => (
                <Top3Card key={item.vendorId} rank={index + 1} item={item} />
              ))}

              {data.note ? (
                <ThemedView type="backgroundElement" style={styles.note}>
                  <ThemedText type="t7" themeColor="textSecondary">
                    {data.note}
                  </ThemedText>
                </ThemedView>
              ) : null}
            </>
          ) : (
            <EmptyView title="이 업종은 아직 추천할 만큼 자료가 모이지 않았어요." />
          )}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Top3Card({ rank, item }: { rank: number; item: Top3Item }) {
  const theme = useTheme();

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.rankBadge, { backgroundColor: theme.tint }]}>
          <ThemedText type="badge" themeColor="onTint">
            {rank}
          </ThemedText>
        </View>
        <ThemedView style={styles.cardTitle}>
          <ThemedText type="t5">{item.name}</ThemedText>
          <ThemedText type="t7" themeColor="textSecondary">
            {item.region} · {VENDOR_CATEGORY_LABEL[item.category]}
          </ThemedText>
        </ThemedView>
      </View>

      <View style={styles.reasons}>
        {item.reasons.map((reason) => (
          <ThemedView key={reason} style={[styles.reasonChip, { borderColor: theme.tint }]}>
            <ThemedText type="t7" style={{ color: theme.tint }}>
              {TOP3_REASON_LABEL[reason]}
            </ThemedText>
          </ThemedView>
        ))}
      </View>

      <ThemedView style={styles.priceRow}>
        <ThemedText type="t7" themeColor="textSecondary">
          Pick 가격대
        </ThemedText>
        {item.paidPrice.stage === 'collecting' ? (
          <ThemedText type="t7" themeColor="textAssistive">
            {item.paidPrice.caption}
          </ThemedText>
        ) : (
          <>
            <ThemedText type="t6" numeric>
              {manwon(item.paidPrice.low)}~{manwon(item.paidPrice.high)}
            </ThemedText>
            <ThemedText type="t7" themeColor="textAssistive">
              {item.paidPrice.caption}
            </ThemedText>
          </>
        )}
      </ThemedView>

      <ThemedText type="smallBold" themeColor="textAssistive">
        확인된 정보 {item.confirmedCount}건
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  pageHeader: { gap: Spacing.two },
  chips: { gap: Spacing.two, paddingBottom: Spacing.one },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, gap: Spacing.half },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  reasonChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  priceRow: { gap: Spacing.half },
  note: { borderRadius: Radius.medium, padding: Spacing.three },
});
