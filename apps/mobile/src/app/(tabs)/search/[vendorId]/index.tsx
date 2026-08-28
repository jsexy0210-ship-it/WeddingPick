import type { VendorDetail } from '@weddingpick/api-contract';
import { DOCUMENT_TYPE_LABEL, VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addCandidate, ensureWedding, getVendor } from '@/api/client';
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
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function save() {
    setSaving(true);
    setSaveNote(null);

    try {
      const weddingId = await ensureWedding();

      await addCandidate(weddingId, vendor!.id);
      setSaveNote('담았습니다. 내 웨딩에서 보실 수 있습니다.');
    } catch (caught) {
      setSaveNote(caught instanceof Error ? caught.message : '담지 못했습니다.');
    } finally {
      setSaving(false);
    }
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

          {/*
            가격은 잠길 수 있다. 사업계획서 v3 7번 Level 3 — 결제인증 제보를 한 건
            이상 낸 사람이 실제가격을 본다. 잠긴 상태를 빈칸으로 그리지 않는다.
          */}
          {vendor.prices.available === 'locked' ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">실제 가격</ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  {vendor.prices.productCount === 0
                    ? '이 업체의 확인된 계약 자료가 아직 없습니다.'
                    : `확인된 계약이 ${vendor.prices.productCount}건 모여 있습니다.`}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {vendor.prices.requirement}
                </ThemedText>
              </ThemedView>
              <ActionButton
                variant="primary"
                label="결제인증 제보하기"
                hint="결제내역을 찍으면 실제 가격이 열립니다"
                onPress={() => router.push('/capture')}
              />
            </ThemedView>
          ) : (
            <>
              <ThemedView style={styles.section}>
                <ThemedText type="smallBold">실제 계약 가격</ThemedText>

                {vendor.prices.products.length === 0 ? (
                  <ThemedView type="backgroundElement" style={styles.card}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {vendor.comparableQuoteCount === 0
                        ? '이 업체의 확인된 계약 자료가 아직 없습니다.'
                        : `확인된 계약이 ${vendor.comparableQuoteCount}건 모였지만, 같은 상품끼리 견주기에는 아직 모자랍니다.`}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      자료가 모이기 전에는 가격을 지어내지 않습니다.
                    </ThemedText>
                  </ThemedView>
                ) : (
                  vendor.prices.products.map((product) => (
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

              {/*
                결제인증은 계약 중앙값과 **다른 칸**에 그린다. 근거가 다르다 —
                하나는 사람이 심사한 계약이고 하나는 기계가 읽은 결제내역이다.
              */}
              <ThemedView style={styles.section}>
                <ThemedText type="smallBold">결제인증 금액</ThemedText>
                <ThemedView type="backgroundElement" style={styles.card}>
                  {vendor.prices.paidPrice.available === true ? (
                    <>
                      <ThemedText type="subtitle">
                        {won(vendor.prices.paidPrice.median)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        결제인증 {vendor.prices.paidPrice.count}건 ·{' '}
                        {vendor.prices.paidPrice.periodStart}~
                        {vendor.prices.paidPrice.periodEnd}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {vendor.prices.paidPrice.caveat}
                      </ThemedText>
                    </>
                  ) : vendor.prices.paidPrice.available === false ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {vendor.prices.paidPrice.reason}
                    </ThemedText>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      {vendor.prices.paidPrice.requirement}
                    </ThemedText>
                  )}
                </ThemedView>
              </ThemedView>
            </>
          )}

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">이용점수</ThemedText>

            {/*
              확인된 후기만 들어간다. 표본이 모자라면 숫자를 만들지 않고 이유를 준다 —
              가격과 같은 규칙이다. 후기 두세 건으로 만든 점수는 정보가 아니라 소음이고,
              업체 하나를 망칠 수도 살릴 수도 있다.
            */}
            <ThemedView type="backgroundElement" style={styles.card}>
              {vendor.usageScore.available ? (
                <>
                  <ThemedText type="subtitle">{vendor.usageScore.average.toFixed(1)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    확인된 후기 {vendor.usageScore.count}건
                  </ThemedText>
                  {vendor.usageScore.aspects.map((aspect) => (
                    <ThemedText key={aspect.key} type="small" themeColor="textSecondary">
                      {aspect.label} {aspect.average.toFixed(1)}
                    </ThemedText>
                  ))}
                </>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {vendor.usageScore.reason}
                </ThemedText>
              )}
            </ThemedView>

            <ActionButton
              label="후기 보기"
              hint="이용하신 분들이 남긴 글입니다"
              onPress={() => router.push(`/search/${vendor.id}/reviews`)}
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            {/*
              담아두는 자리. 사람이 아니라 웨딩에 매단다 — 배우자가 같은 목록을
              보고, 그래야 같은 이야기를 할 수 있다.
            */}
            <ActionButton
              variant="primary"
              label={saving ? '담는 중…' : '후보에 담기'}
              hint="배우자와 함께 보는 목록에 들어갑니다"
              disabled={saving}
              onPress={() => void save()}
            />
            {saveNote ? (
              <ThemedText type="small" themeColor="textSecondary">
                {saveNote}
              </ThemedText>
            ) : null}
            <ActionButton
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
