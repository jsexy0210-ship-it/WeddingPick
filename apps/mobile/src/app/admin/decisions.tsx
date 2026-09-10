import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { formatDateTimeDot } from '@/features/common/format-date';

import { apiFetch } from './_api';

/**
 * 자동 결정 현황 — 사람이 아니라 규칙이 내린 판단을 훑는다.
 *
 * `admin.html`에 있던 두 화면을 여기 하나로 합쳤다(2026-09-09). 둘을 따로 두면
 * **집계만 보고 개별 건을 안 보게 된다** — 「어제 300건 처리, 실패 12건」을 읽고
 * 그 12건이 무엇인지 안 여는 것이 흔한 실수다. 위아래로 붙여 둔다.
 *
 * 읽기 전용이다. 여기서 결정을 바꾸지 않는다 — 되돌리는 것은 롤백 화면의 일이다.
 */
type BriefingRow = {
  workflow: string;
  decider: string;
  decisions: number;
  failed: number;
  costUsd: number | null;
};

type OpenDecision = {
  id: string;
  workflow: string;
  step: string;
  subjectKind: string;
  subjectId: string | null;
  reasonCode: string;
  executionStatus: string;
  createdAt: string;
};

const money = (usd: number | null): string => (usd === null ? '—' : `$${usd.toFixed(2)}`);

export default function DecisionsScreen() {
  const [briefing, setBriefing] = useState<BriefingRow[]>([]);
  const [open, setOpen] = useState<OpenDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;

    Promise.all([apiFetch('/v1/admin/decisions/briefing'), apiFetch('/v1/admin/decisions/open')])
      .then(([b, o]) => {
        if (cancelled) return;
        setBriefing((b as { rows?: BriefingRow[] }).rows ?? []);
        setOpen((o as { rows?: OpenDecision[] }).rows ?? []);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rev]);

  const totalFailed = briefing.reduce((sum, row) => sum + row.failed, 0);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>자동 결정 현황</Text>
        <Pressable
          style={styles.refreshBtn}
          onPress={() => {
            setLoading(true);
            setRev((r) => r + 1);
          }}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <DelayedLoader active={loading} size={40} style={styles.centered} />
      {!loading && error && <Text style={styles.errorText}>{error}</Text>}

      {!loading && !error && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>흐름별 집계</Text>
              {totalFailed > 0 && <Text style={styles.failBadge}>실패 {totalFailed}건</Text>}
            </View>

            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colWorkflow]}>흐름</Text>
              <Text style={[styles.th, styles.colDecider]}>판단 주체</Text>
              <Text style={[styles.th, styles.colNum]}>건수</Text>
              <Text style={[styles.th, styles.colNum]}>실패</Text>
              <Text style={[styles.th, styles.colCost]}>비용</Text>
            </View>

            {briefing.length === 0 && <Text style={styles.emptyText}>집계가 없어요.</Text>}

            {briefing.map((row) => (
              <View key={`${row.workflow}:${row.decider}`} style={styles.tableRow}>
                <Text style={[styles.td, styles.colWorkflow]} numberOfLines={1}>
                  {row.workflow}
                </Text>
                <Text style={[styles.td, styles.colDecider]} numberOfLines={1}>
                  {row.decider}
                </Text>
                <Text style={[styles.td, styles.colNum, styles.numText]}>{row.decisions}</Text>
                <Text style={[styles.td, styles.colNum, styles.numText, row.failed > 0 && styles.failText]}>
                  {row.failed}
                </Text>
                <Text style={[styles.td, styles.colCost, styles.numText]}>{money(row.costUsd)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>아직 안 끝난 결정</Text>
              {open.length > 0 && <Text style={styles.openBadge}>{open.length}건</Text>}
            </View>
            <Text style={styles.cardHint}>
              규칙이 판단은 했는데 실행이 끝나지 않은 것들입니다. 오래 남아 있으면 막힌 자리예요.
            </Text>

            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colWorkflow]}>흐름</Text>
              <Text style={[styles.th, styles.colStep]}>단계</Text>
              <Text style={[styles.th, styles.colSubject]}>대상</Text>
              <Text style={[styles.th, styles.colReason]}>사유</Text>
              <Text style={[styles.th, styles.colStatus]}>실행</Text>
              <Text style={[styles.th, styles.colDate]}>시작</Text>
            </View>

            {open.length === 0 && <Text style={styles.emptyText}>안 끝난 결정이 없어요.</Text>}

            {open.map((row) => (
              <View key={row.id} style={styles.tableRow}>
                <Text style={[styles.td, styles.colWorkflow]} numberOfLines={1}>
                  {row.workflow}
                </Text>
                <Text style={[styles.td, styles.colStep]} numberOfLines={1}>
                  {row.step}
                </Text>
                <Text style={[styles.td, styles.colSubject]} numberOfLines={1}>
                  {row.subjectKind}
                  {row.subjectId ? ` · ${row.subjectId.slice(0, 8)}…` : ''}
                </Text>
                <Text style={[styles.td, styles.colReason]} numberOfLines={1}>
                  {row.reasonCode}
                </Text>
                <Text style={[styles.td, styles.colStatus]} numberOfLines={1}>
                  {row.executionStatus}
                </Text>
                <Text style={[styles.td, styles.colDate]}>{formatDateTimeDot(row.createdAt)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
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
  centered: { marginTop: 40 },
  content: { padding: 24, gap: 20 },
  card: { backgroundColor: Colors.light.background, borderRadius: 10, padding: 20, borderWidth: 1, borderColor: Colors.light.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: FontSize.t6, fontWeight: '700', color: Colors.light.text },
  cardHint: { fontSize: FontSize.badge, color: Colors.light.textAssistive, marginBottom: 12 },
  failBadge: { fontSize: FontSize.badge, fontWeight: '700', color: Colors.light.negative },
  openBadge: { fontSize: FontSize.badge, fontWeight: '700', color: Colors.light.textAssistive },
  emptyText: { color: Colors.light.textAssistive, fontSize: FontSize.t7, paddingVertical: 16 },
  errorText: { color: Colors.light.negative, fontSize: FontSize.t7, padding: 24 },
  tableHead: {
    flexDirection: 'row',
    paddingVertical: 8,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tableRow: { flexDirection: 'row', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.light.backgroundSelected },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textAssistive, textTransform: 'uppercase' },
  td: { fontSize: FontSize.t7, color: Colors.light.textStrong },
  numText: { fontVariant: ['tabular-nums'], textAlign: 'right' },
  failText: { color: Colors.light.negative, fontWeight: '700' },
  colWorkflow: { flex: 1 },
  colDecider: { width: 140 },
  colStep: { width: 130 },
  colSubject: { width: 170 },
  colReason: { width: 150 },
  colStatus: { width: 96 },
  colNum: { width: 72 },
  colCost: { width: 88 },
  colDate: { width: 132 },
});
