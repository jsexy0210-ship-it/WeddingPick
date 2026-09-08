/**
 * WP-ADM-031 성장 · 캠페인 · 보상
 * 미션 · 친구초대 · 홍보인증 · 지원금 · 예산 · 지급 상태 · 어뷰징
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';

type CampaignType = 'mission' | 'referral' | 'promo_cert' | 'grant';
type PayoutStatus = 'pending' | 'paid' | 'failed' | 'blocked';

type CampaignItem = {
  id: string;
  type: CampaignType;
  userId: string;
  description: string;
  amount: string | null;
  payoutStatus: PayoutStatus;
  abuseFlag: boolean;
  createdAt: string;
};

type CampaignData = {
  budget: { total: string; used: string; remaining: string };
  items: CampaignItem[];
};

const TYPE_LABEL: Record<CampaignType, string> = {
  mission: '미션',
  referral: '친구초대',
  promo_cert: '홍보인증',
  grant: '지원금',
};
const PAYOUT_LABEL: Record<PayoutStatus, string> = {
  pending: '대기',
  paid: '지급됨',
  failed: '실패',
  blocked: '차단',
};
const PAYOUT_COLOR: Record<PayoutStatus, string> = {
  pending: '#805217',
  paid: '#1aa174',
  failed: '#e81607',
  blocked: '#e81607',
};

export default function CampaignsScreen() {
  const [data, setData] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/campaigns')
      .then((d) => {
        if (cancelled) return;
        setData(d as CampaignData);
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

  async function block(id: string) {
    setActing(id);
    try {
      await apiFetch(`/v1/admin/campaigns/${id}/block`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setActing(null); }
  }

  async function pay(id: string) {
    setActing(id + '_pay');
    try {
      await apiFetch(`/v1/admin/campaigns/${id}/pay`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setActing(null); }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>성장 · 캠페인 · 보상</Text>
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
          <View style={styles.budgetRow}>
            <View style={styles.budgetCell}>
              <Text style={styles.budgetLabel}>총 예산</Text>
              <Text style={styles.budgetValue}>{data.budget.total}</Text>
            </View>
            <View style={styles.budgetCell}>
              <Text style={styles.budgetLabel}>사용됨</Text>
              <Text style={[styles.budgetValue, { color: '#0088cc' }]}>{data.budget.used}</Text>
            </View>
            <View style={styles.budgetCell}>
              <Text style={styles.budgetLabel}>잔여</Text>
              <Text style={[styles.budgetValue, { color: '#1aa174' }]}>{data.budget.remaining}</Text>
            </View>
          </View>
          <ScrollView>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colType]}>유형</Text>
              <Text style={[styles.th, styles.colDesc]}>내용</Text>
              <Text style={[styles.th, styles.colAmount]}>금액</Text>
              <Text style={[styles.th, styles.colStatus]}>상태</Text>
              <Text style={[styles.th, styles.colAbuse]}>어뷰징</Text>
              <Text style={[styles.th, styles.colAction]} />
            </View>
            {data.items.map((item, i) => (
              <View key={item.id} style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra, item.abuseFlag && styles.tableRowAbuse]}>
                <Text style={[styles.td, styles.colType]}>{TYPE_LABEL[item.type]}</Text>
                <Text style={[styles.td, styles.colDesc]} numberOfLines={1}>{item.description}</Text>
                <Text style={[styles.td, styles.colAmount]}>{item.amount ?? '—'}</Text>
                <Text style={[styles.td, styles.colStatus, { color: PAYOUT_COLOR[item.payoutStatus] }]}>
                  {PAYOUT_LABEL[item.payoutStatus]}
                </Text>
                <Text style={[styles.td, styles.colAbuse, item.abuseFlag && { color: '#e81607', fontWeight: '700' }]}>
                  {item.abuseFlag ? '의심' : '정상'}
                </Text>
                <View style={[styles.colAction, { flexDirection: 'row', gap: 4 }]}>
                  {item.payoutStatus === 'pending' && !item.abuseFlag && (
                    <Pressable
                      style={[styles.payBtn, acting === item.id + '_pay' && styles.btnDisabled]}
                      onPress={() => void pay(item.id)}
                      disabled={acting !== null}
                    >
                      <Text style={styles.payBtnText}>{acting === item.id + '_pay' ? '…' : '지급'}</Text>
                    </Pressable>
                  )}
                  {item.abuseFlag && item.payoutStatus !== 'blocked' && (
                    <Pressable
                      style={[styles.blockBtn, acting === item.id && styles.btnDisabled]}
                      onPress={() => void block(item.id)}
                      disabled={acting !== null}
                    >
                      <Text style={styles.blockBtnText}>{acting === item.id ? '…' : '차단'}</Text>
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
  budgetRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 24,
  },
  budgetCell: {},
  budgetLabel: { fontSize: FontSize.tab, color: '#868b94', marginBottom: 2 },
  budgetValue: { fontSize: FontSize.t5, fontWeight: '700', color: '#17181c', fontVariant: ['tabular-nums'] },
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
  tableRowAbuse: { backgroundColor: '#fff5f5' },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: '#868b94', textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: '#3a3b40' },
  colType: { width: 70 },
  colDesc: { flex: 1 },
  colAmount: { width: 80 },
  colStatus: { width: 60 },
  colAbuse: { width: 50 },
  colAction: { width: 80, alignItems: 'flex-end' },
  payBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#e8faf6',
  },
  payBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: '#1aa174' },
  blockBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#fff0ee',
  },
  blockBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: '#e81607' },
  btnDisabled: { opacity: 0.5 },
});
