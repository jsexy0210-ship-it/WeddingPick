import type { VendorDetail } from '@weddingpick/api-contract';
import { priceLine } from '@weddingpick/domain';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getVendor } from '@/api/client';
import { DepthHeader } from '@/components/depth-header';
import { useDepthBack } from '@/features/navigation/depth-back';
import {
  ErrorView,
  Layout,
  LineHeight,
  MaxContentWidth,
  Skeleton,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

/** 정본 `navTitle` 「제보 금액」. */
const TITLE = '제보 금액';

/**
 * WP-VEND-007 제보 금액 상세 — `docs/design/React_Native/search.jsx` frame-010 · `search.js`
 * (`secTop` · `priceBig` · `priceMeta` · `priceDist` · `note`). 업체 상세 제보 금액 블록의
 * «자세히»에서 들어온다(tagDesc 「구간 · 건수 · 조건별 분포 · 최근 변화 순입니다」).
 *
 * 지금 그리는 것은 **구간 · 건수**(금액 30/38 · 설명 13)뿐이다. 한 줄은 검색·상세·비교와
 * 같은 `priceLine()`으로만 만든다.
 *
 * **DESIGN_UNRESOLVED(서버 필요) — 「조건별 분포」 · 「최근 변화」.** 실 제보를 조건(예산 구간)별로
 * 센 값도, 기간별 기준금액 변화도 `vendorDetailSchema`에 없다. `prices.products`는 사람이 심사한
 * 계약 통계라 실 제보(`paidPrice`)와 다른 숫자다(api-contract `vendorPricesSchema` 주석) — 그것을
 * 분포 막대로 옮기면 출처가 섞인다. 없는 숫자를 지어 넣지 않고 두 묶음을 비워 둔다.
 */
export default function VendorPriceScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const depthBack = useDepthBack();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVendor(vendorId)
      .then(setVendor)
      .catch((caught: Error) => setError(caught.message));
  }, [vendorId]);

  if (error) {
    return <ErrorView message={error} onBack={depthBack} />;
  }

  const line = vendor ? priceLine(vendor.prices.paidPrice, vendor.guidePrice) : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <DepthHeader title={TITLE} onBack={depthBack} />
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* 정본 `secTop`: 안쪽 20 · 사이 14 — 금액 `priceBig` 30/38 700 · `priceMeta` 13 보조색. */}
          <View style={styles.secTop}>
            {line ? (
              <>
                <ThemedText
                  type="f30"
                  numeric
                  themeColor={line.dim ? 'textAssistive' : undefined}
                  style={[styles.bold, styles.priceBig]}>
                  {line.text}
                </ThemedText>
                <ThemedText type="f13" themeColor="textAssistive" numeric>
                  {line.caption}
                </ThemedText>
              </>
            ) : (
              <>
                <Skeleton width="48%" height={LineHeight.lh38} />
                <Skeleton width="72%" height={Spacing.three} />
              </>
            )}
          </View>
        </ScrollView>
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
  scroll: {
    flex: 1,
  },
  /* 정본 `secTop` padding 20 → 좌우는 전역 거터(24)에 맞춘다. 사이 14. */
  secTop: {
    paddingHorizontal: Layout.pageX,
    paddingVertical: Layout.cardPadding,
    gap: Layout.sectionHeadGap,
  },
  priceBig: {
    lineHeight: LineHeight.lh38,
  },
  bold: {
    fontWeight: 700,
  },
});
