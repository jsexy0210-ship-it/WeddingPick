/**
 * WP-ADM-040 자동화 상태
 *
 * 시안 `22-admin-ops.dc.html` 7번. 돌고 있어야 할 작업이 실제로 돌았는지 본다.
 * ADMIN.md — **정상이면 전부 회색**이고, 지연이나 실패가 있을 때만 색이 바뀐다.
 *
 * 서버(`/v1/admin/automation`)는 아직 `{ rules: [], enabled }`만 돌려주는 자리라
 * 목록이 비어 오는 것이 정상이다. 그때는 빈 상태를 그린다 — 빈 목록이 실패가 아니다.
 */
import { useEffect, useState } from 'react';

import { PendingBackendNotice } from '@/features/admin/pending-backend';
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

type WorkflowStatus = 'healthy' | 'degraded' | 'down' | 'recovering';
type Workflow = {
  id: string;
  name: string;
  status: WorkflowStatus;
  successRate: number;
  execToday: number;
  retryCount: number;
  dlqSize: number;
  lastRecoveredAt: string | null;
  selfHealEnabled: boolean;
};

type AutomationData = {
  overall?: { healthyCount: number; degradedCount: number; downCount: number };
  workflows?: Workflow[];
};

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  healthy: '정상',
  degraded: '저하',
  down: '중단',
  recovering: '복구 중',
};

/** 정상은 회색으로 둔다 — 전부 초록이면 어느 것이 문제인지 눈에 들어오지 않는다. */
const STATUS_KIND: Record<WorkflowStatus, Kind> = {
  healthy: 'none',
  degraded: 'warn',
  down: 'bad',
  recovering: 'brand',
};

const COLS: Col[] = [
  { key: 'name', label: '작업', width: 250 },
  { key: 'exec', label: '오늘 실행', width: 110, align: 'right' },
  { key: 'success', label: '성공률', width: 100, align: 'right' },
  { key: 'retry', label: '재시도', width: 90, align: 'right' },
  { key: 'dlq', label: '처리 못한 건', width: 120, align: 'right' },
  { key: 'recovered', label: '마지막 자동복구', width: 200, grow: true },
  { key: 'status', label: '결과', width: 100 },
];

export default function AutomationScreen() {
  const [data, setData] = useState<AutomationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/automation')
      .then((d) => {
        if (cancelled) return;
        setData(d as AutomationData);
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

  const workflows = data?.workflows ?? [];
  const degraded = workflows.filter((w) => w.status === 'degraded').length;
  const down = workflows.filter((w) => w.status === 'down').length;
  const healthy = workflows.filter((w) => w.status === 'healthy').length;

  const rows: TableRow[] = workflows.map((w) => ({
    key: w.id,
    cells: [
      { v: w.name, bold: true, kind: 'none' },
      { v: `${w.execToday.toLocaleString()}회` },
      { v: `${(w.successRate * 100).toFixed(1)}%`, kind: w.successRate < 0.9 ? 'bad' : 'none' },
      { v: `${w.retryCount}회`, kind: w.retryCount > 0 ? 'warn' : 'dim' },
      { v: `${w.dlqSize}건`, kind: w.dlqSize > 0 ? 'bad' : 'dim' },
      {
        v: w.lastRecoveredAt
          ? `${w.lastRecoveredAt.slice(0, 10)}${w.selfHealEnabled ? ' · 자동복구 켜짐' : ' · 자동복구 꺼짐'}`
          : w.selfHealEnabled ? '복구한 적 없음 · 자동복구 켜짐' : '복구한 적 없음 · 자동복구 꺼짐',
        kind: 'dim',
      },
      { v: STATUS_LABEL[w.status], badge: STATUS_KIND[w.status] },
    ],
  }));

  const allWell = down === 0 && degraded === 0;

  return (
    <Page
      title="자동화 상태"
      sub="주기 작업 · 마지막 실행과 결과"
      action={{ label: '새로 고침', onPress: reload }}
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <StatusBanner
            tone={down > 0 ? 'bad' : degraded > 0 ? 'warn' : 'ok'}
            title={
              workflows.length === 0
                ? '지켜볼 작업이 아직 없어요'
                : allWell
                  ? `${workflows.length}개 작업이 모두 정상이에요`
                  : down > 0
                    ? `중단된 작업 ${down}개가 있어요`
                    : `저하된 작업 ${degraded}개가 있어요`
            }
            detail={
              workflows.length === 0
                ? '주기 작업이 등록되면 여기에서 마지막 실행과 결과를 볼 수 있어요.'
                : allWell
                  ? '지연이나 실패 없이 돌고 있어요. 개별 작업을 열지 않아도 괜찮아요.'
                  : '아래 표에서 결과가 회색이 아닌 줄만 보면 돼요.'
            }
          />

          <PendingBackendNotice actions="복구 실행 · DLQ 재처리" />

          <KpiRow
            items={[
              { label: '정상', value: `${healthy}개`, note: `전체 ${workflows.length}개`, kind: 'ok' },
              { label: '저하', value: `${degraded}개`, note: degraded === 0 ? '기준 초과 없음' : '확인 필요', kind: degraded === 0 ? 'ok' : 'warn' },
              { label: '중단', value: `${down}개`, note: down === 0 ? '멈춘 것이 없어요' : '조치 필요', kind: down === 0 ? 'ok' : 'bad' },
              {
                label: '처리 못한 건',
                value: `${workflows.reduce((sum, w) => sum + w.dlqSize, 0)}건`,
                note: '재시도까지 실패한 것',
              },
            ]}
          />

          <CardGrid>
            <Card title="주기 작업" sub="실행 주기 · 마지막 결과" full>
              <DataTable
                cols={COLS}
                rows={rows}
                empty="지켜볼 작업이 없어요"
              />
            </Card>
          </CardGrid>
        </>
      ) : null}
    </Page>
  );
}
