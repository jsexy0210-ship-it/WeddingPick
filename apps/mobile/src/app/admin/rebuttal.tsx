import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FontSize, Spinner } from '@weddingpick/ui';
import { API_URL } from '@/api/config';
import { loadToken } from '@/api/session';
import { formatDateDot, formatDateTimeDot } from '@/features/common/format-date';

type PendingRebuttal = {
  id: string;
  claimedRole: string;
  vendorName: string;
  createdAt: string;
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

export default function RebuttalScreen() {
  const [items, setItems] = useState<PendingRebuttal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [selected, setSelected] = useState<PendingRebuttal | null>(null);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch('/v1/admin/rebuttals')
      .then((data) => {
        if (cancelled) return;
        const raw = data as { rebuttals?: PendingRebuttal[] } | PendingRebuttal[];
        setItems(Array.isArray(raw) ? raw : (raw.rebuttals ?? []));
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

  async function act(action: 'publish' | 'reject') {
    if (!selected) return;
    if (!note.trim()) {
      setActionError('사유(메모)를 입력해주세요.');
      return;
    }
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/rebuttals/${selected.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ note }),
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
        <Text style={styles.title}>후기 · 반론</Text>
        <Pressable style={styles.refreshBtn} onPress={reload}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.list}>
          {loading && <Spinner size={32} style={styles.centered} />}
          {!loading && error && <Text style={styles.errorText}>{error}</Text>}
          {!loading && !error && (
            <ScrollView>
              <View style={styles.tableHead}>
                <Text style={[styles.th, styles.colId]}>ID</Text>
                <Text style={[styles.th, styles.colVendor]}>업체명</Text>
                <Text style={[styles.th, styles.colRole]}>소속</Text>
                <Text style={[styles.th, styles.colDate]}>접수일</Text>
              </View>
              {items.length === 0 && (
                <Text style={styles.emptyText}>확인 대기 반론이 없어요.</Text>
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
                  <Text style={[styles.td, styles.colVendor]} numberOfLines={1}>
                    {item.vendorName}
                  </Text>
                  <Text style={[styles.td, styles.colRole]} numberOfLines={1}>
                    {item.claimedRole}
                  </Text>
                  <Text style={[styles.td, styles.colDate]}>
                    {formatDateDot(item.createdAt)}
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
              <Text style={styles.detailSectionTitle}>반론 정보</Text>

              <Text style={styles.detailLabel}>반론 ID</Text>
              <Text style={styles.detailValue}>{selected.id}</Text>

              <Text style={styles.detailLabel}>업체명</Text>
              <Text style={styles.detailValue}>{selected.vendorName}</Text>

              <Text style={styles.detailLabel}>본인이 밝힌 소속</Text>
              <Text style={styles.detailValue}>{selected.claimedRole}</Text>

              <Text style={styles.detailLabel}>접수일</Text>
              <Text style={styles.detailValue}>
                {formatDateTimeDot(selected.createdAt)}
              </Text>

              <Text style={[styles.detailSectionTitle, { marginTop: 24 }]}>결정</Text>
              <Text style={styles.detailHint}>
                게시 시 소속을 무엇으로 확인했는지, 게시 불가 시 그 사유를 적어주세요.
              </Text>

              <Text style={styles.detailLabel}>메모 / 사유 (필수)</Text>
              <TextInput
                style={styles.noteInput}
                multiline
                numberOfLines={3}
                placeholder="소속 확인 방법 또는 게시 불가 사유"
                value={note}
                onChangeText={setNote}
              />

              {actionError && <Text style={styles.actionErrorText}>{actionError}</Text>}

              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.publishBtn, acting && styles.btnDisabled]}
                  onPress={() => void act('publish')}
                  disabled={acting}
                >
                  <Text style={styles.publishBtnText}>게시</Text>
                </Pressable>
                <Pressable
                  style={[styles.rejectBtn, acting && styles.btnDisabled]}
                  onPress={() => void act('reject')}
                  disabled={acting}
                >
                  <Text style={styles.rejectBtnText}>게시 불가</Text>
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
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: '#17181c' },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f2f3f6',
  },
  refreshText: { fontSize: FontSize.t7, color: '#5a5d6a' },
  body: { flex: 1, flexDirection: 'row' },
  list: { flex: 1, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e4e5ea' },
  detail: { width: 428, backgroundColor: '#fff', padding: 24 },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centered: { marginTop: 40 },
  emptyText: { color: '#868b94', fontSize: FontSize.t7, padding: 24 },
  errorText: { color: '#e53e3e', fontSize: FontSize.t7, padding: 24 },
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
  th: { fontSize: FontSize.tab, fontWeight: '700', color: '#868b94', textTransform: 'uppercase' },
  td: { fontSize: FontSize.t7, color: '#3a3b40' },
  colId: { width: 96 },
  colVendor: { flex: 1 },
  colRole: { width: 120 },
  colDate: { width: 100 },
  monoText: { color: '#5a5d6a' },
  detailSectionTitle: { fontSize: FontSize.badge, fontWeight: '700', color: '#868b94', marginBottom: 12 },
  detailLabel: { fontSize: FontSize.tab, fontWeight: '600', color: '#868b94', marginBottom: 3, marginTop: 14 },
  detailValue: { fontSize: FontSize.t7, color: '#17181c' },
  detailHint: { fontSize: FontSize.badge, color: '#868b94', marginBottom: 8 },
  noteInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#d0d3dc',
    borderRadius: 6,
    padding: 10,
    fontSize: FontSize.t7,
    color: '#17181c',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionErrorText: { color: '#e53e3e', fontSize: FontSize.t7, marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  publishBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#ff6f61',
  },
  publishBtnText: { fontSize: FontSize.t7, fontWeight: '600', color: '#fff' },
  rejectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#f0f1f4',
    borderWidth: 1,
    borderColor: '#d0d3dc',
  },
  rejectBtnText: { fontSize: FontSize.t7, fontWeight: '600', color: '#3a3b40' },
  btnDisabled: { opacity: 0.5 },
});
