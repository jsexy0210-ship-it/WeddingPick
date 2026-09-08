/**
 * WP-ADM-014 데이터 · 업체 관리
 * 업체 병합·분리 · 상호 변경 · 영업상태 · 재귀속 이력
 */
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';

type VendorStatus = 'active' | 'closed' | 'suspended' | 'merged';
type HistoryItem = { at: string; action: string; note: string };

type Vendor = {
  id: string;
  name: string;
  category: string;
  status: VendorStatus;
  dataCount: number;
  mergedInto: string | null;
  history: HistoryItem[];
};

type VendorListData = { vendors: Vendor[]; total: number };

const STATUS_LABEL: Record<VendorStatus, string> = {
  active: '영업중',
  closed: '폐업',
  suspended: '정지',
  merged: '병합됨',
};
const STATUS_COLOR: Record<VendorStatus, string> = {
  active: '#1aa174',
  closed: '#868b94',
  suspended: '#e81607',
  merged: '#0088cc',
};

export default function VendorsScreen() {
  const [data, setData] = useState<VendorListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [acting, setActing] = useState(false);
  const [nameEdit, setNameEdit] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/vendors')
      .then((d) => {
        if (cancelled) return;
        setData(d as VendorListData);
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

  function selectVendor(v: Vendor) {
    setSelected(v);
    setNameEdit(v.name);
    setMergeTarget(v.mergedInto ?? '');
    setActionError(null);
  }

  async function updateName() {
    if (!selected || !nameEdit.trim()) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/vendors/${selected.id}/name`, {
        method: 'PATCH',
        body: JSON.stringify({ name: nameEdit.trim() }),
      });
      setSelected(null);
      setRev((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  async function updateStatus(status: VendorStatus) {
    if (!selected) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/vendors/${selected.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setSelected(null);
      setRev((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  async function mergeVendor() {
    if (!selected || !mergeTarget.trim()) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/vendors/${selected.id}/merge`, {
        method: 'POST',
        body: JSON.stringify({ targetId: mergeTarget.trim() }),
      });
      setSelected(null);
      setRev((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  const filtered = data?.vendors.filter(
    (v) => !search || v.name.includes(search) || v.id.includes(search)
  ) ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>데이터 · 업체 관리</Text>
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
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="업체명 또는 ID 검색"
              value={search}
              onChangeText={setSearch}
            />
            <Text style={styles.totalText}>총 {data.total.toLocaleString()}개</Text>
          </View>
          <ScrollView>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colName]}>업체명</Text>
              <Text style={[styles.th, styles.colCategory]}>카테고리</Text>
              <Text style={[styles.th, styles.colStatus]}>상태</Text>
              <Text style={[styles.th, styles.colCount]}>데이터</Text>
            </View>
            {filtered.map((v, i) => (
              <Pressable
                key={v.id}
                style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra, selected?.id === v.id && styles.tableRowActive]}
                onPress={() => selectVendor(v)}
              >
                <Text style={[styles.td, styles.colName]} numberOfLines={1}>{v.name}</Text>
                <Text style={[styles.td, styles.colCategory]}>{v.category}</Text>
                <Text style={[styles.td, styles.colStatus, { color: STATUS_COLOR[v.status] }]}>
                  {STATUS_LABEL[v.status]}
                </Text>
                <Text style={[styles.td, styles.colCount]}>{v.dataCount}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 상세 모달 */}
      <Modal visible={selected !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{selected?.name}</Text>
            <Text style={styles.modalSub}>{selected?.id} · {selected?.category}</Text>

            <Text style={styles.fieldLabel}>상호 변경</Text>
            <TextInput
              style={styles.fieldInput}
              value={nameEdit}
              onChangeText={setNameEdit}
            />
            <Pressable
              style={[styles.primaryBtn, acting && styles.btnDisabled]}
              onPress={() => void updateName()}
              disabled={acting}
            >
              <Text style={styles.primaryBtnText}>상호 저장</Text>
            </Pressable>

            <Text style={styles.fieldLabel}>영업 상태 변경</Text>
            <View style={styles.statusRow}>
              {(['active', 'closed', 'suspended'] as VendorStatus[]).map((s) => (
                <Pressable
                  key={s}
                  style={[styles.statusBtn, selected?.status === s && { borderColor: STATUS_COLOR[s] }]}
                  onPress={() => void updateStatus(s)}
                  disabled={acting}
                >
                  <Text style={[styles.statusBtnText, selected?.status === s && { color: STATUS_COLOR[s] }]}>
                    {STATUS_LABEL[s]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>업체 병합 (대상 ID)</Text>
            <TextInput
              style={styles.fieldInput}
              value={mergeTarget}
              onChangeText={setMergeTarget}
              placeholder="병합할 대상 업체 ID"
            />
            <Pressable
              style={[styles.dangerBtn, acting && styles.btnDisabled]}
              onPress={() => void mergeVendor()}
              disabled={acting || !mergeTarget.trim()}
            >
              <Text style={styles.dangerBtnText}>이 업체를 대상으로 병합</Text>
            </Pressable>

            {actionError && <Text style={styles.actionError}>{actionError}</Text>}

            {/* 이력 */}
            {selected && selected.history.length > 0 && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 20 }]}>재귀속 이력</Text>
                {selected.history.map((h, i) => (
                  <View key={i} style={styles.historyRow}>
                    <Text style={styles.historyTime}>{h.at}</Text>
                    <Text style={styles.historyAction}>{h.action}</Text>
                    <Text style={styles.historyNote}>{h.note}</Text>
                  </View>
                ))}
              </>
            )}

            <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
              <Text style={styles.closeBtnText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#d1d3d8',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: FontSize.t7,
    backgroundColor: '#f7f8fa',
  },
  totalText: { fontSize: FontSize.t7, color: '#868b94' },
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
    alignItems: 'center',
  },
  tableRowZebra: { backgroundColor: '#fafbfc' },
  tableRowActive: { backgroundColor: 'rgba(255,111,97,0.08)' },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: '#868b94', textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: '#3a3b40' },
  colName: { flex: 3 },
  colCategory: { flex: 2 },
  colStatus: { width: 60 },
  colCount: { width: 50, textAlign: 'right' as const },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    width: 480,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: FontSize.t5, fontWeight: '700', color: '#17181c', marginBottom: 4 },
  modalSub: { fontSize: FontSize.t7, color: '#868b94', marginBottom: 20 },
  fieldLabel: { fontSize: FontSize.t7, fontWeight: '700', color: '#868b94', marginBottom: 6, marginTop: 14 },
  fieldInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#d1d3d8',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: FontSize.t7,
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: '#ff6f61',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  dangerBtn: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#e81607',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  dangerBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: '#e81607' },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d3d8',
  },
  statusBtnText: { fontSize: FontSize.t7, color: '#5a5d6a' },
  actionError: { fontSize: FontSize.t7, color: '#e53e3e', marginTop: 8 },
  historyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  historyTime: { fontSize: FontSize.tab, color: '#868b94', width: 80 },
  historyAction: { fontSize: FontSize.tab, fontWeight: '700', color: '#3a3b40', width: 80 },
  historyNote: { flex: 1, fontSize: FontSize.tab, color: '#5a5d6a' },
  closeBtn: {
    marginTop: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#f2f3f6',
    alignItems: 'center',
  },
  closeBtnText: { fontSize: FontSize.t7, color: '#3a3b40' },
  btnDisabled: { opacity: 0.5 },
});
