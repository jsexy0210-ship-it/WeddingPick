import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
import { FontSize } from '@weddingpick/ui';

import { apiFetch } from './_api';

type AnomalyItem = {
  vendorId: string;
  vendorName: string;
  category: string;
  amount: number;
  mean: number;
  stddev: number;
  detectedAt: string;
};

type PriceStatsResponse = {
  total: number;
  anomalies: AnomalyItem[];
};

function fmt(n: number) {
  return (n / 10000).toFixed(0) + '만원';
}

/**
 * 업종 이름은 domain 한 곳(`VENDOR_CATEGORY_LABEL`)에서만 가져온다. 서버가 아직
 * 모르는 값(DB enum에만 남은 옛 업종 등)이 오면 코드를 그대로 보여 준다 — 관리자
 * 화면이라 감추기보다 드러내는 쪽이 맞다.
 */
function formatCat(category: string) {
  return (VENDOR_CATEGORY_LABEL as Record<string, string>)[category] ?? category;
}

export default function StatsScreen() {
  const [data, setData] = useState<PriceStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/v1/admin/price-stats')
      .then((res) => setData(res as PriceStatsResponse))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>이상치 · 조작 탐지</Text>
        {data && (
          <Text style={styles.subtitle}>이상치 {data.total}건</Text>
        )}
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

      {data && data.anomalies.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.hint}>이상치 없음</Text>
        </View>
      )}

      {data && data.anomalies.length > 0 && (
        <FlatList
          data={data.anomalies}
          keyExtractor={(item, i) => `${item.vendorId}-${i}`}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.vendorName} numberOfLines={1}>{item.vendorName}</Text>
                <View style={styles.catBadge}>
                  <Text style={styles.catText}>{formatCat(item.category)}</Text>
                </View>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.label}>실제 금액</Text>
                <Text style={styles.valueRed}>{fmt(item.amount)}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.label}>기준금액 (평균)</Text>
                <Text style={styles.value}>{fmt(item.mean)}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.label}>표준편차</Text>
                <Text style={styles.value}>{fmt(item.stddev)}</Text>
              </View>
              <Text style={styles.detectedAt}>탐지: {item.detectedAt.slice(0, 10)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f3f6' },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: FontSize.t5, fontWeight: '700', color: '#17181c' },
  subtitle: { fontSize: FontSize.t7, color: '#868b94' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: FontSize.t7, color: '#868b94' },
  errorText: { fontSize: FontSize.t7, color: '#e81607' },
  list: { padding: 16, gap: 12 },
  sep: { height: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e4e5ea',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  vendorName: { flex: 1, fontSize: FontSize.t6, fontWeight: '700', color: '#17181c' },
  catBadge: {
    backgroundColor: '#f0f1f4',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catText: { fontSize: FontSize.badge, color: '#4d5159' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: FontSize.t7, color: '#868b94' },
  value: { fontSize: FontSize.t7, fontWeight: '600', color: '#17181c' },
  valueRed: { fontSize: FontSize.t7, fontWeight: '700', color: '#e81607' },
  detectedAt: { fontSize: FontSize.badge, color: '#adb1ba', marginTop: 4 },
});
