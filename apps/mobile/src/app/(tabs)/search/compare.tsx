import type { VendorComparisonResponse, VendorDetail } from '@weddingpick/api-contract';
import {
  AXIS_KIND_NOTE,
  DOCUMENT_TYPE_LABEL,
  PICK_VERIFICATION,
  STILL_COLLECTING,
  VENDOR_CATEGORY_LABEL,
  axisLabel,
  manwon,
  rangeLabel,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { compareVendors, getCurrentUser, recordComparison } from '@/api/client';
import {
  ActionButton,
  Colors,
  ErrorView,
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
 * WP-CMP-001 업체 비교. 최대 세 곳.
 *
 * 좁은 화면에 세 칸짜리 표를 그리면 아무것도 읽히지 않는다. 항목을 위에서 아래로 두고,
 * 각 항목 안에서 업체를 나란히 놓는다.
 *
 * 단서는 결과와 함께 서버가 내려준다. 표만 그리고 "금액만으로는 비교할 수 없다"는 말을
 * 빠뜨리면, 우리가 만든 표가 오해를 되레 부추긴다.
 */
export default function CompareScreen() {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const theme = useTheme();
  const [result, setResult] = useState<VendorComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * 업체별 Pick 완료 여부. key = vendorId.
   * 비교 화면에서도 바로 Pick할 수 있다(바텀 독).
   */
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  // 두 곳이 안 되면 서버를 부를 것도 없다.
  const tooFew = (ids ?? '').split(',').filter(Boolean).length < 2;

  useEffect(() => {
    if (tooFew) return;

    compareVendors((ids ?? '').split(',').filter(Boolean))
      .then((response) => {
        setResult(response);

        /*
         * 비교했다는 사실을 남긴다(미션 ③). 화면을 실제로 연 이때가 그 사실이
         * 생기는 순간이다 — 후보를 담은 때가 아니다.
         */
        const category = response.vendors[0]?.category;
        if (!category) return;

        void getCurrentUser()
          .then((me) => (me.weddingId ? recordComparison(me.weddingId, category) : undefined))
          .catch(() => undefined);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [ids, tooFew]);

  if (tooFew || error) {
    return (
      <ErrorView
        title="비교할 수 없어요"
        message={error ?? '견줄 업체를 두 곳 이상 골라주세요.'}
        onBack={() => router.back()}
      />
    );
  }

  if (!result) {
    return <LoadingView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>

          {/* 헤더 — 몇 곳 비교인지 + 업체명 */}
          <View style={styles.section}>
            <ThemedText type="t2">{result.vendors.length}곳 비교</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              {result.vendors.map((vendor) => vendor.name).join(' · ')}
            </ThemedText>
          </View>

          {/* 비교 전에 읽어야 할 것 */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.section}>
            <ThemedText type="t4">견주기 전에</ThemedText>
            {result.caveats.map((caveat) => (
              <ThemedView key={caveat} type="backgroundElement" style={styles.card}>
                <ThemedText type="t6" themeColor="textSecondary">{caveat}</ThemedText>
              </ThemedView>
            ))}
          </View>

          {/* 비교 행들 */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />

          <CompareRow title="분류와 지역" vendors={result.vendors}>
            {(vendor) => (
              <ThemedText type="t6" themeColor="textSecondary">
                {VENDOR_CATEGORY_LABEL[vendor.category]} · {vendor.region}
              </ThemedText>
            )}
          </CompareRow>

          <CompareRow title={PICK_VERIFICATION.material} vendors={result.vendors}>
            {(vendor) => (
              <ThemedText type="t6" themeColor="textSecondary">
                {vendor.comparableQuoteCount === 0
                  ? '아직 없어요'
                  : `${vendor.comparableQuoteCount}건`}
              </ThemedText>
            )}
          </CompareRow>

          <CompareRow
            title={axisLabel('pick_price_range')}
            note={AXIS_KIND_NOTE.pick}
            vendors={result.vendors}>
            {(vendor) => {
              const pp = vendor.prices.paidPrice;
              if (pp.stage === 'collecting') {
                return (
                  <ThemedText type="t6" themeColor="textAssistive">{STILL_COLLECTING}</ThemedText>
                );
              }
              return (
                <View style={styles.priceCell}>
                  <ThemedText type="t5" numeric>
                    {rangeLabel(pp.low, pp.high)}
                  </ThemedText>
                  {pp.stage === 'detailed' ? (
                    <ThemedText type="t7" themeColor="textSecondary">
                      기준금액 {manwon(pp.median)}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="t7" themeColor="textAssistive">{pp.caption}</ThemedText>
                </View>
              );
            }}
          </CompareRow>

          {/* 확인된 계약 상품별 */}
          <CompareRow title="확인된 계약" vendors={result.vendors}>
            {(vendor) =>
              vendor.prices.products.length === 0 ? (
                <ThemedText type="t6" themeColor="textSecondary">
                  자료가 모자라 보여드릴 수 없어요
                </ThemedText>
              ) : (
                <View style={styles.productList}>
                  {vendor.prices.products.map((product) => (
                    <View
                      key={`${product.productLabel}-${product.docType}`}
                      style={styles.productRow}>
                      <ThemedText type="t6">{product.productLabel}</ThemedText>
                      <ThemedText type="t5" numeric>{manwon(product.stat.median)}</ThemedText>
                      <ThemedText type="t7" themeColor="textSecondary">
                        {DOCUMENT_TYPE_LABEL[product.docType]} · {product.stat.sampleCount}건 ·{' '}
                        {product.stat.periodStart}~{product.stat.periodEnd}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )
            }
          </CompareRow>

          <CompareRow title="업체 정보 출처" vendors={result.vendors}>
            {(vendor) => (
              <ThemedText type="t6" themeColor="textSecondary">
                {vendor.sourceNote ?? '올려주신 문서에서 확인한 업체예요'}
              </ThemedText>
            )}
          </CompareRow>

          {/* 웨딩픽 요약 — 비교한 뒤 뭘 선택해야 할지 단서 */}
          {result.summary ? (
            <>
              <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
              <View style={styles.section}>
                <ThemedText type="t4">웨딩픽이 보는 것</ThemedText>
                <ThemedText type="t6" themeColor="textSecondary">{result.summary}</ThemedText>
              </View>
            </>
          ) : null}

          {/* 바텀 여백 — 바텀 독 높이만큼 확보 */}
          <View style={styles.dockSpacer} />
        </ScrollView>

        {/* ── 바텀 독 — 업체별 Pick 버튼 ── */}
        <ThemedView style={[styles.dock, { borderTopColor: theme.line }]}>
          {result.vendors.map((vendor) => (
            <Pressable
              key={vendor.id}
              accessibilityRole="button"
              accessibilityLabel={picked[vendor.id] ? `${vendor.name} Pick했어요` : `${vendor.name} Pick하기`}
              style={[
                styles.dockPickBtn,
                picked[vendor.id]
                  ? { backgroundColor: theme.tint }
                  : { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
              ]}
              onPress={() =>
                setPicked((prev) => ({ ...prev, [vendor.id]: !prev[vendor.id] }))
              }>
              <ThemedText
                type="t7"
                numberOfLines={1}
                style={picked[vendor.id] ? styles.dockPickBtnTextOn : undefined}
                themeColor={picked[vendor.id] ? undefined : 'textSecondary'}>
                {vendor.name}
              </ThemedText>
              <ThemedText
                type="t7"
                style={picked[vendor.id] ? styles.dockPickBtnTextOn : undefined}
                themeColor={picked[vendor.id] ? undefined : 'text'}>
                {picked[vendor.id] ? 'Pick했어요' : 'Pick하기'}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * 비교 항목 하나. 업체가 세로로 나열된다.
 *
 * `note`는 이 항목의 값이 누구 말인지다. 표는 값을 나란히 놓기 때문에,
 * 붙여두지 않으면 나란히 놓였다는 이유만으로 모두 같은 종류로 읽힌다.
 */
function CompareRow({
  title,
  note,
  vendors,
  children,
}: {
  title: string;
  note?: string;
  vendors: VendorDetail[];
  children: (vendor: VendorDetail) => React.ReactNode;
}) {
  return (
    <View style={styles.compareSection}>
      <View style={styles.compareSectionInner}>
        <ThemedText type="t5">{title}</ThemedText>
        {note ? (
          <ThemedText type="t7" themeColor="textSecondary">{note}</ThemedText>
        ) : null}
        {vendors.map((vendor) => (
          <ThemedView key={vendor.id} type="backgroundElement" style={styles.card}>
            <ThemedText type="t6" themeColor="textSecondary" numberOfLines={1}>
              {vendor.name}
            </ThemedText>
            {children(vendor)}
          </ThemedView>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    paddingBottom: Spacing.three,
  },

  // ── 밴드 ──
  band: {
    height: Layout.sectionBand,
  },

  // ── 공통 섹션 ──
  section: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    paddingBottom: Layout.sectionGap,
    gap: Spacing.two,
  },

  // ── 비교 항목 섹션 ──
  compareSection: {
    gap: 0,
  },
  compareSectionInner: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },

  // ── 공통 카드 ──
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },

  // ── 금액 셀 ──
  priceCell: {
    gap: Spacing.one,
  },

  // ── 상품 목록 ──
  productList: {
    gap: Spacing.two,
  },
  productRow: {
    gap: Spacing.one,
  },

  // ── 바텀 독 ──
  dockSpacer: {
    height: 80,
  },
  dock: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  dockPickBtn: {
    flex: 1,
    height: Layout.controlXLarge,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  dockPickBtnTextOn: {
    color: Colors.light.onTint,
  },
});
