/**
 * WP-ADM-033 성장 · 광고 집행 관리
 * 광고주 · 요금제 · 슬롯 · 기간 · 상태 · 노출 · 클릭 · CTR · Pick · 전환율
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { formatMonthDayDot } from '@/features/common/format-date';

type AdStatus = 'active' | 'paused' | 'expired' | 'pending';
type AdItem = {
  id: string;
  vendorName: string;
  plan: 'LIGHT' | 'STANDARD' | 'PREMIUM';
  slot: string;
  startDate: string;
  endDate: string;
  status: AdStatus;
  impressions: number;
  clicks: number;
  ctr: number;
  picks: number;
  conversionRate: number;
  monthlyFee: string;
  promoApplied: boolean;
};

type AdsData = { items: AdItem[]; totalRevenue: string };

const STATUS_LABEL: Record<AdStatus, string> = {
  active: '집행 중',
  paused: '일시정지',
  expired: '만료',
  pending: '대기',
};
const STATUS_COLOR: Record<AdStatus, string> = {
  active: Colors.light.positive,
  paused: Colors.light.cautionary,
  expired: Colors.light.textAssistive,
  pending: Colors.light.accent,
};
const PLAN_COLOR: Record<AdItem['plan'], string> = {
  LIGHT: Colors.light.accent,
  STANDARD: Colors.light.cautionary,
  PREMIUM: Colors.light.negative,
};

export default function AdsScreen() {
  const [data, setData] = useState<AdsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [acting, setActing] = useState<string | null>(null);
  /* 단추를 눌러 실패한 것. 목록 조회 오류와 자리를 나눈다. */
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/ads')
      .then((d) => {
        if (cancelled) return;
        setData(d as AdsData);
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

  async function toggleStatus(id: string, currentStatus: AdStatus) {
    const newStatus: AdStatus = currentStatus === 'active' ? 'paused' : 'active';
    setActing(id);
    try {
      await apiFetch(`/v1/admin/ads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setActionError(null);
      setRev((r) => r + 1);
    } catch (e: unknown) {
      // 삼키지 않는다. 정지가 안 됐는데 된 것처럼 보이면 광고가 계속 나간다.
      setActionError(e instanceof Error ? e.message : '요청 실패');
    } finally { setActing(null); }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>성장 · 광고 집행 관리</Text>
        {data && <Text style={styles.totalRevenue}>총 광고 수익: {data.totalRevenue}</Text>}
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      {actionError && <Text style={styles.actionError}>{actionError}</Text>}

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
        <ScrollView>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colVendor]}>업체</Text>
            <Text style={[styles.th, styles.planTag]}>요금제</Text>
            <Text style={[styles.th, styles.colSlot]}>슬롯</Text>
            <Text style={[styles.th, styles.colPeriod]}>기간</Text>
            <Text style={[styles.th, styles.colStatus]}>상태</Text>
            <Text style={[styles.th, styles.colImp]}>노출</Text>
            <Text style={[styles.th, styles.colCtr]}>CTR</Text>
            <Text style={[styles.th, styles.colConv]}>전환</Text>
            <Text style={[styles.th, styles.colFee]}>요금</Text>
            <Text style={[styles.th, styles.colAction]} />
          </View>
          {data.items.map((item, i) => (
            <View key={item.id} style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra]}>
              <View style={styles.colVendor}>
                <Text style={styles.vendorName} numberOfLines={1}>{item.vendorName}</Text>
                {item.promoApplied && <Text style={styles.promoBadge}>프로모</Text>}
              </View>
              <Text style={[styles.td, styles.planTag, { color: PLAN_COLOR[item.plan] }]}>{item.plan}</Text>
              <Text style={[styles.td, styles.colSlot]}>{item.slot}</Text>
              <Text style={[styles.td, styles.colPeriod]}>
                {formatMonthDayDot(item.startDate)}~
                {formatMonthDayDot(item.endDate)}
              </Text>
              <Text style={[styles.td, styles.colStatus, { color: STATUS_COLOR[item.status] }]}>
                {STATUS_LABEL[item.status]}
              </Text>
              <Text style={[styles.td, styles.colImp]}>{item.impressions.toLocaleString()}</Text>
              <Text style={[styles.td, styles.colCtr]}>{(item.ctr * 100).toFixed(2)}%</Text>
              <Text style={[styles.td, styles.colConv]}>{(item.conversionRate * 100).toFixed(1)}%</Text>
              <Text style={[styles.td, styles.colFee]}>{item.monthlyFee}</Text>
              <View style={styles.colAction}>
                {(item.status === 'active' || item.status === 'paused') && (
                  <Pressable
                    style={[styles.inlineBtn, (acting === item.id) && styles.btnDisabled]}
                    onPress={() => void toggleStatus(item.id, item.status)}
                    disabled={acting !== null}
                  >
                    <Text style={styles.inlineBtnText}>
                      {acting === item.id ? '…' : item.status === 'active' ? '정지' : '재개'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },
  actionError: { color: Colors.light.negative, fontSize: FontSize.t7, paddingHorizontal: 24, paddingTop: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text },
  totalRevenue: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.positive },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.light.backgroundSelected },
  refreshText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.tint },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
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
  vendorName: { fontSize: FontSize.t7, color: Colors.light.text, fontWeight: '700' },
  promoBadge: {
    fontSize: FontSize.tab,
    color: Colors.light.tint,
    backgroundColor: Colors.light.negativeBoxBackground,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  colPlan: { width: 72 },
  planTag: { width: 72, fontWeight: '700', fontSize: FontSize.tab },
  colSlot: { width: 60 },
  colPeriod: { width: 110, fontSize: FontSize.tab },
  colStatus: { width: 60, fontSize: FontSize.tab },
  colImp: { width: 70, textAlign: 'right' as const, fontSize: FontSize.tab },
  colCtr: { width: 50, textAlign: 'right' as const, fontSize: FontSize.tab },
  colConv: { width: 50, textAlign: 'right' as const, fontSize: FontSize.tab },
  colFee: { width: 72, textAlign: 'right' as const, fontSize: FontSize.tab },
  colAction: { width: 50, alignItems: 'flex-end' },
  inlineBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: Colors.light.backgroundSelected,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
  },
  inlineBtnText: { fontSize: FontSize.tab, color: Colors.light.textSecondary },
  btnDisabled: { opacity: 0.5 },
});
