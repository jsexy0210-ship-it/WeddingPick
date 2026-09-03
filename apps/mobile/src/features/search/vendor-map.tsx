import type { VendorSummary } from '@weddingpick/api-contract';
import { rangeLabel, STILL_COLLECTING, VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet } from 'react-native';

import { ActionButton, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

type Props = {
  vendors: readonly VendorSummary[];
  loading: boolean;
  onRefresh: () => void;
};

/**
 * 검색 결과 지도 보기. 핸드오프 WP-SRCH-007.
 *
 * **새 검색 로직을 만들지 않는다.** 지도는 목록 화면이 이미 불러온 검색
 * 결과 위에 핀을 얹을 뿐이다 — 좌표가 있는 업체만 지도에 뜨고, 좌표가
 * 없는 업체는 목록에는 그대로 남는다(coordinates가 null인 업체).
 *
 * 카카오맵은 네이티브 SDK 키를 앱에 내장하지 않고 공식 딥링크로 연다.
 * 따라서 Android/iOS/Web 모두 같은 운영 경로를 사용하고 Google placeholder가
 * 남아 배포가 실패하는 문제를 피한다.
 */
export function VendorMap({ vendors, loading, onRefresh }: Props) {
  const theme = useTheme();
  /*
   * id만 들고 있는다. 검색 결과가 바뀌면(vendors가 새로 온다) 고른 업체가 새
   * 목록에 없을 수 있는데, 아래에서 찾은 값이 자연히 null이 되어 선택이
   * 풀린다 — 이걸 맞추려는 effect를 따로 두지 않는다.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pinned = vendors.filter((v) => v.coordinates !== null);
  const selected = pinned.find((v) => v.id === selectedId) ?? null;

  return (
    <ThemedView style={styles.container}>
      <ThemedView type="backgroundElement" style={styles.mapSurface}>
        <ThemedText type="t5">카카오맵으로 업체 위치 확인</ThemedText>
        <ThemedText type="t7" themeColor="textSecondary">
          업체를 선택하면 카카오맵에서 주소와 길찾기를 바로 확인할 수 있어요.
        </ThemedText>
        {pinned.map((vendor) => (
          <Pressable key={vendor.id} style={styles.vendorRow} onPress={() => setSelectedId(vendor.id)}>
            <ThemedText type="t6">{vendor.name}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {vendor.region} · {VENDOR_CATEGORY_LABEL[vendor.category]}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedView>

      <ThemedView style={styles.controls}>
        {selected ? (
          <ActionButton
            label="카카오맵에서 위치 보기"
            onPress={() => void Linking.openURL(`https://map.kakao.com/?q=${encodeURIComponent(selected.name)}`)}
          />
        ) : null}
        <ActionButton label="이 조건으로 다시 찾기" onPress={onRefresh} disabled={loading} />
      </ThemedView>

      {!loading && pinned.length === 0 ? (
        <ThemedView type="backgroundElement" style={styles.banner}>
          <ThemedText type="t7" themeColor="textSecondary">
            {vendors.length === 0
              ? '이 조건에 맞는 업체가 없어요.'
              : '이 조건의 업체는 아직 지도 위치가 확인되지 않았어요. 목록 보기로 확인해주세요.'}
          </ThemedText>
        </ThemedView>
      ) : null}

      {selected ? (
        <Pressable onPress={() => router.push(`/search/${selected.id}`)}>
          <ThemedView type="backgroundElement" style={[styles.summaryCard, { borderColor: theme.border }]}>
            <ThemedText type="t5">{selected.name}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {VENDOR_CATEGORY_LABEL[selected.category]} · {selected.region}
            </ThemedText>
            {selected.paidPrice.stage === 'collecting' ? (
              <ThemedText type="t7" themeColor="textAssistive">
                {STILL_COLLECTING}
              </ThemedText>
            ) : (
              <ThemedText type="t6" numeric>
                {rangeLabel(selected.paidPrice.low, selected.paidPrice.high)}
              </ThemedText>
            )}
            <ActionButton
              variant="primary"
              label="자세히 보기"
              onPress={() => router.push(`/search/${selected.id}`)}
            />
          </ThemedView>
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: Spacing.two },
  mapSurface: {
    flex: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  vendorRow: {
    borderRadius: Radius.small,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  controls: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    gap: Spacing.two,
  },
  banner: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  summaryCard: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
