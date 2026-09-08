/**
 * WP-ADM-015 데이터 · 이미지 자동수급
 * 수급 소스 · 권리 상태 · 자동 매칭 결과 · 교체 · 반려
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize, Spinner } from '@weddingpick/ui';
import { apiFetch } from './_api';

type RightsStatus = 'licensed' | 'public_domain' | 'vendor_provided' | 'pending' | 'rejected';
type ImageItem = {
  id: string;
  vendorName: string;
  source: string;
  rightsStatus: RightsStatus;
  matchConfidence: number;
  createdAt: string;
  url: string | null;
};

type ImagesData = {
  summary: { total: number; licensed: number; pending: number; rejected: number };
  items: ImageItem[];
};

const RIGHTS_LABEL: Record<RightsStatus, string> = {
  licensed: '허가',
  public_domain: '공개',
  vendor_provided: '업체 제공',
  pending: '검토 중',
  rejected: '반려',
};
const RIGHTS_COLOR: Record<RightsStatus, string> = {
  licensed: '#1aa174',
  public_domain: '#0088cc',
  vendor_provided: '#0088cc',
  pending: '#805217',
  rejected: '#e81607',
};

export default function ImagesScreen() {
  const [data, setData] = useState<ImagesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/data/images')
      .then((d) => {
        if (cancelled) return;
        setData(d as ImagesData);
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

  async function approve(id: string) {
    setActing(id);
    try {
      await apiFetch(`/v1/admin/data/images/${id}/approve`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setActing(null); }
  }

  async function reject(id: string) {
    setActing(id + '_reject');
    try {
      await apiFetch(`/v1/admin/data/images/${id}/reject`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setActing(null); }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>데이터 · 이미지 자동수급</Text>
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
              <Text style={styles.summaryValue}>{data.summary.total}</Text>
              <Text style={styles.summaryLabel}>전체</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryValue, { color: '#1aa174' }]}>{data.summary.licensed}</Text>
              <Text style={styles.summaryLabel}>허가됨</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryValue, { color: '#805217' }]}>{data.summary.pending}</Text>
              <Text style={styles.summaryLabel}>검토 중</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryValue, { color: '#e81607' }]}>{data.summary.rejected}</Text>
              <Text style={styles.summaryLabel}>반려</Text>
            </View>
          </View>
          <ScrollView>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colVendor]}>업체</Text>
              <Text style={[styles.th, styles.colSource]}>소스</Text>
              <Text style={[styles.th, styles.colRights]}>권리</Text>
              <Text style={[styles.th, styles.colConf]}>신뢰도</Text>
              <Text style={[styles.th, styles.colActions]} />
            </View>
            {data.items.map((item, i) => (
              <View key={item.id} style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra]}>
                <Text style={[styles.td, styles.colVendor]} numberOfLines={1}>{item.vendorName}</Text>
                <Text style={[styles.td, styles.colSource]} numberOfLines={1}>{item.source}</Text>
                <View style={styles.colRights}>
                  <Text style={[styles.rightsTag, { color: RIGHTS_COLOR[item.rightsStatus] }]}>
                    {RIGHTS_LABEL[item.rightsStatus]}
                  </Text>
                </View>
                <Text style={[styles.td, styles.colConf]}>{(item.matchConfidence * 100).toFixed(0)}%</Text>
                {item.rightsStatus === 'pending' ? (
                  <View style={[styles.colActions, { flexDirection: 'row', gap: 6 }]}>
                    <Pressable
                      style={[styles.approveBtn, acting === item.id && styles.btnDisabled]}
                      onPress={() => void approve(item.id)}
                      disabled={acting !== null}
                    >
                      <Text style={styles.approveBtnText}>{acting === item.id ? '…' : '승인'}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.rejectBtn, acting === item.id + '_reject' && styles.btnDisabled]}
                      onPress={() => void reject(item.id)}
                      disabled={acting !== null}
                    >
                      <Text style={styles.rejectBtnText}>{acting === item.id + '_reject' ? '…' : '반려'}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.colActions} />
                )}
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
  colVendor: { flex: 2 },
  colSource: { flex: 2 },
  colRights: { width: 70 },
  colConf: { width: 50, textAlign: 'right' as const },
  colActions: { width: 100, alignItems: 'flex-end' },
  rightsTag: { fontSize: FontSize.tab, fontWeight: '700' },
  approveBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#e8faf6',
  },
  approveBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: '#1aa174' },
  rejectBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#fff0ee',
  },
  rejectBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: '#e81607' },
  btnDisabled: { opacity: 0.5 },
});
