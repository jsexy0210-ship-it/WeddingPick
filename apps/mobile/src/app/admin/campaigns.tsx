/**
 * WP-ADM-031 성장 · 캠페인 · 보상
 * 미션 · 친구초대 · 홍보인증 · 지원금 · 예산 · 지급 상태 · 어뷰징
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { BACKEND_PENDING, PendingBackendNotice } from '@/features/admin/pending-backend';

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

type CampaignBudget = { total: string; used: string; remaining: string };

type CampaignData = {
  budget: CampaignBudget;
  items: CampaignItem[];
};

/**
 * 서버 응답을 화면이 쓰는 모양으로 맞춘다.
 *
 * `GET /v1/admin/campaigns`는 아직 `{ items: [], total: 0 }`을 그대로 돌려주는
 * 자리다(`apps/api/src/routes/admin.ts`). 예산 칸이 없는데 화면이 `data.budget.total`을
 * 바로 읽어서, **이 화면은 열면 그 자리에서 죽었다**(2026-09-09 확인). 서버가 무엇을
 * 주든 화면이 죽지 않게 여기서 한 번 걸러 낸다 — 관리자 화면이 안 열리면 무슨 일이
 * 일어나는지 볼 수단까지 같이 사라진다.
 *
 * 없는 값을 0으로 지어내지 않는다. `아직 없음`으로 그 자리가 비었다는 것을 그대로 보인다.
 */
const BUDGET_UNKNOWN = '아직 없음';

function toCampaignData(raw: unknown): CampaignData {
  const at = (value: unknown, key: string): unknown =>
    value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;

  const text = (value: unknown): string => (typeof value === 'string' ? value : BUDGET_UNKNOWN);
  const budget = at(raw, 'budget');
  const items = at(raw, 'items');

  return {
    budget: {
      total: text(at(budget, 'total')),
      used: text(at(budget, 'used')),
      remaining: text(at(budget, 'remaining')),
    },
    items: Array.isArray(items) ? (items as CampaignItem[]) : [],
  };
}

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
  pending: Colors.light.cautionary,
  paid: Colors.light.positive,
  failed: Colors.light.negative,
  blocked: Colors.light.negative,
};

export default function CampaignsScreen() {
  const [data, setData] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [acting, setActing] = useState<string | null>(null);
  /** 버튼을 눌러 실패한 것. 목록 조회 오류와 자리를 나눈다. */
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/campaigns')
      .then((d) => {
        if (cancelled) return;
        setData(toCampaignData(d));
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

  /*
   * 실패를 삼키지 않는다. 이 두 주소는 서버에 아직 없어 404가 온다 — 예전에는
   * 빈 catch가 그것을 먹어 **눌러도 아무 일이 없는데 성공한 것처럼 보였다.**
   * 무엇이 안 됐는지 관리자가 알아야 다음 판단을 한다.
   */
  async function act(id: string, path: 'block' | 'pay', busyKey: string) {
    setActing(busyKey);
    try {
      await apiFetch(`/v1/admin/campaigns/${id}/${path}`, { method: 'POST' });
      setActionError(null);
      setRev((r) => r + 1);
    } catch (e: unknown) {
      /*
       * 목록 조회 오류(`error`)와 다른 칸에 담는다. 같은 칸을 쓰면 버튼 한 번에
       * 표가 통째로 사라져, 무엇에 실패했는지 보려다 보던 것을 잃는다.
       */
      setActionError(e instanceof Error ? e.message : '요청 실패');
    } finally {
      setActing(null);
    }
  }

  const block = (id: string) => act(id, 'block', id);
  const pay = (id: string) => act(id, 'pay', id + '_pay');

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>성장 · 캠페인 · 보상</Text>
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <PendingBackendNotice actions="지급 · 차단" />
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
          {actionError ? <Text style={styles.actionErrorText}>{actionError}</Text> : null}
          <View style={styles.budgetRow}>
            <View style={styles.budgetCell}>
              <Text style={styles.budgetLabel}>총 예산</Text>
              <Text style={styles.budgetValue}>{data.budget.total}</Text>
            </View>
            <View style={styles.budgetCell}>
              <Text style={styles.budgetLabel}>사용됨</Text>
              <Text style={[styles.budgetValue, { color: Colors.light.accent }]}>{data.budget.used}</Text>
            </View>
            <View style={styles.budgetCell}>
              <Text style={styles.budgetLabel}>잔여</Text>
              <Text style={[styles.budgetValue, { color: Colors.light.positive }]}>{data.budget.remaining}</Text>
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
                <Text style={[styles.td, styles.colAbuse, item.abuseFlag && { color: Colors.light.negative, fontWeight: '700' }]}>
                  {item.abuseFlag ? '의심' : '정상'}
                </Text>
                <View style={[styles.colAction, { flexDirection: 'row', gap: 4 }]}>
                  {item.payoutStatus === 'pending' && !item.abuseFlag && (
                    <Pressable
                      style={[styles.payBtn, (BACKEND_PENDING || acting === item.id + '_pay') && styles.btnDisabled]}
                      onPress={() => void pay(item.id)}
                      disabled={BACKEND_PENDING || acting !== null}
                    >
                      <Text style={styles.payBtnText}>{acting === item.id + '_pay' ? '…' : '지급'}</Text>
                    </Pressable>
                  )}
                  {item.abuseFlag && item.payoutStatus !== 'blocked' && (
                    <Pressable
                      style={[styles.blockBtn, (BACKEND_PENDING || acting === item.id) && styles.btnDisabled]}
                      onPress={() => void block(item.id)}
                      disabled={BACKEND_PENDING || acting !== null}
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
  actionErrorText: { fontSize: FontSize.t7, color: Colors.light.negative, marginBottom: 8 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.tint },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  budgetRow: {
    flexDirection: 'row',
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 24,
  },
  budgetCell: {},
  budgetLabel: { fontSize: FontSize.tab, color: Colors.light.textAssistive, marginBottom: 2 },
  budgetValue: { fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text, fontVariant: ['tabular-nums'] },
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
  tableRowAbuse: { backgroundColor: Colors.light.negativeBoxBackground },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textAssistive, textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: Colors.light.textStrong },
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
    backgroundColor: Colors.light.positiveBackground,
  },
  payBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.positive },
  blockBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: Colors.light.negativeBoxBackground,
  },
  blockBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.negative },
  btnDisabled: { opacity: 0.5 },
});
