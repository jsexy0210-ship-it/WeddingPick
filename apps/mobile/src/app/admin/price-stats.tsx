/**
 * WP-ADM-012 데이터 · 가격통계
 * 업체별 데이터 수 · 공개 단계 · 이상치 후보 · 재계산 · 통계 버전
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';

type VendorStat = {
  vendorId: string;
  vendorName: string;
  dataCount: number;
  publicStage: 0 | 1 | 2 | 3;
  anomalyCandidates: number;
  statsVersion: string;
  lastRecalcAt: string;
};

type PriceStatsData = {
  summary: { totalVendors: number; stage0: number; stage1: number; stage2: number; stage3plus: number };
  vendors: VendorStat[];
};

const STAGE_LABEL: Record<number, string> = {
  0: '수집 중',
  1: '3~4건',
  2: '5~9건',
  3: '10건+',
};

const STAGE_COLOR: Record<number, string> = {
  0: '#adb1ba',
  1: '#805217',
  2: '#0088cc',
  3: '#1aa174',
};

export default function PriceStatsScreen() {
  const [data, setData] = useState<PriceStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [search, setSearch] = useState('');
  const [recalcId, setRecalcId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/data/price-stats')
      .then((d) => {
        if (cancelled) return;
        setData(d as PriceStatsData);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [rev]);

  async function recalc(vendorId: string) {
    setRecalcId(vendorId);
    try {
      await apiFetch(`/v1/admin/data/price-stats/${vendorId}/recalc`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch {
      // 실패 무시
    } finally {
      setRecalcId(null);
    }
  }

  const filtered = data?.vendors.filter(
    (v) => !search || v.vendorName.includes(search) || v.vendorId.includes(search)
  ) ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>데이터 · 가격통계</Text>
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <DelayedLoader active={loading} size={40} style={styles.centered} />
      {!loading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => setRev((r) => r + 1)}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && data && (
        <View style={styles.body}>
          {/* 요약 */}
          <View style={styles.summaryRow}>
            {([0, 1, 2, 3] as const).map((stage) => (
              <View key={stage} style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: STAGE_COLOR[stage] }]}>
                  {stage === 0 ? data.summary.stage0
                    : stage === 1 ? data.summary.stage1
                    : stage === 2 ? data.summary.stage2
                    : data.summary.stage3plus}
                </Text>
                <Text style={styles.summaryLabel}>{STAGE_LABEL[stage]}</Text>
              </View>
            ))}
          </View>

          {/* 검색 */}
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="업체명 또는 ID 검색"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* 테이블 */}
          <ScrollView>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colName]}>업체명</Text>
              <Text style={[styles.th, styles.colStage]}>단계</Text>
              <Text style={[styles.th, styles.colCount]}>데이터 수</Text>
              <Text style={[styles.th, styles.colAnomaly]}>이상치</Text>
              <Text style={[styles.th, styles.colVersion]}>버전</Text>
              <Text style={[styles.th, styles.colAction]} />
            </View>
            {filtered.length === 0 && (
              <Text style={styles.emptyText}>일치하는 업체 없음</Text>
            )}
            {filtered.map((v, i) => (
              <View key={v.vendorId} style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra]}>
                <Text style={[styles.td, styles.colName]} numberOfLines={1}>{v.vendorName}</Text>
                <View style={[styles.stagePill, { backgroundColor: STAGE_COLOR[v.publicStage] + '22' }]}>
                  <Text style={[styles.stagePillText, { color: STAGE_COLOR[v.publicStage] }]}>
                    {STAGE_LABEL[v.publicStage]}
                  </Text>
                </View>
                <Text style={[styles.td, styles.colCount]}>{v.dataCount}</Text>
                <Text style={[styles.td, styles.colAnomaly, v.anomalyCandidates > 0 && styles.valueDanger]}>
                  {v.anomalyCandidates > 0 ? `${v.anomalyCandidates}건` : '없음'}
                </Text>
                <Text style={[styles.td, styles.colVersion, styles.monoText]}>{v.statsVersion}</Text>
                <View style={[styles.colAction]}>
                  <Pressable
                    style={[styles.inlineBtn, recalcId === v.vendorId && styles.btnDisabled]}
                    onPress={() => void recalc(v.vendorId)}
                    disabled={recalcId !== null}
                  >
                    <Text style={styles.inlineBtnText}>{recalcId === v.vendorId ? '…' : '재계산'}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f3f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: '#17181c' },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f2f3f6',
  },
  refreshText: { fontSize: FontSize.t7, color: '#5a5d6a' },
  body: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: '#e53e3e', marginBottom: 16 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#ff6f61',
  },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 8,
  },
  summaryCell: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: FontSize.t4, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: FontSize.tab, color: '#868b94', marginTop: 2 },
  searchBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
  },
  searchInput: {
    height: 36,
    borderWidth: 1,
    borderColor: '#d1d3d8',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: FontSize.t7,
    backgroundColor: '#f7f8fa',
  },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f1f4',
    alignItems: 'center',
  },
  tableRowZebra: { backgroundColor: '#fafbfc' },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: '#868b94', textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: '#3a3b40' },
  emptyText: { fontSize: FontSize.t7, color: '#868b94', padding: 16 },
  colName: { flex: 2 },
  colStage: { width: 70, alignItems: 'center' },
  colCount: { width: 70, textAlign: 'right' as const },
  colAnomaly: { width: 60, textAlign: 'right' as const },
  colVersion: { width: 80 },
  colAction: { width: 56, alignItems: 'flex-end' },
  stagePill: {
    width: 62,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    alignItems: 'center',
  },
  stagePillText: { fontSize: FontSize.tab, fontWeight: '700' },
  valueDanger: { color: '#e81607' },
  monoText: { color: '#5a5d6a' },
  inlineBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f2f3f6',
    borderWidth: 1,
    borderColor: '#d1d3d8',
  },
  inlineBtnText: { fontSize: FontSize.tab, color: '#5a5d6a' },
  btnDisabled: { opacity: 0.5 },
});
