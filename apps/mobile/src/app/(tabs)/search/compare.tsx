import type { VendorComparisonResponse, VendorDetail } from '@weddingpick/api-contract';
import {
  AXIS_KIND_NOTE,
  DOCUMENT_TYPE_LABEL,
  PICK_VERIFICATION,
  VENDOR_CATEGORY_LABEL,
  axisLabel,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { compareVendors, getCurrentUser, recordComparison } from '@/api/client';
import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { won } from '@/features/quotes/quote-result-view';

/**
 * A-17 업체 비교. 최대 세 곳.
 *
 * 좁은 화면에 세 칸짜리 표를 그리면 아무것도 읽히지 않는다. 항목을 위에서 아래로 두고,
 * 각 항목 안에서 업체를 나란히 놓는다.
 *
 * 단서는 결과와 함께 서버가 내려준다. 표만 그리고 "금액만으로는 비교할 수 없다"는 말을
 * 빠뜨리면, 우리가 만든 표가 사업계획서 2번이 꼽은 오해를 되레 부추긴다.
 */
export default function CompareScreen() {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const theme = useTheme();
  const [result, setResult] = useState<VendorComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 두 곳이 안 되면 서버를 부를 것도 없다. 그리기 전에 안다.
  const tooFew = (ids ?? '').split(',').filter(Boolean).length < 2;

  useEffect(() => {
    if (tooFew) return;

    compareVendors((ids ?? '').split(',').filter(Boolean))
      .then((response) => {
        setResult(response);

        /*
         * 비교했다는 사실을 남긴다(미션 ③). 화면을 실제로 연 이때가 그 사실이
         * 생기는 순간이다 — 후보를 담은 때가 아니다.
         *
         * 실패는 삼킨다. 미션 체크 하나 때문에 비교 화면이 오류로 바뀌면
         * 잃는 것이 더 크다.
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
      <Frame>
        <ThemedText type="subtitle">비교할 수 없습니다</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {error ?? '견줄 업체를 두 곳 이상 골라주세요.'}
        </ThemedText>
        <ActionButton label="돌아가기" onPress={() => router.back()} />
      </Frame>
    );
  }

  if (!result) {
    return (
      <Frame>
        <ActivityIndicator color={theme.tint} />
      </Frame>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">{result.vendors.length}곳 비교</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {result.vendors.map((vendor) => vendor.name).join(' · ')}
            </ThemedText>
          </ThemedView>

          {/* 먼저 읽어야 할 것을 위에 둔다. 표를 본 뒤에 붙이면 이미 늦다. */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">견주기 전에</ThemedText>
            {result.caveats.map((caveat) => (
              <ThemedView key={caveat} type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  {caveat}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          <Row title="분류와 지역" vendors={result.vendors}>
            {(vendor) => (
              <ThemedText type="small" themeColor="textSecondary">
                {VENDOR_CATEGORY_LABEL[vendor.category]} · {vendor.region}
              </ThemedText>
            )}
          </Row>

          <Row title={PICK_VERIFICATION.material} vendors={result.vendors}>
            {(vendor) => (
              <ThemedText type="small" themeColor="textSecondary">
                {vendor.comparableQuoteCount === 0
                  ? '아직 없습니다'
                  : `${vendor.comparableQuoteCount}건`}
              </ThemedText>
            )}
          </Row>

          {/*
            항목 이름은 비교 축 정의(COMPARISON_AXES)에서 꺼낸다. 화면이 제 이름을
            따로 적으면 앱과 웹이 서로 다른 말을 하게 된다.
          */}
          <Row
            title={axisLabel('pick_price_range')}
            note={AXIS_KIND_NOTE.pick}
            vendors={result.vendors}>
            {(vendor) =>
              vendor.prices.products.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  자료가 모자라 가격을 보여드릴 수 없어요
                </ThemedText>
              ) : (
                vendor.prices.products.map((product) => (
                  <ThemedView
                    key={`${product.productLabel}-${product.docType}`}
                    type="backgroundElement"
                    style={styles.product}>
                    <ThemedText type="small">{product.productLabel}</ThemedText>
                    <ThemedText type="smallBold">{won(product.stat.median)}</ThemedText>
                    {/* 데이터 수와 기준 기간을 늘 함께 보인다(원문 16번). */}
                    <ThemedText type="small" themeColor="textSecondary">
                      {DOCUMENT_TYPE_LABEL[product.docType]} · {product.stat.sampleCount}건 ·{' '}
                      {product.stat.periodStart}~{product.stat.periodEnd}
                    </ThemedText>
                  </ThemedView>
                ))
              )
            }
          </Row>

          <Row title="업체 정보 출처" vendors={result.vendors}>
            {(vendor) => (
              <ThemedText type="small" themeColor="textSecondary">
                {vendor.sourceNote ?? '올려주신 문서에서 확인한 업체입니다'}
              </ThemedText>
            )}
          </Row>

          <ThemedView style={styles.section}>
            <ActionButton
              variant="primary"
              label="내 금액과 비교하기"
              hint={`자료를 올리면 이 업체들의 ${axisLabel('pick_price_range')}와 견줘 보여드려요`}
              onPress={() => router.push('/capture')}
            />
            <ActionButton label="검색으로 돌아가기" onPress={() => router.back()} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * 항목 하나. 그 안에서 업체가 세로로 늘어선다.
 *
 * `note`는 이 항목의 값이 누구 말인지다(v3.13 §O-5). 표는 값을 나란히 놓기 때문에,
 * 붙여두지 않으면 나란히 놓였다는 이유만으로 모두 같은 종류로 읽힌다.
 */
function Row({
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
    <ThemedView style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
      {vendors.map((vendor) => (
        <ThemedView key={vendor.id} type="backgroundElement" style={styles.card}>
          <ThemedText type="small">{vendor.name}</ThemedText>
          {children(vendor)}
        </ThemedView>
      ))}
    </ThemedView>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>{children}</ThemedView>
      </SafeAreaView>
    </ThemedView>
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
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  product: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
});
