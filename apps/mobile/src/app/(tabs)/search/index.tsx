import type { VendorRegionsResponse, VendorSummary } from '@weddingpick/api-contract';
import {
  MAX_COMPARED_VENDORS,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listVendorRegions, searchVendors } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { ActionButton } from '@/components/action-button';
import { FilterChip } from '@/components/filter-chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 검색은 자주 쓰는 분류부터 보여준다. 사업계획서 6번의 확장 순서와 같다. */
const CATEGORY_ORDER: VendorCategory[] = [...VENDOR_CATEGORIES];

/** 글자를 칠 때마다 서버를 부르지 않는다. */
const DEBOUNCE_MS = 350;

type Filters = { q: string; category: VendorCategory | null; region: string | null };

export default function SearchScreen() {
  const theme = useTheme();
  const [filters, setFilters] = useState<Filters>({ q: '', category: null, region: null });
  // 서버 주소가 없으면 부를 곳도 없다. 처음부터 빈 목록으로 시작한다.
  const [vendors, setVendors] = useState<VendorSummary[] | null>(isServerConfigured ? null : []);
  const [regions, setRegions] = useState<VendorRegionsResponse['regions']>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 견줄 업체. 고른 순서를 지킨다 — 화면에 그 순서로 나온다. */
  const [picked, setPicked] = useState<string[]>([]);

  /** 늦게 도착한 옛 요청이 새 결과를 덮어쓰지 않게 한다. */
  const requestId = useRef(0);

  useEffect(() => {
    if (!isServerConfigured) return;

    listVendorRegions()
      .then((response) => setRegions(response.regions))
      // 지역 목록을 못 불러와도 검색은 된다.
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isServerConfigured) {
      return;
    }

    const id = (requestId.current += 1);
    const timer = setTimeout(() => {
      searchVendors({
        q: filters.q.trim() || undefined,
        category: filters.category ?? undefined,
        region: filters.region ?? undefined,
      })
        .then((response) => {
          if (id !== requestId.current) return;

          setVendors(response.vendors);
          setNextCursor(response.nextCursor);
          setError(null);
        })
        .catch((caught: Error) => {
          if (id !== requestId.current) return;

          setVendors([]);
          setError(caught.message);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [filters]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);

    try {
      const response = await searchVendors({
        q: filters.q.trim() || undefined,
        category: filters.category ?? undefined,
        region: filters.region ?? undefined,
        cursor: nextCursor,
      });

      setVendors((current) => [...(current ?? []), ...response.vendors]);
      setNextCursor(response.nextCursor);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [filters, nextCursor, loadingMore]);

  function toggle<K extends 'category' | 'region'>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: current[key] === value ? null : value }));
  }

  function togglePicked(vendorId: string) {
    setPicked((current) => {
      if (current.includes(vendorId)) {
        return current.filter((id) => id !== vendorId);
      }

      // 가득 찼으면 조용히 무시하지 않는다 — 아래 안내가 왜 안 담기는지 말해준다.
      return current.length >= MAX_COMPARED_VENDORS ? current : [...current, vendorId];
    });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">업체 찾기</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            placeholder="업체 이름으로 찾아보세요"
            placeholderTextColor={theme.textSecondary}
            value={filters.q}
            onChangeText={(text) => setFilters((current) => ({ ...current, q: text }))}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="업체 이름 검색"
          />

          <ThemedView style={styles.chips}>
            {CATEGORY_ORDER.map((category) => (
              <FilterChip
                key={category}
                label={VENDOR_CATEGORY_LABEL[category]}
                selected={filters.category === category}
                onPress={() => toggle('category', category)}
              />
            ))}
          </ThemedView>

          {regions.length > 0 ? (
            <ThemedView style={styles.chips}>
              {regions.map((region) => (
                <FilterChip
                  key={region.name}
                  label={`${region.name} ${region.vendorCount}곳`}
                  selected={filters.region === region.name}
                  onPress={() => toggle('region', region.name)}
                />
              ))}
            </ThemedView>
          ) : null}
        </ThemedView>

        {vendors === null ? (
          <ActivityIndicator color={theme.tint} style={styles.spinner} />
        ) : (
          <FlatList
            data={vendors}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  {!isServerConfigured
                    ? '이 빌드는 서버에 붙어 있지 않아 업체를 찾을 수 없습니다. 견적서 촬영과 기기 저장은 그대로 쓰실 수 있습니다.'
                    : error
                      ? error
                      : '찾으시는 업체가 아직 등록되지 않았습니다. 견적서를 올리시면 그 업체가 등록될 때 자동으로 이어집니다.'}
                </ThemedText>
              </ThemedView>
            }
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={theme.tint} style={styles.spinner} /> : null
            }
            renderItem={({ item }) => {
              const chosen = picked.includes(item.id);

              return (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} 자세히 보기`}
                    onPress={() => router.push(`/search/${item.id}`)}>
                    <ThemedView type="backgroundElement" style={styles.cardBody}>
                      <ThemedText type="smallBold">{item.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {VENDOR_CATEGORY_LABEL[item.category]} · {item.region}
                      </ThemedText>
                      {/*
                       * 0건도 숨기지 않는다. "아직 자료가 없다"도 사용자가 알아야 할 사실이고,
                       * 숨기면 자료가 없는 업체와 싼 업체가 같은 얼굴이 된다.
                       */}
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.comparableQuoteCount === 0
                          ? '확인된 계약 자료가 아직 없습니다'
                          : `확인된 계약 ${item.comparableQuoteCount}건`}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>

                  <ThemedView type="backgroundElement" style={styles.pickRow}>
                    <FilterChip
                      label={chosen ? '비교에서 빼기' : '비교에 담기'}
                      selected={chosen}
                      onPress={() => togglePicked(item.id)}
                    />
                  </ThemedView>
                </ThemedView>
              );
            }}
          />
        )}

        <ThemedView style={styles.footer}>
          {picked.length > 0 ? (
            <>
              <ActionButton
                variant="primary"
                label={`${picked.length}곳 비교하기`}
                hint={
                  picked.length < 2
                    ? '한 곳 더 담아주세요'
                    : picked.length >= MAX_COMPARED_VENDORS
                      ? `한 번에 ${MAX_COMPARED_VENDORS}곳까지 견줄 수 있습니다`
                      : `${MAX_COMPARED_VENDORS - picked.length}곳 더 담을 수 있습니다`
                }
                disabled={picked.length < 2}
                onPress={() => router.push(`/search/compare?ids=${picked.join(',')}`)}
              />
              <ActionButton label="비교 목록 비우기" onPress={() => setPicked([])} />
            </>
          ) : (
            <ActionButton
              label="견적서 촬영하기"
              hint="찾는 업체가 없어도 견적서를 올리면 정리해드립니다"
              onPress={() => router.push('/capture')}
            />
          )}
        </ThemedView>
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
    paddingHorizontal: Spacing.four,
  },
  header: {
    paddingTop: Spacing.five,
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  list: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardBody: {
    gap: Spacing.one,
  },
  pickRow: {
    flexDirection: 'row',
  },
  spinner: {
    paddingVertical: Spacing.five,
  },
  footer: {
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
});
