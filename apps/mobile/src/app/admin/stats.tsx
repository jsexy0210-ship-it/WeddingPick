import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
import { Colors, FontSize } from '@weddingpick/ui';

import { apiFetch } from './_api';
import { OpsAlert, OpsEmpty } from '@/features/admin/ops-kit';

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

      {/* 지금 봐야 할 것이 맨 위. */}
      {data && (
        <View style={styles.bannerWrap}>
          {data.anomalies.length > 0 ? (
            <OpsAlert
              kind="warn"
              title={`이상치가 ${data.anomalies.length}건 잡혔어요`}
              sub="집계에 들어가기 전에 사람이 확인해요."
            />
          ) : (
            <OpsAlert kind="ok" title="확인할 것이 없어요" sub="잡힌 이상치가 없어요." />
          )}
        </View>
      )}

      {/* 빈 상태가 정상 상태. */}
      {data && data.anomalies.length === 0 && (
        <View style={styles.bannerWrap}>
          <OpsEmpty title="확인할 것이 없어요" sub="최근 집계에서 이상치가 잡히지 않았어요." />
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
  bannerWrap: { paddingHorizontal: 24, paddingTop: 16 },
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text },
  subtitle: { fontSize: FontSize.t7, color: Colors.light.textAssistive },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: FontSize.t7, color: Colors.light.textAssistive },
  errorText: { fontSize: FontSize.t7, color: Colors.light.negative },
  list: { padding: 16, gap: 12 },
  sep: { height: 8 },
  card: {
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  vendorName: { flex: 1, fontSize: FontSize.t6, fontWeight: '700', color: Colors.light.text },
  catBadge: {
    backgroundColor: Colors.light.backgroundSelected,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catText: { fontSize: FontSize.badge, color: Colors.light.textSecondary },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: FontSize.t7, color: Colors.light.textAssistive },
  value: { fontSize: FontSize.t7, fontWeight: '600', color: Colors.light.text },
  valueRed: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.negative },
  detectedAt: { fontSize: FontSize.badge, color: Colors.light.textDisabled, marginTop: 4 },
});
