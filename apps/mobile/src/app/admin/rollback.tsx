/**
 * WP-ADM-042 변경 복구 관리
 *
 * 시안 `22-admin-ops.dc.html` 9번. ADMIN.md — **되돌리기 가능/불가를 구분하고, 전체에
 * 영향을 주는 일괄 작업은 불가이며, 30일 보관**이다. 그 셋이 이 화면의 전부다.
 *
 * 되돌리기 자체는 아직 서버에 없다(`/v1/admin/rollback`은 조회 하나뿐). 그래서 누를 것을
 * 만들지 않는다 — 눌러도 아무 일이 없는 「되돌리기」는 되돌렸다고 착각하게 만든다.
 * 서버가 생기면 `ConfirmCard`로 무엇이 바뀌는지 보여준 뒤 진행한다.
 */
import { useEffect, useState } from 'react';

import { formatDateTimeDot } from '@/features/common/format-date';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import {
  Card,
  CardGrid,
  DataTable,
  KpiRow,
  LoadError,
  Page,
  StatusBanner,
  type Col,
  type Kind,
  type TableRow,
} from './_ui';

type RollbackStatus = 'stable' | 'anomaly_detected' | 'rolling_back' | 'rolled_back' | 'pending_approval';
type RollbackItem = {
  id: string;
  name: string;
  type: 'deploy' | 'policy';
  deployedAt: string;
  deployedBy: string;
  status: RollbackStatus;
  anomalyMetric: string | null;
  anomalyValue: string | null;
  threshold: string | null;
  requiresApproval: boolean;
  autoRollbackEnabled: boolean;
};

/** 서버가 `snapshots`로 돌려주는 자리도 있어 둘 다 받는다. */
type RollbackData = { items?: RollbackItem[]; snapshots?: RollbackItem[] };

const STATUS_LABEL: Record<RollbackStatus, string> = {
  stable: '안정',
  anomaly_detected: '이상 감지',
  rolling_back: '복구 중',
  rolled_back: '복구됨',
  pending_approval: '승인 대기',
};

const STATUS_KIND: Record<RollbackStatus, Kind> = {
  stable: 'none',
  anomaly_detected: 'warn',
  rolling_back: 'brand',
  rolled_back: 'ok',
  pending_approval: 'bad',
};

const TYPE_LABEL: Record<RollbackItem['type'], string> = {
  deploy: '배포',
  policy: '정책',
};

/** ADMIN.md — 30일 뒤 자동 삭제. */
const RETENTION_DAYS = 30;

const COLS: Col[] = [
  { key: 'name', label: '변경', width: 220 },
  { key: 'type', label: '종류', width: 90 },
  { key: 'deployed', label: '적용', width: 160 },
  { key: 'impact', label: '영향 범위', width: 260, grow: true },
  { key: 'revertable', label: '되돌리기', width: 110 },
  { key: 'status', label: '상태', width: 100 },
];

/**
 * 되돌릴 수 있는가. 자동 복구가 걸려 있고 사람 승인을 기다리지 않는 변경만 되돌릴 수 있다 —
 * 전체에 영향을 주는 일괄 작업은 자동 복구를 걸지 않으므로 여기서 「불가」로 걸러진다.
 */
function revertable(item: RollbackItem) {
  return item.autoRollbackEnabled && !item.requiresApproval;
}

export default function RollbackScreen() {
  const [data, setData] = useState<RollbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/rollback')
      .then((d) => {
        if (cancelled) return;
        setData(d as RollbackData);
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

  const items = data?.items ?? data?.snapshots ?? [];
  const canRevert = items.filter(revertable).length;
  const needsPerson = items.filter((i) => i.status === 'pending_approval' || i.status === 'anomaly_detected').length;
  const recovered = items.filter((i) => i.status === 'rolled_back').length;

  const rows: TableRow[] = items.map((item) => ({
    key: item.id,
    cells: [
      { v: item.name, bold: true, kind: 'none' },
      { v: TYPE_LABEL[item.type] },
      { v: formatDateTimeDot(item.deployedAt), kind: 'dim' },
      {
        v: item.anomalyMetric
          ? `${item.anomalyMetric} ${item.anomalyValue ?? '—'} · 기준 ${item.threshold ?? '—'}`
          : `${item.deployedBy} 적용`,
        kind: item.anomalyMetric ? 'bad' : 'dim',
      },
      revertable(item)
        ? { v: '가능', badge: 'ok' }
        : { v: '불가', badge: 'none' },
      { v: STATUS_LABEL[item.status], badge: STATUS_KIND[item.status] },
    ],
  }));

  return (
    <Page title="변경 복구 관리" sub={`되돌릴 수 있는 자동 결정 · ${RETENTION_DAYS}일 보관`}>
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <StatusBanner
            tone={needsPerson === 0 ? 'ok' : 'warn'}
            title={
              needsPerson === 0
                ? '사람이 되돌려야 하는 건은 없어요'
                : `사람이 볼 변경 ${needsPerson}건이 있어요`
            }
            detail={
              needsPerson === 0
                ? '아래는 원하면 되돌릴 수 있는 목록이에요.'
                : '이상이 감지됐거나 승인을 기다리는 변경이에요.'
            }
          />

          <KpiRow
            items={[
              { label: '되돌릴 수 있는 건', value: `${canRevert}건`, note: `최근 ${RETENTION_DAYS}일` },
              { label: '복구됨', value: `${recovered}건`, note: '이미 이전 상태로 돌아갔어요', kind: 'ok' },
              {
                label: '사람 확인',
                value: `${needsPerson}건`,
                note: needsPerson === 0 ? '확인할 것이 없어요' : '이상 감지 · 승인 대기',
                kind: needsPerson === 0 ? 'ok' : 'bad',
              },
              { label: '보관 기한', value: `${RETENTION_DAYS}일`, note: '이후 자동 삭제' },
            ]}
          />

          <CardGrid>
            <Card
              title="자동 결정 이력"
              sub="되돌리면 이전 상태로 돌아가고 감사 기록에 남아요"
              full
              note="전체에 영향을 주는 일괄 작업은 되돌릴 수 없어요. 재실행으로만 고칠 수 있어요."
            >
              <DataTable cols={COLS} rows={rows} empty="되돌릴 것이 없어요" />
            </Card>
          </CardGrid>
        </>
      ) : null}
    </Page>
  );
}
