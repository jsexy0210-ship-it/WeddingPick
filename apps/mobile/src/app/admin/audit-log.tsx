/**
 * WP-ADM-052 시스템 · 감사 로그
 * event_id · source · confidence · decision · reason_code · evidence
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

import { Colors, FontSize, LineHeight } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { OpsAlert, OpsEmpty, OpsTable } from '@/features/admin/ops-kit';
import { formatDateTimeDot, formatMonthDayTimeDot } from '@/features/common/format-date';

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

/* 시안 tableWidth 1210 + 코드에만 있는 시각 100 · 주체 48. */
const TABLE_WIDTH = 1268;

const DECISION_LABEL: Record<Decision, string> = {
  approved: '승인',
  rejected: '거부',
  escalated: '에스컬레이션',
  skipped: '스킵',
};
const DECISION_COLOR: Record<Decision, string> = {
  approved: Colors.light.positive,
  rejected: Colors.light.negative,
  escalated: Colors.light.cautionary,
  skipped: Colors.light.textAssistive,
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

  const lowConfidence = data?.items.filter((it) => it.confidence < 0.7) ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>감사 기록</Text>
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
        <>
          <View style={styles.bannerWrap}>
            {lowConfidence.length > 0 ? (
              <OpsAlert
                kind="warn"
                title={`신뢰도가 낮은 결정이 ${lowConfidence.length}건 있어요`}
                sub="70% 아래는 사람이 다시 봐야 해요."
              />
            ) : (
              <OpsAlert kind="ok" title="확인할 것이 없어요" sub="신뢰도가 낮은 결정이 없어요." />
            )}
          </View>

          {data.items.length === 0 ? (
            <View style={styles.bannerWrap}>
              <OpsEmpty title="확인할 것이 없어요" sub="조건에 맞는 기록이 없어요." />
            </View>
          ) : null}

          {/* 표는 카드 안에서만 가로로 돈다 — 8열이라 화면 전폭에 두면 사이드바까지 밀린다. */}
          <View style={styles.tableWrap}>
          <OpsTable minWidth={TABLE_WIDTH}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colTime]}>시각</Text>
            <Text style={[styles.th, styles.colEvent]}>event_id</Text>
            <Text style={[styles.th, styles.colSource]}>source</Text>
            <Text style={[styles.th, styles.colActor]}>주체</Text>
            <Text style={[styles.th, styles.colConfidence]}>confidence</Text>
            <Text style={[styles.th, styles.colDecision]}>decision</Text>
            <Text style={[styles.th, styles.colReason]}>reason_code</Text>
            <Text style={[styles.th, styles.colEvidence]}>evidence</Text>
            <Text style={[styles.th, styles.colTarget]}>rollback_target</Text>
          </View>
          <ScrollView>
            {data.items.map((item, i) => (
              <Pressable
                key={item.eventId}
                style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra]}
                onPress={() => setSelected(item)}
              >
                <Text style={[styles.td, styles.colTime]}>
                  {formatMonthDayTimeDot(item.createdAt)}
                </Text>
                <Text style={[styles.td, styles.colEvent]} numberOfLines={1}>{item.eventId}</Text>
                <Text style={[styles.td, styles.colSource]} numberOfLines={1}>{item.source}</Text>
                <Text style={[styles.td, styles.colActor]}>{ACTOR_LABEL[item.actorType]}</Text>
                <Text style={[styles.td, styles.colConfidence, item.confidence < 0.7 && { color: Colors.light.cautionary }]}>
                  {(item.confidence * 100).toFixed(0)}%
                </Text>
                <Text style={[styles.td, styles.colDecision, { color: DECISION_COLOR[item.decision] }]}>
                  {DECISION_LABEL[item.decision]}
                </Text>
                <Text style={[styles.td, styles.colReason]} numberOfLines={1}>{item.reasonCode}</Text>
                <Text style={[styles.td, styles.colEvidence]} numberOfLines={1}>{item.evidence.join(' · ')}</Text>
                <Text style={[styles.td, styles.colTarget, !item.targetId && styles.tdDim]} numberOfLines={1}>
                  {item.targetId ? `${item.targetType}#${item.targetId}` : '—'}
                </Text>
              </Pressable>
            ))}
            {data.hasMore && (
              <View style={styles.moreRow}>
                <Text style={styles.moreText}>총 {data.total.toLocaleString()}건 · 더 보려면 필터를 좁히세요</Text>
              </View>
            )}
          </ScrollView>
          </OpsTable>
          <Text style={styles.tableNote}>rollback_target이 비어 있으면 되돌릴 수 없는 일괄 작업이에요.</Text>
          </View>
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
                  <Text style={styles.detailValue}>{formatDateTimeDot(selected.createdAt)}</Text>
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
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },
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
  title: { fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text, flexShrink: 0 },
  searchInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: FontSize.t7,
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundElement,
  },
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
    backgroundColor: Colors.light.background,
  },
  tableRowZebra: { backgroundColor: Colors.light.backgroundElement },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textAssistive, textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: Colors.light.textStrong },
  /* 시안 colH 폭 그대로 — event_id 130 · source 130 · confidence 100 · decision 130 · reason_code 180 · evidence 280 · rollback_target 170. */
  colTime: { width: 100, fontSize: FontSize.tab },
  colEvent: { width: 130, paddingRight: 8, fontSize: FontSize.tab },
  colSource: { width: 130, paddingRight: 8 },
  colActor: { width: 48, textAlign: 'center' as const, fontSize: FontSize.tab },
  colConfidence: { width: 100, textAlign: 'right' as const, paddingRight: 8, fontVariant: ['tabular-nums'] as const },
  colDecision: { width: 130, textAlign: 'center' as const, fontWeight: '700', fontSize: FontSize.tab },
  colReason: { width: 180, paddingLeft: 8, fontSize: FontSize.tab, color: Colors.light.textAssistive },
  colEvidence: { width: 280, paddingLeft: 8, fontSize: FontSize.tab, color: Colors.light.textSecondary },
  colTarget: { width: 170, paddingLeft: 8, fontSize: FontSize.tab },
  tdDim: { color: Colors.light.textDisabled },
  bannerWrap: { paddingHorizontal: 24, paddingTop: 16 },
  tableWrap: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 8 },
  /* 시안 note — 표 아래 한 줄. */
  tableNote: { fontSize: FontSize.tab, lineHeight: LineHeight.micro, color: Colors.light.textAssistive },
  moreRow: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundElement,
  },
  moreText: { fontSize: FontSize.tab, color: Colors.light.textAssistive },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { backgroundColor: Colors.light.background, borderRadius: 14, padding: 24, width: 560, maxHeight: '80%' },
  modalTitle: { fontSize: FontSize.t6, fontWeight: '700', color: Colors.light.text, marginBottom: 16 },
  modalScroll: { maxHeight: 400 },
  detailRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.light.backgroundSelected },
  detailLabel: { width: 100, fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textAssistive },
  detailValue: { flex: 1, fontSize: FontSize.t7, color: Colors.light.text },
  evidenceTitle: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.text, marginTop: 16, marginBottom: 8 },
  evidenceItem: { fontSize: FontSize.t7, color: Colors.light.textSecondary, lineHeight: LineHeight.t7, marginBottom: 4 },
  closeBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSelected,
  },
  closeBtnText: { fontSize: FontSize.t7, color: Colors.light.textStrong },
});
