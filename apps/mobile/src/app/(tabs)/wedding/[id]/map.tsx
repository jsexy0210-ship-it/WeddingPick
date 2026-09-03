import { VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet } from 'react-native';
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
import { getMapVendors } from '@/api/client';

/**
 * 웨딩 준비 업체 지도. 핸드오프 wedding/[id].
 *
 * Pick한 업체를 목록으로 보여준다. 업체를 선택하면 카카오맵 외부 링크로
 * 위치·길찾기를 확인할 수 있다.
 *
 * 카카오맵은 네이티브 SDK 키를 앱에 내장하지 않고 공식 딥링크로 연다.
 * Android/iOS 모두 같은 경로를 사용한다.
 */

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

  const load = useCallback(() => {
    setError(null);
    getMapVendors(id)
      .then((res) => setPinned(res.vendors))
      .catch((e: Error) => setError(e.message));
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [load]);

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

  const selected = pinned.find((v) => v.vendorId === selectedId) ?? null;

  function openKakao(vendor: PinnedVendor) {
    const q = encodeURIComponent(`${vendor.vendorName} ${vendor.address}`);
    void Linking.openURL(`https://map.kakao.com/?q=${q}`);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedView style={styles.header}>
            <ThemedText type="t5">Pick한 업체 위치</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              업체를 선택한 뒤 카카오맵에서 위치와 길찾기를 확인하세요.
            </ThemedText>
          </ThemedView>

          {pinned.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText type="t7" themeColor="textSecondary">
                Pick한 업체 중 위치 정보가 있는 곳이 없어요.
              </ThemedText>
            </ThemedView>
          ) : (
            pinned.map((vendor) => {
              const isSelected = vendor.vendorId === selectedId;
              return (
                <Pressable
                  key={vendor.vendorId}
                  onPress={() => setSelectedId(isSelected ? null : vendor.vendorId)}
                  accessibilityRole="button"
                  accessibilityLabel={vendor.vendorName}
                >
                  <ThemedView
                    type="backgroundElement"
                    style={[
                      styles.vendorCard,
                      isSelected && { borderColor: theme.tint, borderWidth: 1.5 },
                    ]}
                  >
                    <ThemedView style={styles.vendorInfo}>
                      <ThemedText type="t6" numberOfLines={1}>
                        {vendor.vendorName}
                      </ThemedText>
                      <ThemedText type="t7" themeColor="textSecondary">
                        {VENDOR_CATEGORY_LABEL[vendor.category as keyof typeof VENDOR_CATEGORY_LABEL] ?? vendor.category}
                        {vendor.address ? ` · ${vendor.address}` : ''}
                      </ThemedText>
                    </ThemedView>
                    {isSelected && (
                      <ThemedView style={styles.selectedActions}>
                        <ActionButton
                          variant="primary"
                          size="large"
                          label="카카오맵에서 위치 보기"
                          onPress={() => openKakao(vendor)}
                        />
                        <ActionButton
                          size="large"
                          label="업체 상세 보기"
                          onPress={() => router.push(`/search/${vendor.vendorId}`)}
                        />
                      </ThemedView>
                    )}
                  </ThemedView>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        <ThemedView style={styles.footer}>
          {selected ? (
            <ActionButton
              variant="primary"
              size="large"
              label="카카오맵에서 위치 보기"
              onPress={() => openKakao(selected)}
            />
          ) : null}
          <ActionButton size="large" label="돌아가기" onPress={() => router.back()} />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  scroll: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  header: { gap: Spacing.one, marginBottom: Spacing.one },
  emptyCard: {
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
  vendorCard: {
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  vendorInfo: { gap: Spacing.one },
  selectedActions: { gap: Spacing.two },
  footer: {
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
