import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getCurrentUser, getRemovedCandidates } from '@/api/client';
import {
  EmptyView,
  ErrorView,
  FontSize,
  Layout,
  LineHeight,
  MaxContentWidth,
  Radius,
  Skeleton,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

const S = {
  title: '제거된 후보',
  'empty.title': '제거된 후보가 없어요',
  'empty.description': '후보에서 제거한 업체가 여기에 표시돼요',
  error: '제거된 후보 목록을 불러오지 못했어요',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function RemovedSkeleton() {
  return (
    <View style={{ paddingHorizontal: Layout.gutter, paddingTop: Spacing.four }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ marginBottom: Spacing.four }}>
          <Skeleton width={80} height={14} radius={4} style={{ marginBottom: Spacing.two }} />
          <Skeleton width="100%" height={56} radius={Radius.card} style={{ marginBottom: Spacing.one }} />
          <Skeleton width="100%" height={56} radius={Radius.card} />
        </View>
      ))}
    </View>
  );
}

export default function PickRemovedScreen() {
  const theme = useTheme();

  const [groups, setGroups] = useState<
    { category: string; categoryLabel: string; items: { id: string; vendorName: string; removedAt: string }[] }[] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (!user.weddingId) {
          setGroups([]);
          return;
        }
        return getRemovedCandidates(user.weddingId).then((res) => setGroups(res.groups));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const styles = makeStyles(theme);

  if (loading) {
    return (
      <ThemedView style={styles.flex}>
        <Stack.Screen options={{ title: S.title }} />
        <RemovedSkeleton />
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.flex}>
        <Stack.Screen options={{ title: S.title }} />
        <ErrorView message={S.error} />
      </ThemedView>
    );
  }

  const hasItems = groups && groups.some((g) => g.items.length > 0);

  if (!hasItems) {
    return (
      <ThemedView style={styles.flex}>
        <Stack.Screen options={{ title: S.title }} />
        <EmptyView
          title={S['empty.title']}
          description={S['empty.description']}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: S.title }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {groups!
          .filter((g) => g.items.length > 0)
          .map((group) => (
            <View key={group.category} style={styles.categoryBlock}>
              <ThemedText themeColor="textSecondary" style={styles.categoryLabel}>
                {group.categoryLabel}
              </ThemedText>
              {group.items.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.vendorRow,
                    { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  ]}
                >
                  <View style={styles.vendorInfo}>
                    <ThemedText style={styles.vendorName} numberOfLines={1}>
                      {item.vendorName}
                    </ThemedText>
                    <ThemedText themeColor="textAssistive" style={styles.vendorMeta}>
                      {formatDate(item.removedAt)} 제거
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ))}
      </ScrollView>
    </ThemedView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    flex: { flex: 1 },
    scroll: {
      paddingHorizontal: Layout.gutter,
      paddingTop: Spacing.four,
      paddingBottom: Spacing.six,
      maxWidth: MaxContentWidth,
      alignSelf: 'center',
      width: '100%',
    },
    categoryBlock: {
      marginBottom: Layout.sectionGap,
    },
    categoryLabel: {
      fontSize: FontSize.t6,
      lineHeight: LineHeight.t6,
      fontWeight: '700',
      marginBottom: Spacing.two,
    },
    vendorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: Layout.rowMinHeight,
      borderRadius: Radius.card,
      borderWidth: 1,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      marginBottom: Spacing.one,
    },
    vendorInfo: {
      flex: 1,
    },
    vendorName: {
      fontSize: FontSize.t6,
      lineHeight: LineHeight.t6,
      fontWeight: '700',
      marginBottom: 2,
    },
    vendorMeta: {
      fontSize: FontSize.t7,
      lineHeight: LineHeight.t7,
    },
  });
}
