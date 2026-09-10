import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, FontSize, LineHeight } from '@weddingpick/ui';

import { apiFetch } from './_api';

type ReportItem = {
  id: string;
  reportType: string;
  reportedAt: string;
  status: 'pending' | 'resolved';
  reporterCount: number;
  summary: string;
};

type ReportsResponse = {
  items: ReportItem[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  resolved: '처리 완료',
};

const TYPE_LABEL: Record<string, string> = {
  review: '후기 신고',
};

export default function ReportScreen() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [filter, setFilter] = useState<'pending' | 'resolved'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load(status: 'pending' | 'resolved') {
    setLoading(true);
    setError(null);
    apiFetch(`/v1/admin/reports?status=${status}`)
      .then((res) => {
        const data = res as ReportsResponse;
        setItems(data.items);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(filter);
  }, [filter]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>VOC · 신고 접수</Text>
      </View>

      {/* 필터 탭 */}
      <View style={styles.tabs}>
        {(['pending', 'resolved'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.tab, filter === s && styles.tabActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.tabText, filter === s && styles.tabTextActive]}>
              {STATUS_LABEL[s]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && (
        <View style={styles.center}>
          <Text style={styles.hint}>불러오는 중...</Text>
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && items.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.hint}>
            {filter === 'pending' ? '대기 중인 신고가 없어요' : '처리 완료된 신고가 없어요'}
          </Text>
        </View>
      )}

      {!loading && items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[
                  styles.typeBadge,
                  { backgroundColor: item.status === 'pending' ? Colors.light.negativeBackground : Colors.light.positiveBackground },
                ]}>
                  <Text style={[
                    styles.typeText,
                    { color: item.status === 'pending' ? Colors.light.negative : Colors.light.positive },
                  ]}>
                    {STATUS_LABEL[item.status]}
                  </Text>
                </View>
                <Text style={styles.typeLabel}>{TYPE_LABEL[item.reportType] ?? item.reportType}</Text>
                <Text style={styles.dateText}>{item.reportedAt.slice(0, 10)}</Text>
              </View>
              <Text style={styles.summary} numberOfLines={2}>{item.summary || '(내용 없음)'}</Text>
              <Text style={styles.reporterCount}>신고자 {item.reporterCount}명</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: { fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingHorizontal: 24,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: 4,
  },
  tabActive: { borderBottomColor: Colors.light.tint },
  tabText: { fontSize: FontSize.t6, color: Colors.light.textAssistive },
  tabTextActive: { color: Colors.light.tint, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: FontSize.t7, color: Colors.light.textAssistive },
  errorText: { fontSize: FontSize.t7, color: Colors.light.negative },
  list: { padding: 16, gap: 10 },
  sep: { height: 6 },
  card: {
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeText: { fontSize: FontSize.badge, fontWeight: '700' },
  typeLabel: { fontSize: FontSize.t7, color: Colors.light.textSecondary, flex: 1 },
  dateText: { fontSize: FontSize.badge, color: Colors.light.textDisabled },
  summary: { fontSize: FontSize.t7, color: Colors.light.textStrong, lineHeight: LineHeight.t7 },
  reporterCount: { fontSize: FontSize.badge, color: Colors.light.textAssistive },
});
