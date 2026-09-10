/**
 * WP-ADM-015 데이터 · 이미지 자동수급
 * 수급 소스 · 권리 상태 · 자동 매칭 결과 · 교체 · 반려
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { OpsAlert, OpsEmpty } from '@/features/admin/ops-kit';
import { BACKEND_PENDING, PendingBackendNotice } from '@/features/admin/pending-backend';

type RightsStatus =
  | 'licensed' | 'public_domain' | 'vendor_provided' | 'vendor_homepage' | 'pending' | 'rejected';
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
  vendor_homepage: '업체 홈페이지',
  pending: '검토 중',
  rejected: '반려',
};
const RIGHTS_COLOR: Record<RightsStatus, string> = {
  licensed: Colors.light.positive,
  public_domain: Colors.light.accent,
  vendor_provided: Colors.light.accent,
  vendor_homepage: Colors.light.accent,
  pending: Colors.light.cautionary,
  rejected: Colors.light.negative,
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
        <Text style={styles.title}>이미지 자동 수급</Text>
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <PendingBackendNotice actions="승인 · 반려" />
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
        <View style={styles.opsBannerWrap}>
          {/* 지금 봐야 할 것이 맨 위. */}
          {data.summary.pending > 0 ? (
            <OpsAlert kind="warn" title={`권리 확인이 ${data.summary.pending}건 밀려 있어요`} sub="확인 전 이미지는 노출되지 않아요." />
          ) : data.summary.rejected > 0 ? (
            <OpsAlert kind="warn" title={`반려된 이미지가 ${data.summary.rejected}건 있어요`} sub="반려 사유를 보고 다시 수급할 수 있어요." />
          ) : (
            <OpsAlert kind="ok" title="확인할 것이 없어요" sub="권리 확인을 기다리는 이미지가 없어요." />
          )}
          {/* 빈 상태가 정상 상태. */}
          {data.items.length === 0 ? (
            <OpsEmpty title="확인할 것이 없어요" sub="수급한 이미지가 없어요." />
          ) : null}
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
              <Text style={[styles.summaryValue, { color: Colors.light.positive }]}>{data.summary.licensed}</Text>
              <Text style={styles.summaryLabel}>허가됨</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryValue, { color: Colors.light.cautionary }]}>{data.summary.pending}</Text>
              <Text style={styles.summaryLabel}>검토 중</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryValue, { color: Colors.light.negative }]}>{data.summary.rejected}</Text>
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
                      style={[styles.approveBtn, (BACKEND_PENDING || acting === item.id) && styles.btnDisabled]}
                      onPress={() => void approve(item.id)}
                      disabled={BACKEND_PENDING || acting !== null}
                    >
                      <Text style={styles.approveBtnText}>{acting === item.id ? '…' : '승인'}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.rejectBtn, (BACKEND_PENDING || acting === item.id + '_reject') && styles.btnDisabled]}
                      onPress={() => void reject(item.id)}
                      disabled={BACKEND_PENDING || acting !== null}
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
  opsBannerWrap: { paddingHorizontal: 24, paddingTop: 16, gap: 12 },
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.light.backgroundSelected },
  refreshText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  body: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.tint },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  summaryCell: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: FontSize.t4, fontWeight: '700', color: Colors.light.text, fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: FontSize.tab, color: Colors.light.textAssistive, marginTop: 2 },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
    alignItems: 'center',
  },
  tableRowZebra: { backgroundColor: Colors.light.backgroundElement },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textAssistive, textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: Colors.light.textStrong },
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
    backgroundColor: Colors.light.positiveBackground,
  },
  approveBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.positive },
  rejectBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: Colors.light.negativeBoxBackground,
  },
  rejectBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.negative },
  btnDisabled: { opacity: 0.5 },
});
