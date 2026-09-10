/**
 * WP-ADM-052 감사 기록
 *
 * 시안 `22-admin-ops.dc.html` 11번. 자동 판단이 무엇을 근거로 어떤 결정을 내렸는지 전부
 * 남긴다. ADMIN.md — **`rollback_target`이 비면 되돌릴 수 없는 일괄 작업이고, 90일 보관**이다.
 */
import { useEffect, useState } from 'react';

import { formatMonthDayTimeDot } from '@/features/common/format-date';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import {
  Card,
  CardGrid,
  DataTable,
  KpiRow,
  LoadError,
  Page,
  type Col,
  type Kind,
  type TableRow,
} from './_ui';

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
  escalated: '상신',
  skipped: '건너뜀',
};

const DECISION_KIND: Record<Decision, Kind> = {
  approved: 'ok',
  rejected: 'bad',
  escalated: 'warn',
  skipped: 'dim',
};

/** ADMIN.md — 90일 보관. */
const RETENTION_DAYS = 90;

/** 시안의 8컬럼. 남는 폭은 `evidence`가 먹는다. */
const COLS: Col[] = [
  { key: 'eventId', label: 'event_id', width: 130 },
  { key: 'source', label: 'source', width: 130 },
  { key: 'confidence', label: 'confidence', width: 100, align: 'right' },
  { key: 'decision', label: 'decision', width: 110 },
  { key: 'reasonCode', label: 'reason_code', width: 180 },
  { key: 'evidence', label: 'evidence', width: 280, grow: true },
  { key: 'createdAt', label: '시각', width: 130 },
  { key: 'rollbackTarget', label: 'rollback_target', width: 170 },
];

/**
 * 되돌릴 대상. 대상이 특정되지 않은 일괄 작업은 여기가 비고, 그때는 되돌릴 수 없다.
 */
function rollbackTarget(e: AuditEvent) {
  if (!e.targetType || !e.targetId) return null;
  return `${e.targetType}#${e.targetId}`;
}

export default function AuditLogScreen() {
  const [data, setData] = useState<AuditLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/audit-log')
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
  }, [rev]);

  const reload = () => setRev((r) => r + 1);

  const items = data?.items ?? [];
  const byAi = items.filter((e) => e.actorType === 'ai').length;
  const byHuman = items.filter((e) => e.actorType === 'human').length;
  const revertable = items.filter((e) => rollbackTarget(e) !== null).length;
  const avgConfidence = items.length === 0
    ? 0
    : items.reduce((sum, e) => sum + e.confidence, 0) / items.length;

  const rows: TableRow[] = items.map((e) => {
    const target = rollbackTarget(e);
    return {
      key: e.eventId,
      cells: [
        { v: e.eventId, mono: true },
        { v: e.source, mono: true },
        {
          v: e.actorType === 'human' ? '—' : e.confidence.toFixed(2),
          bold: e.actorType !== 'human',
          kind: e.actorType === 'human' ? 'dim' : e.confidence < 0.8 ? 'bad' : 'ok',
        },
        { v: DECISION_LABEL[e.decision], badge: DECISION_KIND[e.decision] },
        { v: e.reasonCode, mono: true },
        { v: e.evidence.join(' · ') || '—', kind: e.evidence.length > 0 ? 'none' : 'dim' },
        { v: formatMonthDayTimeDot(e.createdAt), kind: 'dim' },
        target
          ? { v: target, mono: true }
          : { v: '—', kind: 'dim' },
      ],
    };
  });

  return (
    <Page
      title="감사 기록"
      sub={`모든 자동 결정의 근거 · ${RETENTION_DAYS}일 보관`}
      action={{ label: '새로 고침', onPress: reload }}
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <KpiRow
            items={[
              { label: '기록', value: `${data.total.toLocaleString()}건`, note: `자동 ${byAi} · 사람 ${byHuman}` },
              { label: '평균 confidence', value: avgConfidence.toFixed(2), note: '자동 판단 전체' },
              {
                label: '되돌릴 수 있는 건',
                value: `${revertable}건`,
                note: items.length === 0 ? '기록이 없어요' : `이 목록의 ${((revertable / items.length) * 100).toFixed(1)}%`,
              },
              { label: '보관 기한', value: `${RETENTION_DAYS}일`, note: '이후 자동 삭제' },
            ]}
          />

          <CardGrid>
            <Card
              title="기록"
              sub="최근 순"
              full
              note="rollback_target이 비어 있으면 되돌릴 수 없는 일괄 작업이에요."
            >
              <DataTable cols={COLS} rows={rows} empty="남은 기록이 없어요" />
            </Card>
          </CardGrid>
        </>
      ) : null}
    </Page>
  );
}
