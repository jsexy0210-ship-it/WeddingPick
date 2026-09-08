/**
 * WP-ADM-030 성장 · 마케팅 자동화
 * 소재 · 생성 · 모의 실행 · 채널별 게시 · 성과 · 실패율
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize, Spinner } from '@weddingpick/ui';
import { apiFetch } from './_api';

type ContentStatus = 'queued' | 'simulated' | 'failed';
type MarketingItem = {
  id: string;
  title: string;
  channel: string;
  status: ContentStatus;
  createdAt: string;
  simulatedAt: string | null;
  failReason: string | null;
};

type MarketingData = {
  summary: { generated: number; simulated: number; failed: number; failRate: number };
  items: MarketingItem[];
};

const STATUS_LABEL: Record<ContentStatus, string> = {
  queued: '대기 중',
  simulated: '모의 완료',
  failed: '실패',
};
const STATUS_COLOR: Record<ContentStatus, string> = {
  queued: '#868b94',
  simulated: '#1aa174',
  failed: '#e81607',
};

export default function MarketingScreen() {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/marketing')
      .then((d) => {
        if (cancelled) return;
        setData(d as MarketingData);
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

  async function retry(id: string) {
    setActing(id);
    try {
      await apiFetch(`/v1/admin/marketing/${id}/retry`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setActing(null); }
  }

  async function simulate(id: string) {
    setActing(id);
    try {
      await apiFetch(`/v1/admin/marketing/${id}/simulate`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setActing(null); }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>성장 · 마케팅 자동화</Text>
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      {loading && <View style={styles.centered}><Spinner size={40} /></View>}
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
          <View style={styles.summaryRow}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>{data.summary.generated}</Text>
              <Text style={styles.summaryLabel}>생성</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryValue, { color: '#1aa174' }]}>{data.summary.simulated}</Text>
              <Text style={styles.summaryLabel}>모의 완료</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryValue, { color: '#e81607' }]}>{data.summary.failed}</Text>
              <Text style={styles.summaryLabel}>실패</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryValue, data.summary.failRate > 0.1 && { color: '#e81607' }]}>
                {(data.summary.failRate * 100).toFixed(1)}%
              </Text>
              <Text style={styles.summaryLabel}>실패율</Text>
            </View>
          </View>
          <ScrollView>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colTitle]}>제목</Text>
              <Text style={[styles.th, styles.colChannel]}>채널</Text>
              <Text style={[styles.th, styles.colStatus]}>상태</Text>
              <Text style={[styles.th, styles.colSimulatedAt]}>모의완료</Text>
              <Text style={[styles.th, styles.colAction]} />
            </View>
            {data.items.map((item, i) => (
              <View key={item.id} style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra]}>
                <View style={styles.colTitle}>
                  <Text style={styles.td} numberOfLines={1}>{item.title}</Text>
                  {item.failReason != null && (
                    <Text style={styles.failReason} numberOfLines={1}>{item.failReason}</Text>
                  )}
                </View>
                <Text style={[styles.td, styles.colChannel]}>{item.channel}</Text>
                <Text style={[styles.td, styles.colStatus, { color: STATUS_COLOR[item.status] }]}>
                  {STATUS_LABEL[item.status]}
                </Text>
                <Text style={[styles.td, styles.colSimulatedAt]}>
                  {item.simulatedAt ? item.simulatedAt.slice(0, 10) : '—'}
                </Text>
                <View style={styles.colAction}>
                  {item.status === 'queued' && (
                    <Pressable
                      style={[styles.inlineBtn, styles.inlineBtnPrimary, acting === item.id && styles.btnDisabled]}
                      onPress={() => void simulate(item.id)}
                      disabled={acting !== null}
                    >
                      <Text style={[styles.inlineBtnText, styles.inlineBtnTextPrimary]}>
                        {acting === item.id ? '…' : '모의'}
                      </Text>
                    </Pressable>
                  )}
                  {item.status === 'failed' && (
                    <Pressable
                      style={[styles.inlineBtn, acting === item.id && styles.btnDisabled]}
                      onPress={() => void retry(item.id)}
                      disabled={acting !== null}
                    >
                      <Text style={styles.inlineBtnText}>{acting === item.id ? '…' : '재시도'}</Text>
                    </Pressable>
                  )}
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
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f2f3f6' },
  refreshText: { fontSize: FontSize.t7, color: '#5a5d6a' },
  body: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: '#e53e3e', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: '#ff6f61' },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  summaryCell: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: FontSize.t4, fontWeight: '700', color: '#17181c', fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: FontSize.tab, color: '#868b94', marginTop: 2 },
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f1f4',
    alignItems: 'center',
  },
  tableRowZebra: { backgroundColor: '#fafbfc' },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: '#868b94', textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: '#3a3b40' },
  failReason: { fontSize: FontSize.tab, color: '#e81607', marginTop: 2 },
  colTitle: { flex: 3 },
  colChannel: { width: 72 },
  colStatus: { width: 72 },
  colSimulatedAt: { width: 76, textAlign: 'right' as const, fontSize: FontSize.tab, color: '#868b94' },
  colAction: { width: 60, alignItems: 'flex-end' },
  inlineBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f2f3f6',
    borderWidth: 1,
    borderColor: '#d1d3d8',
  },
  inlineBtnPrimary: {
    backgroundColor: '#0088cc',
    borderColor: '#0088cc',
  },
  inlineBtnText: { fontSize: FontSize.tab, color: '#5a5d6a' },
  inlineBtnTextPrimary: { color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
