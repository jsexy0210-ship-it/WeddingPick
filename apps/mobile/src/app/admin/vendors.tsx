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

import { Colors, FontSize, Spacing } from '@weddingpick/ui';
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

/**
 * 병합하면 무엇이 몇 건 옮겨 가는지. 서버가 세어서 준다.
 *
 * 병합은 되돌릴 수 없고 사용자가 쓴 기록(제보 · 후기 · Pick · 이미지)에 닿는다.
 * 그래서 누르기 전에 이 표를 먼저 그린다 — v3.27 관리자 공통 규칙,
 * 「위험한 조작은 무엇이 바뀌는지 항목으로 보여준 뒤 한 번 더 확인」.
 */
type MergeCount = { label: string; moves: number; blocked: number };
type MergePreview = {
  source: { id: string; name: string; category: string };
  target: { id: string; name: string; category: string };
  counts: MergeCount[];
  categoryDiffers: boolean;
};

/** 「제보」·「후기」·「Pick」·「이미지」가 같은 선에서 시작하도록 잡아 두는 폭. */
const MERGE_LABEL_WIDTH = 64;

const STATUS_LABEL: Record<VendorStatus, string> = {
  active: '영업중',
  closed: '폐업',
  suspended: '정지',
  merged: '병합됨',
};
const STATUS_COLOR: Record<VendorStatus, string> = {
  active: Colors.light.positive,
  closed: Colors.light.textAssistive,
  suspended: Colors.light.negative,
  merged: Colors.light.accent,
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
  // 병합 확인 단계. 미리보기를 받아 두기 전에는 병합을 부르지 않는다.
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [mergeReason, setMergeReason] = useState('');

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
    // 대상 ID 칸은 비워서 연다. `mergedInto`는 사람이 읽을 이름이지 ID가 아니고,
    // 이미 병합된 업체는 어차피 다시 합칠 수 없다.
    setMergeTarget('');
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

  /** 1단계 — 무엇이 몇 건 옮겨 가는지 세어 온다. 아직 아무것도 바꾸지 않는다. */
  async function previewMerge() {
    if (!selected || !mergeTarget.trim()) return;
    setActing(true);
    setActionError(null);
    try {
      const p = (await apiFetch(
        `/v1/admin/vendors/${selected.id}/merge-preview?targetId=${encodeURIComponent(mergeTarget.trim())}`
      )) as MergePreview;
      setMergePreview(p);
      setMergeReason('');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  /** 2단계 — 사유를 받아 실제로 합친다. 되돌릴 수 없다. */
  async function confirmMerge() {
    if (!selected || !mergePreview || !mergeReason.trim()) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/vendors/${selected.id}/merge`, {
        method: 'POST',
        body: JSON.stringify({
          targetId: mergePreview.target.id,
          reason: mergeReason.trim(),
        }),
      });
      setMergePreview(null);
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
              style={[styles.primaryBtn, (acting) && styles.btnDisabled]}
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
              style={[styles.dangerBtn, (acting) && styles.btnDisabled]}
              onPress={() => void previewMerge()}
              disabled={acting || !mergeTarget.trim()}
            >
              <Text style={styles.dangerBtnText}>병합할 내용 확인</Text>
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

      {/*
        병합 확인. 되돌릴 수 없는 조작이므로 무엇이 몇 건 옮겨 가는지 항목으로
        보여주고, 사유를 받은 뒤에야 합친다 — v3.27 관리자 공통 규칙.
      */}
      <Modal visible={mergePreview !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>업체를 합칠까요?</Text>
            <Text style={styles.mergeSummary}>
              {mergePreview?.source.name} → {mergePreview?.target.name}
            </Text>
            <Text style={styles.mergeWarn}>합치면 되돌릴 수 없어요.</Text>

            {mergePreview?.categoryDiffers && (
              <Text style={styles.mergeWarn}>
                업종이 서로 달라요 ({mergePreview.source.category} · {mergePreview.target.category}).
              </Text>
            )}

            <Text style={styles.fieldLabel}>옮겨 가는 것</Text>
            {mergePreview?.counts.map((c) => (
              <View key={c.label} style={styles.mergeRow}>
                <Text style={styles.mergeRowLabel}>{c.label}</Text>
                <Text style={styles.mergeRowValue}>{c.moves}건</Text>
                {c.blocked > 0 && (
                  // 겹쳐서 옮기지 못하는 것도 적는다. 감추면 「전부 옮겨 갔다」로 읽힌다.
                  <Text style={styles.mergeRowBlocked}>겹침 {c.blocked}건</Text>
                )}
              </View>
            ))}

            <Text style={styles.fieldLabel}>사유</Text>
            <TextInput
              style={styles.fieldInput}
              value={mergeReason}
              onChangeText={setMergeReason}
              placeholder="왜 합치는지 적어 주세요"
            />

            {actionError && <Text style={styles.actionError}>{actionError}</Text>}

            <Pressable
              style={[styles.dangerBtn, (acting || !mergeReason.trim()) && styles.btnDisabled]}
              onPress={() => void confirmMerge()}
              disabled={acting || !mergeReason.trim()}
            >
              <Text style={styles.dangerBtnText}>합치기</Text>
            </Pressable>

            <Pressable style={styles.closeBtn} onPress={() => setMergePreview(null)}>
              <Text style={styles.closeBtnText}>그만두기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },
  mergeSummary: { fontSize: FontSize.t6, fontWeight: '700', marginTop: Spacing.two },
  mergeWarn: { fontSize: FontSize.t7, color: Colors.light.negative, marginTop: Spacing.one },
  mergeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  mergeRowLabel: {
    fontSize: FontSize.t7,
    color: Colors.light.textAssistive,
    width: MERGE_LABEL_WIDTH,
  },
  mergeRowValue: { fontSize: FontSize.t7, fontWeight: '700' },
  mergeRowBlocked: { fontSize: FontSize.micro, color: Colors.light.cautionary },
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
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.light.backgroundSelected,
  },
  refreshText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  body: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
  },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: FontSize.t7,
    backgroundColor: Colors.light.backgroundElement,
  },
  totalText: { fontSize: FontSize.t7, color: Colors.light.textAssistive },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
    alignItems: 'center',
  },
  tableRowZebra: { backgroundColor: Colors.light.backgroundElement },
  tableRowActive: { backgroundColor: 'rgba(255,111,97,0.08)' },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textAssistive, textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: Colors.light.textStrong },
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
    backgroundColor: Colors.light.background,
    borderRadius: 14,
    padding: 24,
    width: 480,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  modalSub: { fontSize: FontSize.t7, color: Colors.light.textAssistive, marginBottom: 20 },
  fieldLabel: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.textAssistive, marginBottom: 6, marginTop: 14 },
  fieldInput: {
    height: 40,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: FontSize.t7,
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  dangerBtn: {
    backgroundColor: Colors.light.negativeBoxBackground,
    borderWidth: 1,
    borderColor: Colors.light.negative,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  dangerBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.negative },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
  },
  statusBtnText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  actionError: { fontSize: FontSize.t7, color: Colors.light.negative, marginTop: 8 },
  historyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  historyTime: { fontSize: FontSize.tab, color: Colors.light.textAssistive, width: 80 },
  historyAction: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textStrong, width: 80 },
  historyNote: { flex: 1, fontSize: FontSize.tab, color: Colors.light.textSecondary },
  closeBtn: {
    marginTop: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: Colors.light.backgroundSelected,
    alignItems: 'center',
  },
  closeBtnText: { fontSize: FontSize.t7, color: Colors.light.textStrong },
  btnDisabled: { opacity: 0.5 },
});
