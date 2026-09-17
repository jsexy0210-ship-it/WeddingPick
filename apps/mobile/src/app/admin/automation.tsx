/**
 * WP-ADM-040 자동화 상태 — 이제 「자동화」 화면의 탭 하나(처리 상태)다.
 *
 * 시안 `22-admin-ops.dc.html` 7번. 돌고 있어야 할 작업이 실제로 돌았는지 본다.
 * ADMIN.md — **정상이면 전부 회색**이고, 지연이나 실패가 있을 때만 색이 바뀐다.
 *
 * 서버(`/v1/admin/automation`)가 `structured.decisions`를 세어 워크플로별 상태를 준다.
 * 등록된 워크플로가 없으면 목록이 비어 오고, 그때는 빈 상태를 그린다 — 빈 목록이 실패가 아니다.
 *
 * **2026-09-15 대표 확정(재확정) — 「자동화」 화면의 탭 다섯 중 하나다**(처리 상태 ·
 * 처리 내역 · 정책 규칙 · 긴급 중지 · 변경 복구). 처음엔 처리 상태·처리 내역만
 * 위아래로 붙였는데, 대표님이 「비슷한 유형끼리 탭으로 묶어도 된다」고 넓히시면서
 * 자동화 계열 다섯을 한 화면 탭으로 다시 묶었다 — 이 파일 맨 아래 `AutomationShell`이
 * 그 껍데기고, 여기 있던 본문은 `AutomationPanel`로 이름만 바꿨다.
 */
import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { DecisionsPanel } from './decisions';
import { PolicyEnginePanel } from './policy-engine';
import { KillSwitchPanel } from './kill-switch';
import { RollbackPanel } from './rollback';
import {
  AdminTabShell,
  Card,
  CardGrid,
  ConfirmCard,
  DataTable,
  KpiRow,
  LoadError,
  Page,
  StatusBanner,
  type AdminTabDef,
  type Col,
  type Kind,
  type TableRow,
} from './_ui';
import { formatCount } from '@weddingpick/domain';

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
  { key: 'recover', label: '복구', width: 90 },
  { key: 'drain', label: '처리 못한 건 비우기', width: 150 },
];

function AutomationPanel() {
  const [data, setData] = useState<AutomationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  /** 단추를 눌러 실패한 것. 목록 조회 오류(`error`)와 자리를 나눈다. */
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** DLQ를 비우기 전에 확인받는 대상. v3.27 «위험한 조작은 한 번 더 확인». */
  const [draining, setDraining] = useState<Workflow | null>(null);

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

  /*
   * 실패를 삼키지 않는다. 눌렀는데 아무 일도 없는 것이 성공처럼 보이는 것이
   * 가장 나쁘다 — 이 화면의 단추가 오래 잠겨 있었던 이유가 그것이다.
   */
  async function act(id: string, path: 'recover' | 'drain-dlq') {
    setBusy(true);
    try {
      await apiFetch(`/v1/admin/automation/${id}/${path}`, { method: 'POST' });
      setActionError(null);
      reload();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : '요청 실패');
    } finally {
      setBusy(false);
      setDraining(null);
    }
  }

  const workflows = data?.workflows ?? [];
  const degraded = workflows.filter((w) => w.status === 'degraded').length;
  const down = workflows.filter((w) => w.status === 'down').length;
  const healthy = workflows.filter((w) => w.status === 'healthy').length;

  const rows: TableRow[] = workflows.map((w) => ({
    key: w.id,
    cells: [
      { v: w.name, bold: true, kind: 'none' },
      { v: `${formatCount(w.execToday)}회` },
      { v: `${(w.successRate * 100).toFixed(1)}%`, kind: w.successRate < 0.9 ? 'bad' : 'none' },
      { v: `${formatCount(w.retryCount)}회`, kind: w.retryCount > 0 ? 'warn' : 'dim' },
      { v: `${formatCount(w.dlqSize)}건`, kind: w.dlqSize > 0 ? 'bad' : 'dim' },
      {
        v: w.lastRecoveredAt
          ? `${w.lastRecoveredAt.slice(0, 10)}${w.selfHealEnabled ? ' · 자동복구 켜짐' : ' · 자동복구 꺼짐'}`
          : w.selfHealEnabled ? '복구한 적 없음 · 자동복구 켜짐' : '복구한 적 없음 · 자동복구 꺼짐',
        kind: 'dim',
      },
      { v: STATUS_LABEL[w.status], badge: STATUS_KIND[w.status] },
      /*
       * 할 수 있는 일만 누를 것으로 만든다. 처리 못한 건이 없으면 되돌릴 것도
       * 비울 것도 없어서 글자만 남긴다.
       */
      w.dlqSize > 0 && !busy
        ? { v: '다시 시도', kind: 'brand', onPress: () => void act(w.id, 'recover') }
        : { v: '—', kind: 'dim' },
      w.dlqSize > 0 && !busy
        ? { v: '확인함으로 표시', kind: 'warn', onPress: () => setDraining(w) }
        : { v: '—', kind: 'dim' },
    ],
  }));

  const allWell = down === 0 && degraded === 0;

  return (
    <Page
      embedded
      title="처리 상태"
      sub={
        workflows.length > 0
          ? `주기 작업 ${formatCount(workflows.length)}개 · 마지막 실행과 결과`
          : '주기 작업 · 마지막 실행과 결과'
      }
      action={{ label: '새로 고침', onPress: reload }}
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <StatusBanner
            tone={actionError ? 'bad' : down > 0 ? 'bad' : degraded > 0 ? 'warn' : 'ok'}
            title={
              actionError
                ? '조치하지 못했어요'
                : workflows.length === 0
                ? '지켜볼 작업이 아직 없어요'
                : allWell
                  ? `${formatCount(workflows.length)}개 작업이 모두 정상이에요`
                  : down > 0
                    ? `중단된 작업 ${down}개가 있어요`
                    : `저하된 작업 ${degraded}개가 있어요`
            }
            detail={
              actionError
                ? actionError
                : workflows.length === 0
                ? '주기 작업이 등록되면 여기에서 마지막 실행과 결과를 볼 수 있어요.'
                : allWell
                  ? '지연이나 실패 없이 돌고 있어요. 개별 작업을 열지 않아도 괜찮아요.'
                  : '아래 표에서 결과가 회색이 아닌 줄만 보면 돼요.'
            }
          />


          <KpiRow
            items={[
              { label: '정상', value: `${formatCount(healthy)}개`, note: `전체 ${formatCount(workflows.length)}개`, kind: 'ok' },
              { label: '저하', value: `${formatCount(degraded)}개`, note: degraded === 0 ? '기준 초과 없음' : '확인 필요', kind: degraded === 0 ? 'ok' : 'warn' },
              { label: '중단', value: `${formatCount(down)}개`, note: down === 0 ? '멈춘 것이 없어요' : '조치 필요', kind: down === 0 ? 'ok' : 'bad' },
              {
                label: '처리 못한 건',
                value: `${formatCount(workflows.reduce((sum, w) => sum + w.dlqSize, 0))}건`,
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

          {/*
            무엇이 바뀌는지 항목으로 보인 뒤 진행한다(v3.27). 「비운다」가 지우는
            것으로 읽히면 안 된다 — 실패 기록은 남고 표시만 붙는다.
          */}
          {draining ? (
            <ConfirmCard
              title="처리 못한 건을 확인함으로 표시할까요?"
              body={`${draining.name}의 실패 ${draining.dlqSize}건을 사람이 보고 넘어간 것으로 적어요.`}
              items={[
                `«처리 못한 건»에서 ${draining.dlqSize}건이 빠져요`,
                '실패 기록 자체는 지워지지 않아요 — 감사 기록에 그대로 남아요',
                '되돌리려면 다시 시도를 눌러 대기 목록에 세워야 해요',
                '누가 언제 표시했는지 감사 기록에 남아요',
              ]}
              cta="확인함으로 표시"
              danger
              onConfirm={() => void act(draining.id, 'drain-dlq')}
              onCancel={() => setDraining(null)}
            />
          ) : null}
        </>
      ) : null}
    </Page>
  );
}

const TABS: AdminTabDef[] = [
  { key: 'automation', label: '처리 상태' },
  { key: 'decisions', label: '처리 내역' },
  { key: 'policy-engine', label: '정책 규칙' },
  { key: 'kill-switch', label: '긴급 중지', danger: true },
  { key: 'rollback', label: '변경 복구', danger: true },
];

/**
 * 「자동화」 — 처리 상태 · 처리 내역 · 정책 규칙 · 긴급 중지 · 변경 복구를 탭 다섯으로
 * 묶는다. **긴급 중지 · 변경 복구는 위험한 조작이라 탭 자체가 다른 색이다**
 * (2026-09-15 대표 지시 — 「옆 탭 누르다 스친다」). 안에서 하는 조작은 그대로
 * 「무엇이 바뀌는지 보여준 뒤 한 번 더 확인」이다(각 패널이 이미 그렇게 돼 있다) —
 * 탭 색은 누르기 전에 «이 탭은 다르다»를 먼저 말해 주는 것이지, 안의 확인 절차를
 * 대신하는 것이 아니다.
 */
export default function AutomationShell() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const initial = TABS.some((t) => t.key === tab) ? (tab as string) : 'automation';
  const [active, setActive] = useState(initial);

  return (
    <AdminTabShell tabs={TABS} active={active} onChange={setActive}>
      {active === 'automation' && <AutomationPanel />}
      {active === 'decisions' && <DecisionsPanel />}
      {active === 'policy-engine' && <PolicyEnginePanel />}
      {active === 'kill-switch' && <KillSwitchPanel />}
      {active === 'rollback' && <RollbackPanel />}
    </AdminTabShell>
  );
}
