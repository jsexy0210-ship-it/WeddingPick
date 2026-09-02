import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { API_URL } from '@/api/config';
import { loadToken } from '@/api/session';

type VerificationStatus = 'received' | 'in_review' | 'approved' | 'rejected';

type PendingVerification = {
  id: string;
  targetLevel: string;
  status: VerificationStatus;
  receivedAt: string;
  totalAmount: string | null;
  evidenceKinds: string[];
};

const STATUS_LABEL: Record<VerificationStatus, string> = {
  received: '접수',
  in_review: '심사중',
  approved: '승인',
  rejected: '반려',
};

async function apiFetch(path: string, options?: RequestInit): Promise<unknown> {
  const token = await loadToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

export default function QueueScreen() {
  const [items, setItems] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [selected, setSelected] = useState<PendingVerification | null>(null);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch('/v1/admin/verifications')
      .then((data) => {
        if (cancelled) return;
        const raw = data as { requests?: PendingVerification[] } | PendingVerification[];
        setItems(Array.isArray(raw) ? raw : (raw.requests ?? []));
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

  function reload() { setLoading(true); setRev((r) => r + 1); }

  async function act(action: 'approve' | 'reject') {
    if (!selected) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/verifications/${selected.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(action === 'approve' ? { note } : { reason: note }),
      });
      setSelected(null);
      setNote('');
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>확인 필요 큐</Text>
        <Pressable style={styles.refreshBtn} onPress={reload}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.list}>
          {loading && <ActivityIndicator style={styles.centered} color="#ff6f61" />}
          {!loading && error && <Text style={styles.errorText}>{error}</Text>}
          {!loading && !error && (
            <ScrollView>
              <View style={styles.tableHead}>
                <Text style={[styles.th, styles.colId]}>ID</Text>
                <Text style={[styles.th, styles.colLevel]}>신청등급</Text>
                <Text style={[styles.th, styles.colStatus]}>상태</Text>
                <Text style={[styles.th, styles.colAmount]}>금액</Text>
                <Text style={[styles.th, styles.colDate]}>접수일</Text>
              </View>
              {items.length === 0 && (
                <Text style={styles.emptyText}>대기 중인 신청이 없어요.</Text>
              )}
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.tableRow, selected?.id === item.id && styles.tableRowActive]}
                  onPress={() => { setSelected(item); setNote(''); setActionError(null); }}
                >
                  <Text style={[styles.td, styles.colId, styles.monoText]} numberOfLines={1}>
                    {item.id.slice(0, 8)}…
                  </Text>
                  <Text style={[styles.td, styles.colLevel]}>{item.targetLevel}</Text>
                  <Text style={[styles.td, styles.colStatus]}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Text>
                  <Text style={[styles.td, styles.colAmount]} numberOfLines={1}>
                    {item.totalAmount ?? '-'}
                  </Text>
                  <Text style={[styles.td, styles.colDate]}>
                    {new Date(item.receivedAt).toLocaleDateString('ko-KR')}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.detail}>
          {!selected ? (
            <View style={styles.detailEmpty}>
              <Text style={styles.emptyText}>왼쪽에서 항목을 선택하세요</Text>
            </View>
          ) : (
            <ScrollView>
              <Text style={styles.detailSectionTitle}>신청 정보</Text>

              <Text style={styles.detailLabel}>신청 ID</Text>
              <Text style={styles.detailValue}>{selected.id}</Text>

              <Text style={styles.detailLabel}>신청 등급</Text>
              <Text style={styles.detailValue}>{selected.targetLevel}</Text>

              <Text style={styles.detailLabel}>상태</Text>
              <Text style={styles.detailValue}>{STATUS_LABEL[selected.status] ?? selected.status}</Text>

              <Text style={styles.detailLabel}>신고 금액</Text>
              <Text style={styles.detailValue}>{selected.totalAmount ?? '(없음)'}</Text>

              <Text style={styles.detailLabel}>제출 증빙</Text>
              <Text style={styles.detailValue}>
                {selected.evidenceKinds.length > 0 ? selected.evidenceKinds.join(', ') : '(없음)'}
              </Text>

              <Text style={styles.detailLabel}>접수일</Text>
              <Text style={styles.detailValue}>
                {new Date(selected.receivedAt).toLocaleString('ko-KR')}
              </Text>

              <Text style={[styles.detailSectionTitle, { marginTop: 24 }]}>결정</Text>

              <Text style={styles.detailLabel}>메모 / 반려 사유</Text>
              <TextInput
                style={styles.noteInput}
                multiline
                numberOfLines={3}
                placeholder="승인 메모 또는 반려 사유를 입력하세요"
                value={note}
                onChangeText={setNote}
              />

              {actionError && <Text style={styles.actionErrorText}>{actionError}</Text>}

              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.approveBtn, acting && styles.btnDisabled]}
                  onPress={() => void act('approve')}
                  disabled={acting}
                >
                  <Text style={styles.approveBtnText}>승인</Text>
                </Pressable>
                <Pressable
                  style={[styles.rejectBtn, acting && styles.btnDisabled]}
                  onPress={() => void act('reject')}
                  disabled={acting}
                >
                  <Text style={styles.rejectBtnText}>반려</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
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
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#17181c' },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f2f3f6',
  },
  refreshText: { fontSize: 13, color: '#5a5d6a' },
  body: { flex: 1, flexDirection: 'row' },
  list: { flex: 1, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e4e5ea' },
  detail: { width: 428, backgroundColor: '#fff', padding: 24 },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centered: { marginTop: 40 },
  emptyText: { color: '#868b94', fontSize: 14, padding: 24 },
  errorText: { color: '#e53e3e', fontSize: 14, padding: 24 },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f1f4',
  },
  tableRowActive: { backgroundColor: 'rgba(255,111,97,0.08)' },
  th: { fontSize: 11, fontWeight: '700', color: '#868b94', textTransform: 'uppercase' },
  td: { fontSize: 13, color: '#3a3b40' },
  colId: { width: 96 },
  colLevel: { width: 80 },
  colStatus: { width: 72 },
  colAmount: { flex: 1 },
  colDate: { width: 100 },
  monoText: { color: '#5a5d6a' },
  detailSectionTitle: { fontSize: 12, fontWeight: '700', color: '#868b94', marginBottom: 12 },
  detailLabel: { fontSize: 11, fontWeight: '600', color: '#868b94', marginBottom: 3, marginTop: 14 },
  detailValue: { fontSize: 14, color: '#17181c' },
  noteInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#d0d3dc',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: '#17181c',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionErrorText: { color: '#e53e3e', fontSize: 13, marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  approveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#ff6f61',
  },
  approveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  rejectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#f0f1f4',
    borderWidth: 1,
    borderColor: '#d0d3dc',
  },
  rejectBtnText: { fontSize: 14, fontWeight: '600', color: '#3a3b40' },
  btnDisabled: { opacity: 0.5 },
});
