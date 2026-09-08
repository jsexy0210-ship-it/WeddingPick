/**
 * WP-ADM-016 데이터 · 이메일 회신 자동매칭
 * 업체 회신 파싱 · 업체 매칭 · 반영 · 실패 재시도
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize, Spinner } from '@weddingpick/ui';
import { apiFetch } from './_api';

type MatchStatus = 'matched' | 'unmatched' | 'applied' | 'failed';
type EmailItem = {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  matchStatus: MatchStatus;
  matchedVendor: string | null;
  parseConfidence: number;
  retryCount: number;
};

type EmailData = {
  summary: { total: number; matched: number; unmatched: number; applied: number; failed: number };
  items: EmailItem[];
};

const STATUS_LABEL: Record<MatchStatus, string> = {
  matched: '매칭됨',
  unmatched: '미매칭',
  applied: '반영됨',
  failed: '실패',
};
const STATUS_COLOR: Record<MatchStatus, string> = {
  matched: '#0088cc',
  unmatched: '#805217',
  applied: '#1aa174',
  failed: '#e81607',
};

export default function EmailMatchingScreen() {
  const [data, setData] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/data/email-matching')
      .then((d) => {
        if (cancelled) return;
        setData(d as EmailData);
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

  async function apply(id: string) {
    setActing(id);
    try {
      await apiFetch(`/v1/admin/data/email-matching/${id}/apply`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setActing(null); }
  }

  async function retry(id: string) {
    setActing(id + '_retry');
    try {
      await apiFetch(`/v1/admin/data/email-matching/${id}/retry`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setActing(null); }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>데이터 · 이메일 회신 자동매칭</Text>
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
            {(['matched', 'unmatched', 'applied', 'failed'] as MatchStatus[]).map((s) => (
              <View key={s} style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: STATUS_COLOR[s] }]}>
                  {data.summary[s]}
                </Text>
                <Text style={styles.summaryLabel}>{STATUS_LABEL[s]}</Text>
              </View>
            ))}
          </View>
          <ScrollView>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colSubject]}>제목</Text>
              <Text style={[styles.th, styles.colFrom]}>발신자</Text>
              <Text style={[styles.th, styles.colVendor]}>업체</Text>
              <Text style={[styles.th, styles.colStatus]}>상태</Text>
              <Text style={[styles.th, styles.colConf]}>신뢰도</Text>
              <Text style={[styles.th, styles.colAction]} />
            </View>
            {data.items.map((item, i) => (
              <View key={item.id} style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra]}>
                <Text style={[styles.td, styles.colSubject]} numberOfLines={1}>{item.subject}</Text>
                <Text style={[styles.td, styles.colFrom]} numberOfLines={1}>{item.from}</Text>
                <Text style={[styles.td, styles.colVendor]} numberOfLines={1}>
                  {item.matchedVendor ?? '—'}
                </Text>
                <Text style={[styles.td, styles.colStatus, { color: STATUS_COLOR[item.matchStatus] }]}>
                  {STATUS_LABEL[item.matchStatus]}
                </Text>
                <Text style={[styles.td, styles.colConf]}>
                  {(item.parseConfidence * 100).toFixed(0)}%
                </Text>
                <View style={styles.colAction}>
                  {item.matchStatus === 'matched' && (
                    <Pressable
                      style={[styles.inlineBtn, acting === item.id && styles.btnDisabled]}
                      onPress={() => void apply(item.id)}
                      disabled={acting !== null}
                    >
                      <Text style={styles.inlineBtnText}>{acting === item.id ? '…' : '반영'}</Text>
                    </Pressable>
                  )}
                  {item.matchStatus === 'failed' && (
                    <Pressable
                      style={[styles.inlineBtn, acting === item.id + '_retry' && styles.btnDisabled]}
                      onPress={() => void retry(item.id)}
                      disabled={acting !== null}
                    >
                      <Text style={styles.inlineBtnText}>
                        {acting === item.id + '_retry' ? '…' : '재시도'}
                      </Text>
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
  summaryValue: { fontSize: FontSize.t4, fontWeight: '700', fontVariant: ['tabular-nums'] },
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
  colSubject: { flex: 2 },
  colFrom: { flex: 2 },
  colVendor: { flex: 2 },
  colStatus: { width: 60 },
  colConf: { width: 50, textAlign: 'right' as const },
  colAction: { width: 60, alignItems: 'flex-end' },
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
