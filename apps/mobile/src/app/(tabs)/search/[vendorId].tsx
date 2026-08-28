import type { VendorDetail } from '@weddingpick/api-contract';
import { DOCUMENT_TYPE_LABEL, VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getVendor } from '@/api/client';
import { ActionButton, MaxContentWidth, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { won } from '@/features/quotes/quote-result-view';

/**
 * A-17 업체 상세.
 *
 * 별점도 후기도 없다. 확인된 실제 계약이 충분히 모인 상품만 가격을 보여주고, 그렇지
 * 않으면 그렇다고 말한다 — 자료가 없는 업체와 싼 업체가 같은 얼굴이 되면 안 된다.
 */
export default function VendorDetailScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const theme = useTheme();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVendor(vendorId)
      .then(setVendor)
      .catch((caught: Error) => setError(caught.message));
  }, [vendorId]);

  if (error) {
    return (
      <Frame>
        <ThemedText type="subtitle">불러오지 못했습니다</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
        <ActionButton label="돌아가기" onPress={() => router.back()} />
      </Frame>
    );
  }

  if (!vendor) {
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
            <ThemedText type="subtitle">{vendor.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {VENDOR_CATEGORY_LABEL[vendor.category]} · {vendor.region}
            </ThemedText>
            {vendor.sourceNote ? (
              <ThemedText type="small" themeColor="textSecondary">
                업체 정보 출처: {vendor.sourceNote}
              </ThemedText>
            ) : null}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">실제 계약 가격</ThemedText>

            {vendor.products.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  {vendor.comparableQuoteCount === 0
                    ? '이 업체의 확인된 계약 자료가 아직 없습니다.'
                    : `확인된 계약이 ${vendor.comparableQuoteCount}건 모였지만, 같은 상품끼리 견주기에는 아직 모자랍니다.`}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  자료가 모이기 전에는 가격을 지어내지 않습니다. 견적서를 올려주시면 이
                  업체의 자료가 됩니다.
                </ThemedText>
              </ThemedView>
            ) : (
              vendor.products.map((product) => (
                <ThemedView
                  key={`${product.productLabel}-${product.docType}`}
                  type="backgroundElement"
                  style={styles.card}>
                  <ThemedText type="smallBold">{product.productLabel}</ThemedText>
                  <ThemedText type="subtitle">{won(product.stat.median)}</ThemedText>
                  {/* 사업계획서 9번: 표본 수와 기준 기간을 늘 함께 보인다. */}
                  <ThemedText type="small" themeColor="textSecondary">
                    {DOCUMENT_TYPE_LABEL[product.docType]} · 확인된 계약{' '}
                    {product.stat.sampleCount}건 · {product.stat.periodStart}~
                    {product.stat.periodEnd}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    가운데 절반이 {won(product.stat.p25)}~{won(product.stat.p75)} 사이입니다
                  </ThemedText>
                </ThemedView>
              ))
            )}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ActionButton
              variant="primary"
              label="내 견적서와 비교하기"
              hint="견적서를 올리면 이 업체의 실제 계약과 견줘 보여드립니다"
              onPress={() => router.push('/capture')}
            />
            <ActionButton
              label="업체 정보가 다릅니다"
              hint="이름·지역이 실제와 다르면 알려주세요"
              onPress={() =>
                router.push({
                  pathname: '/my/contact',
                  params: {
                    category: 'data_correction',
                    subjectKind: 'vendor',
                    subjectId: vendor.id,
                    subjectName: vendor.name,
                  },
                })
              }
            />
            <ActionButton label="돌아가기" onPress={() => router.back()} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
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
});
