import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
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
} from '@weddingpick/ui';
import { getCurrentUser } from '@/api/client';

/**
 * Pick 히스토리.
 *
 * **아직 서버 계약이 없는 화면이다.** `/v1/weddings/{id}/candidates/removed` 경로가
 * 생기는 날 `load()` 안에 실제 호출을 넣는다. 그때까지 구조만 완성해두고 빈 상태로
 * 뜬다.
 *
 * 빈 상태가 있어야 하는 이유: 처음 온 사람에게 아무것도 안 보이는 화면이 뜨면
 * 무엇이 잘못됐는지 생각한다. "아직 없어요"가 그 생각을 막는다.
 */

type PickHistoryItem = {
  id: string;
  vendorId: string;
  vendorName: string;
  category: string;
  categoryLabel: string;
  addedAt: string;
  removedAt: string;
};

type PickHistoryGroup = {
  category: string;
  categoryLabel: string;
  items: PickHistoryItem[];
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function PickHistoryScreen() {
  const [groups, setGroups] = useState<PickHistoryGroup[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    // weddingId를 확인한 뒤 히스토리를 불러온다.
    // API 계약이 생기면 여기에 /v1/weddings/{id}/candidates/removed 호출을 넣는다.
    void getCurrentUser()
      .then(() => {
        setLoadError(null);
        // 아직 히스토리 API가 없어 빈 목록으로 둔다.
        setGroups([]);
      })
      .catch((caught: Error) =>
        setLoadError(caught.message ?? '정보를 불러오지 못했어요.')
      );
  }, []);

  useEffect(load, [load]);

  if (loadError) {
    return <ErrorView message={loadError} onBack={load} />;
  }

  if (groups === null) {
    return <LoadingView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">Pick 히스토리</ThemedText>

          {groups.length === 0 ? (
            <ThemedView style={styles.empty}>
              <ThemedText type="t6" themeColor="textSecondary">
                아직 Pick에서 뺀 곳이 없어요
              </ThemedText>
              <ThemedText type="t7" themeColor="textAssistive">
                Pick했다가 뺀 업체가 여기 쌓여요
              </ThemedText>
            </ThemedView>
          ) : null}

          {groups.map((group) => (
            <ThemedView key={group.category} style={styles.group}>
              <ThemedText type="t4">{group.categoryLabel}</ThemedText>

              {group.items.map((item) => (
                <ThemedView key={item.id} type="backgroundElement" style={styles.row}>
                  <ThemedView type="backgroundElement" style={styles.rowMeta}>
                    <ThemedText type="t5">{item.vendorName}</ThemedText>
                    <ThemedText type="t7" themeColor="textAssistive">
                      Pick 추가 {formatDate(item.addedAt)} · 제거 {formatDate(item.removedAt)}
                    </ThemedText>
                  </ThemedView>
                  <ActionButton
                    label="다시 후보 추가"
                    onPress={() =>
                      router.push(`/search/${item.vendorId}` as Parameters<typeof router.push>[0])
                    }
                  />
                </ThemedView>
              ))}
            </ThemedView>
          ))}

          {groups.length > 0 ? (
            <ThemedText type="t7" themeColor="textAssistive">
              업종별로 정리해요
            </ThemedText>
          ) : null}
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
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  empty: {
    paddingTop: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  group: {
    gap: Spacing.two,
  },
  row: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  rowMeta: {
    gap: 2,
  },
});
