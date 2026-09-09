import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getCurrentUser, getRemovedCandidates } from '@/api/client';
import {
  EmptyView,
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Skeleton,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';
import { NavBar, Screen } from '@/features/wedding/screen-kit';

/**
 * 제거된 후보. WP-PICK-007 결정 내역의 «제거된 후보 보기»에서만 들어오므로 뒤로는
 * 결정 내역(`/pick/history`)이다 — Depth Back 예외표에 근거를 적어뒀다.
 */
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
          <Skeleton width="100%" height={56} radius={Radius.medium} style={{ marginBottom: Spacing.one }} />
          <Skeleton width="100%" height={56} radius={Radius.medium} />
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
      <Screen>
        <NavBar title={S.title} />
        <RemovedSkeleton />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <NavBar title={S.title} />
        <ErrorView message={S.error} />
      </Screen>
    );
  }

  const hasItems = groups && groups.some((g) => g.items.length > 0);

  if (!hasItems) {
    return (
      <Screen>
        <NavBar title={S.title} />
        <EmptyView
          title={S['empty.title']}
          description={S['empty.description']}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar title={S.title} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {groups!
          .filter((g) => g.items.length > 0)
          .map((group) => (
            <View key={group.category} style={styles.categoryBlock}>
              <ThemedText type="t6" themeColor="textSecondary" style={styles.categoryLabel}>
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
                    <ThemedText type="t6" style={styles.vendorName} numberOfLines={1}>
                      {item.vendorName}
                    </ThemedText>
                    <ThemedText type="t7" themeColor="textAssistive">
                      {formatDate(item.removedAt)} 제거
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ))}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    scroll: {
      paddingHorizontal: Layout.gutter,
      paddingTop: Spacing.four,
      paddingBottom: Spacing.two,
      maxWidth: MaxContentWidth,
      alignSelf: 'center',
      width: '100%',
    },
    categoryBlock: {
      marginBottom: Layout.sectionGap,
    },
    categoryLabel: {
      fontWeight: '700',
      marginBottom: Spacing.two,
    },
    /* 카드 — component.card «radius 10 · paddingCompact 18px 20px». */
    vendorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: Layout.rowMinHeight,
      borderRadius: Radius.medium,
      borderWidth: 1,
      paddingHorizontal: Layout.cardPadding,
      paddingVertical: Layout.cardPaddingCompactY,
      marginBottom: Spacing.one,
    },
    vendorInfo: {
      flex: 1,
    },
    vendorName: {
      fontWeight: '700',
      marginBottom: Spacing.half,
    },
  });
}
