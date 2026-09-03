/**
 * WP-ADM-052 시스템 · 감사 로그
 * event_id · source · confidence · decision · reason_code · evidence
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { FontSize } from '@weddingpick/ui';
import { apiFetch } from './_api';

type Decision = 'approved' | 'rejected' | 'escalated' | 'skipped';
type AuditEvent = {
  eventId: string;
  source: string;
  confidence: number;
  decision: Decision;
  reasonCode: string;
  evidence: string[];
  createdAt: string;
  actorId: string | null;
  actorType: 'ai' | 'human' | 'system';
  targetType: string;
  targetId: string;
};

type AuditLogData = {
  items: AuditEvent[];
  total: number;
  hasMore: boolean;
  cursor: string | null;
};

const DECISION_LABEL: Record<Decision, string> = {
  approved: '승인',
  rejected: '거부',
  escalated: '에스컬레이션',
  skipped: '스킵',
};
const DECISION_COLOR: Record<Decision, string> = {
  approved: '#1aa174',
  rejected: '#e81607',
  escalated: '#805217',
  skipped: '#868b94',
};
const ACTOR_LABEL: Record<AuditEvent['actorType'], string> = {
  ai: 'AI',
  human: '사람',
  system: '시스템',
};

export default function AuditLogScreen() {
  const [data, setData] = useState<AuditLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const qs = search ? `?q=${encodeURIComponent(search)}` : '';
    apiFetch(`/v1/admin/audit-log${qs}`)
      .then((d) => {
        if (cancelled) return;
        setData(d as AuditLogData);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [rev, search]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>감사 로그</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="source · reason_code · target 검색"
          placeholderTextColor="#adb1ba"
          returnKeyType="search"
        />
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      {loading && <View style={styles.centered}><ActivityIndicator color="#ff6f61" size="large" /></View>}
      {!loading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => setRev((r) => r + 1)}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && data && (
        <>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colTime]}>시각</Text>
            <Text style={[styles.th, styles.colSource]}>소스</Text>
            <Text style={[styles.th, styles.colActor]}>주체</Text>
            <Text style={[styles.th, styles.colConfidence]}>신뢰도</Text>
            <Text style={[styles.th, styles.colDecision]}>결정</Text>
            <Text style={[styles.th, styles.colReason]}>사유코드</Text>
          </View>
          <ScrollView>
            {data.items.map((item, i) => (
              <Pressable
                key={item.eventId}
                style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra]}
                onPress={() => setSelected(item)}
              >
                <Text style={[styles.td, styles.colTime]}>
                  {new Date(item.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={[styles.td, styles.colSource]} numberOfLines={1}>{item.source}</Text>
                <Text style={[styles.td, styles.colActor]}>{ACTOR_LABEL[item.actorType]}</Text>
                <Text style={[styles.td, styles.colConfidence, item.confidence < 0.7 && { color: '#805217' }]}>
                  {(item.confidence * 100).toFixed(0)}%
                </Text>
                <Text style={[styles.td, styles.colDecision, { color: DECISION_COLOR[item.decision] }]}>
                  {DECISION_LABEL[item.decision]}
                </Text>
                <Text style={[styles.td, styles.colReason]} numberOfLines={1}>{item.reasonCode}</Text>
              </Pressable>
            ))}
            {data.hasMore && (
              <View style={styles.moreRow}>
                <Text style={styles.moreText}>총 {data.total.toLocaleString()}건 · 더 보려면 필터를 좁히세요</Text>
              </View>
            )}
          </ScrollView>
        </>
      )}

      <Modal visible={selected !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>감사 이벤트 상세</Text>
            {selected && (
              <ScrollView style={styles.modalScroll}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>event_id</Text>
                  <Text style={styles.detailValue}>{selected.eventId}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>source</Text>
                  <Text style={styles.detailValue}>{selected.source}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>target</Text>
                  <Text style={styles.detailValue}>{selected.targetType} / {selected.targetId}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>actor</Text>
                  <Text style={styles.detailValue}>{ACTOR_LABEL[selected.actorType]}{selected.actorId ? ` (${selected.actorId})` : ''}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>confidence</Text>
                  <Text style={styles.detailValue}>{(selected.confidence * 100).toFixed(1)}%</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>decision</Text>
                  <Text style={[styles.detailValue, { color: DECISION_COLOR[selected.decision] }]}>
                    {DECISION_LABEL[selected.decision]}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>reason_code</Text>
                  <Text style={styles.detailValue}>{selected.reasonCode}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>시각</Text>
                  <Text style={styles.detailValue}>{new Date(selected.createdAt).toLocaleString('ko-KR')}</Text>
                </View>
                <Text style={styles.evidenceTitle}>evidence</Text>
                {selected.evidence.map((e, i) => (
                  <Text key={i} style={styles.evidenceItem}>• {e}</Text>
                ))}
              </ScrollView>
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
    gap: 12,
  },
  title: { fontSize: FontSize.t5, fontWeight: '700', color: '#17181c', flexShrink: 0 },
  searchInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#d1d3d8',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: FontSize.t7,
    color: '#17181c',
    backgroundColor: '#f8f9fa',
  },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f2f3f6' },
  refreshText: { fontSize: FontSize.t7, color: '#5a5d6a' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: '#e53e3e', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: '#ff6f61' },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
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
    backgroundColor: '#fff',
  },
  tableRowZebra: { backgroundColor: '#fafbfc' },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: '#868b94', textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: '#3a3b40' },
  colTime: { width: 100, fontSize: FontSize.tab },
  colSource: { flex: 2, paddingRight: 8 },
  colActor: { width: 48, textAlign: 'center' as const, fontSize: FontSize.tab },
  colConfidence: { width: 52, textAlign: 'right' as const, fontVariant: ['tabular-nums'] as const },
  colDecision: { width: 72, textAlign: 'center' as const, fontWeight: '700', fontSize: FontSize.tab },
  colReason: { flex: 1, paddingLeft: 8, fontSize: FontSize.tab, color: '#868b94' },
  moreRow: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  moreText: { fontSize: FontSize.tab, color: '#868b94' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 14, padding: 24, width: 560, maxHeight: '80%' },
  modalTitle: { fontSize: FontSize.t6, fontWeight: '700', color: '#17181c', marginBottom: 16 },
  modalScroll: { maxHeight: 400 },
  detailRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f1f4' },
  detailLabel: { width: 100, fontSize: FontSize.tab, fontWeight: '700', color: '#868b94' },
  detailValue: { flex: 1, fontSize: FontSize.t7, color: '#17181c' },
  evidenceTitle: { fontSize: FontSize.t7, fontWeight: '700', color: '#17181c', marginTop: 16, marginBottom: 8 },
  evidenceItem: { fontSize: FontSize.t7, color: '#5a5d6a', lineHeight: 20, marginBottom: 4 },
  closeBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#f2f3f6',
  },
  closeBtnText: { fontSize: FontSize.t7, color: '#3a3b40' },
});
