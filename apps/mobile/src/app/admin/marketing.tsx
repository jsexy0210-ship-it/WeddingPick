/**
 * WP-ADM-030 마케팅 자동화
 *
 * 시안 `22-admin-ops.dc.html` 5번. 조건이 맞으면 자동으로 나가는 소재와 성과다.
 * 성과가 떨어지면 자동으로 멈추고 사람에게 알린다 — 그래서 실패가 있을 때만 상단이
 * 주황으로 바뀌고, 없으면 초록으로 「볼 것 없음」을 말한다.
 */
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { ContentButton, ContentForm, type ContentField } from '@/features/admin/content-form';

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
  ConfirmCard,
  useAdminAccess,
  type Cell,
  type Col,
  type Kind,
  type TableRow,
} from './_ui';

type ContentStatus = 'queued' | 'simulated' | 'failed';
type MarketingItem = {
  id: string;
  body: string;
  title: string;
  channel: string;
  status: ContentStatus;
  createdAt: string;
  simulatedAt: string | null;
  failReason: string | null;
};

type MarketingData = {
  facts: Record<string, string>;
  sources: { id: string; active: boolean }[];
  summary: { generated: number; simulated: number; failed: number; failRate: number };
  items: MarketingItem[];
};

const STATUS_LABEL: Record<ContentStatus, string> = {
  queued: '대기 중',
  simulated: '모의 완료',
  failed: '실패',
};

const STATUS_KIND: Record<ContentStatus, Kind> = {
  queued: 'none',
  simulated: 'ok',
  failed: 'bad',
};

/** 이 위로 올라가면 사람이 봐야 한다. */
const FAIL_RATE_CEILING = 0.1;

const COLS: Col[] = [
  { key: 'title', label: '소재', width: 240 },
  { key: 'channel', label: '채널', width: 120 },
  { key: 'created', label: '생성', width: 120 },
  { key: 'simulated', label: '모의 실행', width: 120 },
  { key: 'reason', label: '실패 사유', width: 280, grow: true },
  { key: 'status', label: '상태', width: 100 },
  { key: 'action', label: '', width: 100, align: 'right' },
  { key: 'edit', label: '', width: 70 },
  { key: 'delete', label: '', width: 70 },
];

export default function MarketingScreen() {
  const access = useAdminAccess();
  const [editing, setEditing] = useState<MarketingItem | 'new' | 'source' | null>(null);
  const [deleting, setDeleting] = useState<MarketingItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/marketing')
      .then((d) => {
        if (cancelled) return;
        setData(d as MarketingData);
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

  async function retry(id: string) {
    try {
      await apiFetch(`/v1/admin/marketing/${id}/retry`, { method: 'POST' });
      reload();
    } catch (e) { setActionError(e instanceof Error ? e.message : '다시 실행하지 못했어요'); }
  }

  async function simulate(id: string) {
    try {
      await apiFetch(`/v1/admin/marketing/${id}/simulate`, { method: 'POST' });
      reload();
    } catch (e) { setActionError(e instanceof Error ? e.message : '모의 실행하지 못했어요'); }
  }

  /** 실패한 것은 다시 보내고, 대기 중인 것은 모의 실행한다. 끝난 것은 누를 것이 없다. */
  function actionCell(item: MarketingItem): Cell {
    if (item.status === 'failed') return { v: '다시 보내기', kind: 'bad', onPress: () => void retry(item.id) };
    if (item.status === 'queued') return { v: '모의 실행', kind: 'none', onPress: () => void simulate(item.id) };
    return { v: '—', kind: 'dim' };
  }

  const items = data?.items ?? [];
  const failed = data?.summary.failed ?? 0;
  const failRate = data?.summary.failRate ?? 0;

  const rows: TableRow[] = items.map((item) => ({
    key: item.id,
    cells: [
      { v: item.title, bold: true, kind: 'none' },
      { v: item.channel },
      { v: item.createdAt.slice(0, 10), kind: 'dim' },
      { v: item.simulatedAt ? item.simulatedAt.slice(0, 10) : '—', kind: 'dim' },
      { v: item.failReason ?? '—', kind: item.failReason ? 'bad' : 'dim' },
      { v: STATUS_LABEL[item.status], badge: STATUS_KIND[item.status] },
      actionCell(item),
      { v: '수정', onPress: access.canEdit ? () => setEditing(item) : undefined },
      { v: '삭제', permission: 'delete', onPress: access.canDelete ? () => { setActionError(null); setDeleting(item); } : undefined },
    ],
  }));

  return (
    <Page
      title="마케팅 소재 관리"
      sub="소재 등록·수정 · 모의 실행"
      action={{ label: '새로 고침', onPress: reload, permission: 'view' }}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}><ContentButton label="소재 등록" disabled={!access.canEdit} onPress={() => setEditing('new')} /><ContentButton label="출처 등록" disabled={!access.canEdit} onPress={() => setEditing('source')} /></View>
      {actionError ? <Text accessibilityRole="alert">{actionError}</Text> : null}
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <StatusBanner
            tone={failed === 0 ? 'ok' : failRate > FAIL_RATE_CEILING ? 'bad' : 'warn'}
            title={
              failed === 0
                ? '멈춘 소재가 없어요'
                : `실패한 소재 ${failed}건이 있어요`
            }
            detail={
              failed === 0
                ? '소재를 검토하고 모의 실행할 수 있어요.'
                : `실패율이 ${(failRate * 100).toFixed(1)}%예요. 사유를 확인하고 다시 보내면 돼요.`
            }
          />

          <KpiRow
            items={[
              { label: '생성', value: `${data.summary.generated}건`, note: '자동 생성 소재' },
              { label: '모의 완료', value: `${data.summary.simulated}건`, note: '보낼 준비가 된 것', kind: 'ok' },
              { label: '실패', value: `${failed}건`, note: failed === 0 ? '확인할 것이 없어요' : '사유 확인 필요', kind: failed === 0 ? 'ok' : 'bad' },
              {
                label: '실패율',
                value: `${(failRate * 100).toFixed(1)}%`,
                note: `기준 ${(FAIL_RATE_CEILING * 100).toFixed(0)}% 이하`,
                kind: failRate > FAIL_RATE_CEILING ? 'bad' : 'ok',
              },
            ]}
          />

          <CardGrid>
            <Card
              title="자동 소재"
              sub="생성 · 모의 실행 · 실패 사유"
              full
              note="모의 실행 결과를 확인하는 화면이에요. 외부 채널에 실제 게시하지 않아요."
            >
              <DataTable cols={COLS} rows={rows} empty="돌고 있는 소재가 없어요" />
            </Card>
          </CardGrid>
        </>
      ) : null}
      {editing ? <ContentForm title={editing === 'source' ? '출처 등록' : editing === 'new' ? '소재 등록' : '소재 수정'}
        fields={editing === 'source' ? [
          { key: 'id', label: '출처 이름' }, { key: 'factIds', label: '홍보할 내용', options: Object.entries(data?.facts ?? {}).map(([value, label]) => ({ value, label })) }, { key: 'note', label: '출처 설명', multiline: true },
          { key: 'reviewed', label: '원문 확인', options: [{ value: 'false', label: '미확인' }, { value: 'true', label: '원문 확인 완료' }] },
        ] : [
          ...(editing === 'new' ? [
            { key: 'sourceId', label: '출처', options: (data?.sources ?? []).filter((s) => s.active).map((s) => ({ value: s.id, label: s.id })) },
            { key: 'channel', label: '채널', options: [{ value: 'blog', label: '블로그' }, { value: 'instagram', label: '인스타그램' }, { value: 'shortform', label: '짧은 영상' }, { value: 'community', label: '커뮤니티' }] },
            { key: 'format', label: '유형', options: [{ value: 'product', label: '서비스 소개' }, { value: 'feature', label: '기능 소개' }, { value: 'checklist', label: '준비 목록' }, { value: 'data', label: '금액 정보' }] },
          ] : []), { key: 'title', label: '제목' }, { key: 'body', label: '내용', multiline: true },
        ] as ContentField[]}
        initial={editing === 'source' ? { id: '', factIds: '', note: '', reviewed: 'false' } : editing === 'new' ? { sourceId: '', channel: 'blog', format: 'product', title: '', body: '' } : { title: editing.title, body: editing.body }}
        onClose={() => setEditing(null)} onSave={async (values) => {
          await apiFetch(editing === 'source' ? '/v1/admin/marketing/sources' : editing === 'new' ? '/v1/admin/marketing' : `/v1/admin/marketing/${editing.id}`, {
            method: typeof editing === 'string' ? 'POST' : 'PATCH', body: JSON.stringify(editing === 'source' ? { ...values, reviewed: values.reviewed === 'true', factIds: values.factIds?.split(',').map((s) => s.trim()).filter(Boolean) } : values),
          }); reload();
        }} /> : null}
      {deleting ? <ConfirmCard title="소재를 삭제할까요?" body={deleting.title} items={['목록과 모의 실행 대상에서 제외해요. 작업 이력은 보관해요.']} cta={busy ? '삭제 중…' : '삭제'} danger permission="delete"
        onCancel={() => { if (!busy) setDeleting(null); }} onConfirm={() => {
          if (busy) return; setBusy(true);
          void apiFetch(`/v1/admin/marketing/${deleting.id}`, { method: 'DELETE' }).then(() => { setDeleting(null); reload(); })
            .catch((e: unknown) => setActionError(e instanceof Error ? e.message : '삭제하지 못했어요')).finally(() => setBusy(false));
        }} /> : null}
    </Page>
  );
}
