import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { API_URL } from '@/api/config';
import { openExternal } from '@/features/open-external';
import {
  Border,
  Layout,
  Radius,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';

type Coordinates = { lat: number; lng: number };

export function VendorLocationSection({
  vendorId,
  name,
  region,
  address,
  coordinates,
}: {
  vendorId: string;
  name: string;
  region: string;
  address?: string | null;
  coordinates: Coordinates | null;
}) {
  const theme = useTheme();
  const [mapFailed, setMapFailed] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const apiBase = API_URL?.replace(/\/$/, '') ?? '';
  const normalizedAddress = address?.trim() || null;
  const hasMapSource = coordinates !== null || normalizedAddress !== null;
  const mapUri =
    apiBase && hasMapSource
      ? `${apiBase}/v1/vendors/${encodeURIComponent(vendorId)}/static-map`
      : null;

  const mapUrl = coordinates
    ? `https://map.kakao.com/link/map/${encodeURIComponent(name)},${coordinates.lat},${coordinates.lng}`
    : `https://map.kakao.com/link/search/${encodeURIComponent(`${name} ${normalizedAddress ?? region}`)}`;

  useEffect(() => {
    setMapFailed(false);
    setMapLoaded(false);
  }, [mapUri]);

  useEffect(() => {
    setAddressCopied(false);
  }, [normalizedAddress]);

  async function openMap() {
    try {
      await openExternal(mapUrl, { handOff: true });
    } catch {
      /*
       * handoff가 막힌 기기에서도 HTTPS Kakao Map URL 자체는 살아 있다.
       * 특정 지도 앱 설치를 가정하지 않고 인앱 브라우저/웹으로 한 번 더 연다.
       */
      try {
        await openExternal(mapUrl, { title: '지도' });
      } catch {
        // 지도 열기 실패가 업체 상세 화면 자체를 깨뜨리면 안 된다.
      }
    }
  }

  async function copyAddress() {
    if (!normalizedAddress) return;

    try {
      const copied = await Clipboard.setStringAsync(normalizedAddress);
      setAddressCopied(copied);
    } catch {
      setAddressCopied(false);
    }
  }

  const mapActionLabel = hasMapSource ? '지도에서 보기' : '지도에서 검색';

  return (
    <View style={styles.block}>
      {normalizedAddress ? (
        <View style={styles.addressRow}>
          <ThemedText type="t6" themeColor="textAssistive">
            주소
          </ThemedText>
          <ThemedText type="t6" style={styles.addressValue} selectable>
            {normalizedAddress}
          </ThemedText>
        </View>
      ) : null}

      {mapUri && !mapFailed ? (
        <View style={styles.mapFrame}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${name} 위치 지도`}
            onPress={() => void openMap()}
            style={({ pressed }) => [styles.mapPressable, pressed ? styles.pressed : null]}>
            <Image
              source={{ uri: mapUri }}
              style={[styles.mapImage, { backgroundColor: theme.backgroundElement }]}
              resizeMode="cover"
              onLoad={() => setMapLoaded(true)}
              onError={() => setMapFailed(true)}
            />
          </Pressable>
          {!mapLoaded ? (
            <View
              pointerEvents="none"
              style={[styles.mapStatus, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="t7" themeColor="textAssistive">
                지도를 불러오는 중이에요
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.fallbackBox, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="t7" themeColor="textAssistive">
            {mapFailed ? '지도 이미지를 불러오지 못했어요' : '위치 정보가 아직 없어요'}
          </ThemedText>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={mapActionLabel}
          onPress={() => void openMap()}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: theme.backgroundElement },
            pressed ? styles.pressed : null,
          ]}>
          <ThemedText type="t7">{mapActionLabel}</ThemedText>
        </Pressable>

        {normalizedAddress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="주소 복사"
            onPress={() => void copyAddress()}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: theme.backgroundElement },
              pressed ? styles.pressed : null,
            ]}>
            <ThemedText type="t7" accessibilityLiveRegion="polite">
              {addressCopied ? '복사됨' : '주소 복사'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two,
  },
  addressRow: {
    minHeight: Layout.rowMinHeight,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.inlineGap,
    paddingVertical: Layout.rowPaddingY,
  },
  addressValue: {
    flex: 1,
    textAlign: 'right',
  },
  mapFrame: {
    position: 'relative',
  },
  mapPressable: {
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  mapImage: {
    width: '100%',
    aspectRatio: 2,
  },
  mapStatus: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
  },
  fallbackBox: {
    minHeight: Layout.rowMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    paddingHorizontal: Layout.cardPadding,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    minHeight: Layout.touchTarget,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
  },
  divider: {
    height: Border.hairline,
  },
  pressed: {
    opacity: 0.72,
  },
});
