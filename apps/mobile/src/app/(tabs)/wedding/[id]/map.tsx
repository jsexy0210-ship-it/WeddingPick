import { VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
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
import { getMapVendors, getVendor } from '@/api/client';
import type { VendorDetail } from '@weddingpick/api-contract';

/**
 * 웨딩 준비 업체 지도. 핸드오프 wedding/[id].
 * Pick한 업체들을 지도에 표시한다 — 좌표가 있는 업체만 핀이 찍힌다.
 * 마커 탭 → 업체 상세 이동.
 */

/** 대한민국 전체가 보이는 기본 위치 */
const KOREA_REGION: Region = {
  latitude: 36.5,
  longitude: 127.8,
  latitudeDelta: 6,
  longitudeDelta: 6,
};

type PinnedVendor = {
  vendorId: string;
  vendorName: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  picked: boolean;
};

export default function WeddingMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  const [pinned, setPinned] = useState<PinnedVendor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<VendorDetail | null>(null);

  const load = useCallback(() => {
    setError(null);
    getMapVendors(id)
      .then((res) => setPinned(res.vendors))
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }
    setDetailLoading(true);
    getVendor(selectedId)
      .then((detail) => setSelectedDetail(detail))
      .catch(() => setSelectedDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  if (error) {
    return (
      <ErrorView
        title="지도를 불러오지 못했어요"
        message={error}
        onRetry={load}
        retryLabel="다시 시도"
        onBack={() => router.back()}
        backLabel="돌아가기"
      />
    );
  }

  if (pinned === null) {
    return <LoadingView />;
  }

  const initialRegion =
    pinned.length > 0
      ? (() => {
          const lats = pinned.map((p) => p.lat);
          const lngs = pinned.map((p) => p.lng);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          return {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max(maxLat - minLat, 0.05) * 1.5,
            longitudeDelta: Math.max(maxLng - minLng, 0.05) * 1.5,
          };
        })()
      : KOREA_REGION;

  const selectedVendor = pinned.find((p) => p.vendorId === selectedId) ?? null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <MapView
          style={styles.map}
          initialRegion={initialRegion}
          onPress={() => setSelectedId(null)}
        >
          {pinned.map((vendor) => (
            <Marker
              key={vendor.vendorId}
              coordinate={{ latitude: vendor.lat, longitude: vendor.lng }}
              title={vendor.vendorName}
              pinColor={
                vendor.vendorId === selectedId ? theme.tint : theme.tintInactive
              }
              onPress={() => setSelectedId(vendor.vendorId)}
            />
          ))}
        </MapView>

        {/* 업체 없음 안내 */}
        {pinned.length === 0 && (
          <ThemedView type="backgroundElement" style={styles.banner}>
            <ThemedText type="t7" themeColor="textSecondary">
              Pick한 업체 중 지도에 표시할 수 있는 곳이 없어요
            </ThemedText>
          </ThemedView>
        )}

        {/* 선택한 업체 요약 카드 */}
        {selectedVendor && (
          <Pressable
            onPress={() => router.push(`/search/${selectedVendor.vendorId}`)}
            accessibilityRole="button"
            accessibilityLabel={`${selectedVendor.vendorName} 상세 보기`}
          >
            <ThemedView
              type="backgroundElement"
              style={[styles.summaryCard, { borderColor: theme.border }]}
            >
              <ThemedText type="t5" numberOfLines={1}>
                {selectedVendor.vendorName}
              </ThemedText>
              <ThemedText type="t7" themeColor="textSecondary">
                {VENDOR_CATEGORY_LABEL[selectedVendor.category as keyof typeof VENDOR_CATEGORY_LABEL] ?? selectedVendor.category}
              </ThemedText>
              {detailLoading ? (
                <ThemedText type="t7" themeColor="textAssistive">
                  정보를 가져오고 있어요
                </ThemedText>
              ) : selectedDetail ? (
                <ThemedText type="t7" themeColor="textAssistive">
                  {selectedDetail.region}
                </ThemedText>
              ) : null}
              <ActionButton
                variant="primary"
                size="large"
                label="자세히 보기"
                onPress={() => router.push(`/search/${selectedVendor.vendorId}`)}
              />
            </ThemedView>
          </Pressable>
        )}

        {/* 돌아가기 */}
        <ThemedView style={styles.backRow}>
          <ActionButton
            variant="secondary"
            size="large"
            label="돌아가기"
            onPress={() => router.back()}
          />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  map: { flex: 1 },
  banner: {
    position: 'absolute',
    left: Layout.gutter,
    right: Layout.gutter,
    bottom: Layout.sectionGap + Layout.controlLarge + Spacing.two,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  summaryCard: {
    position: 'absolute',
    left: Layout.gutter,
    right: Layout.gutter,
    bottom: Layout.sectionGap + Layout.controlLarge + Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  backRow: {
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.two,
  },
});
