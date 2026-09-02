import type { VendorSummary } from '@weddingpick/api-contract';
import { rangeLabel, STILL_COLLECTING, VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { ActionButton, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

/** 위치를 못 정했을 때 지도 시작 자리. 대한민국 전체가 보이는 정도의 확대. */
const KOREA_REGION: Region = {
  latitude: 36.5,
  longitude: 127.8,
  latitudeDelta: 6,
  longitudeDelta: 6,
};

function regionAround(vendors: readonly VendorSummary[]): Region | null {
  const pinned = vendors.filter((v) => v.coordinates !== null);

  if (pinned.length === 0) return null;

  const lats = pinned.map((v) => v.coordinates!.lat);
  const lngs = pinned.map((v) => v.coordinates!.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    // 핀이 한 곳뿐이면 폭이 0이 된다 — 최소 폭을 둔다.
    latitudeDelta: Math.max(maxLat - minLat, 0.05) * 1.4,
    longitudeDelta: Math.max(maxLng - minLng, 0.05) * 1.4,
  };
}

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
 * 웹은 react-native-maps가 지도를 그리지 못한다(MapView.web.ts가
 * UnimplementedView다) — 빈 화면 대신 안내를 보여준다.
 */
export function VendorMap({ vendors, loading, onRefresh }: Props) {
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [locationError, setLocationError] = useState<string | null>(null);
  /*
   * id만 들고 있는다. 검색 결과가 바뀌면(vendors가 새로 온다) 고른 업체가 새
   * 목록에 없을 수 있는데, 아래에서 찾은 값이 자연히 null이 되어 선택이
   * 풀린다 — 이걸 맞추려는 effect를 따로 두지 않는다.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pinned = vendors.filter((v) => v.coordinates !== null);
  const selected = pinned.find((v) => v.id === selectedId) ?? null;

  if (Platform.OS === 'web') {
    return (
      <ThemedView style={styles.webFallback}>
        <ThemedText type="t6">지도는 앱에서 볼 수 있어요</ThemedText>
        <ThemedText type="t7" themeColor="textSecondary">
          이 화면은 웹에서 지도를 그릴 수 없어요. 목록 보기를 이용해주세요.
        </ThemedText>
      </ThemedView>
    );
  }

  async function goToCurrentLocation() {
    setLocationError(null);

    let granted = permission?.granted ?? false;

    if (!granted) {
      const result = await requestPermission();
      granted = result.granted;
    }

    if (!granted) {
      setLocationError('위치 접근이 허용되지 않았어요. 설정에서 위치 권한을 켜주세요.');

      return;
    }

    try {
      const position = await Location.getCurrentPositionAsync({});

      mapRef.current?.animateToRegion(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        400
      );
    } catch {
      setLocationError('지금 위치를 확인하지 못했어요.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={regionAround(vendors) ?? KOREA_REGION}
        showsUserLocation={permission?.granted ?? false}
        onPress={() => setSelectedId(null)}>
        {pinned.map((vendor) => (
          <Marker
            key={vendor.id}
            coordinate={{ latitude: vendor.coordinates!.lat, longitude: vendor.coordinates!.lng }}
            title={vendor.name}
            onPress={() => setSelectedId(vendor.id)}
          />
        ))}
      </MapView>

      <ThemedView style={styles.controls}>
        <ActionButton label="현재 위치" onPress={() => void goToCurrentLocation()} />
        <ActionButton label="이 조건으로 다시 찾기" onPress={onRefresh} disabled={loading} />
      </ThemedView>

      {locationError ? (
        <ThemedView type="backgroundElement" style={[styles.banner, styles.errorBanner]}>
          <ThemedText type="t7" themeColor="negative">
            {locationError}
          </ThemedText>
        </ThemedView>
      ) : null}

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
  map: { flex: 1, borderRadius: Radius.medium, overflow: 'hidden' },
  webFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    padding: Spacing.four,
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
  errorBanner: { top: Spacing.three, bottom: undefined },
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
