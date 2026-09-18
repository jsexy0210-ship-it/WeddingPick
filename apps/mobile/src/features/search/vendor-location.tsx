import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { API_URL } from '@/api/config';
import { openExternal } from '@/features/open-external';
import {
  Border,
  Layout,
  ProductSymbol,
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
  const apiBase = API_URL?.replace(/\/$/, '') ?? '';
  const mapUri =
    apiBase && (coordinates || address)
      ? `${apiBase}/v1/vendors/${encodeURIComponent(vendorId)}/static-map`
      : null;

  const mapUrl = coordinates
    ? `https://map.kakao.com/link/map/${encodeURIComponent(name)},${coordinates.lat},${coordinates.lng}`
    : `https://map.kakao.com/link/search/${encodeURIComponent(`${name} ${address ?? region}`)}`;

  function openMap() {
    void openExternal(mapUrl, { handOff: true });
  }

  return (
    <View style={styles.block}>
      {address ? (
        <View style={styles.addressRow}>
          <ThemedText type="t6" themeColor="textAssistive">
            주소
          </ThemedText>
          <ThemedText type="t6" style={styles.addressValue} selectable>
            {address}
          </ThemedText>
        </View>
      ) : null}

      {mapUri && !mapFailed ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${name} 위치 지도`}
          onPress={openMap}
          style={({ pressed }) => [styles.mapPressable, pressed ? styles.pressed : null]}>
          <Image
            source={{ uri: mapUri }}
            style={[styles.mapImage, { backgroundColor: theme.backgroundElement }]}
            resizeMode="cover"
            onError={() => setMapFailed(true)}
          />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="지도에서 보기"
        onPress={openMap}
        style={({ pressed }) => [styles.linkRow, pressed ? styles.pressed : null]}>
        <ThemedText type="t6" style={styles.linkLabel}>
          지도에서 보기
        </ThemedText>
        <ProductSymbol
          name="chevronRight"
          size={Layout.iconInline}
          color={theme.textDisabled}
        />
      </Pressable>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.inlineGap,
    paddingVertical: Layout.inlineGap,
  },
  addressValue: {
    flex: 1,
    textAlign: 'right',
  },
  mapPressable: {
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  mapImage: {
    width: '100%',
    aspectRatio: 2,
  },
  linkRow: {
    minHeight: Layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkLabel: {
    flex: 1,
  },
  divider: {
    height: Border.hairline,
  },
  pressed: {
    opacity: 0.72,
  },
});
