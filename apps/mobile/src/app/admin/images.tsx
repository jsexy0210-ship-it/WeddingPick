/**
 * WP-ADM-015 이미지 자동 수급
 *
 * 시안 `22-admin-ops.dc.html` 3번. 권리 확인이 필수 관문이다 —
 * **권리 미확인은 어떤 경로로도 앱에 노출되지 않고, 승인 버튼이 아예 뜨지 않는다**
 * (ADMIN.md WP-ADM-015). 폐기만 할 수 있다.
 */
import { useEffect, useState } from 'react';

import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import {
  Card,
  CardGrid,
  DataTable,
  KpiRow,
  LoadError,
  Page,
  Rows,
  StatusBanner,
  type Cell,
  type Col,
  type Kind,
  type TableRow,
} from './_ui';

type RightsStatus =
  | 'licensed' | 'public_domain' | 'vendor_provided' | 'vendor_homepage' | 'pending' | 'rejected';
type ImageItem = {
  id: string;
  vendorName: string;
  source: string;
  rightsStatus: RightsStatus;
  matchConfidence: number;
  createdAt: string;
  url: string | null;
};

type ImagesData = {
  summary: { total: number; licensed: number; pending: number; rejected: number };
  items: ImageItem[];
};

const RIGHTS_LABEL: Record<RightsStatus, string> = {
  licensed: '확인됨',
  public_domain: '확인됨',
  vendor_provided: '확인됨',
  vendor_homepage: '확인됨',
  pending: '미확인',
  rejected: '폐기됨',
};

const RIGHTS_KIND: Record<RightsStatus, Kind> = {
  licensed: 'ok',
  public_domain: 'ok',
  vendor_provided: 'ok',
  vendor_homepage: 'ok',
  pending: 'bad',
  rejected: 'dim',
};

/** 권리가 확인된 것만 승인할 수 있다. 이 판단이 화면의 전부다. */
function rightsConfirmed(status: RightsStatus) {
  return status === 'licensed'
    || status === 'public_domain'
    || status === 'vendor_provided'
    || status === 'vendor_homepage';
}

/** 매칭 신뢰도가 이 아래면 업체를 사람이 다시 확인한다. */
const MATCH_FLOOR = 0.7;

const COLS: Col[] = [
  { key: 'vendor', label: '업체', width: 190 },
  { key: 'source', label: '출처', width: 260, grow: true },
  { key: 'rights', label: '권리', width: 110 },
  { key: 'match', label: '매칭', width: 90, align: 'right' },
  { key: 'created', label: '수집', width: 120 },
  { key: 'action', label: '', width: 110, align: 'right' },
];

export default function ImagesScreen() {
  const [data, setData] = useState<ImagesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  // 처리 결과 한 줄. 눌렀는데 조용한 것이 이 화면의 원래 문제였다.
  const [actionNote, setActionNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/data/images')
      .then((d) => {
        if (cancelled) return;
        setData(d as ImagesData);
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

  async function decide(id: string, to: 'approve' | 'reject') {
    setActionNote(null);
    try {
      await apiFetch(`/v1/admin/data/images/${id}/${to}`, { method: 'POST' });
      reload();
    } catch (e) {
      /*
       * 목록을 다시 불러오면 실제 상태가 드러나기는 한다. 다만 실패했을 때는
       * 「눌렀는데 아무것도 안 바뀐다」로만 보여서, 서버가 거절한 것인지 내가
       * 잘못 본 것인지 알 수가 없다. 이유를 그대로 적는다.
       */
      setActionNote(e instanceof Error ? e.message : '처리 실패');
    }
  }

  const approve = (id: string) => decide(id, 'approve');
  const reject = (id: string) => decide(id, 'reject');

  /**
   * 마지막 열. 권리가 확인됐으면 승인, 아니면 폐기만 — 미확인에는 승인 버튼을 만들지 않는다.
   * 이미 폐기된 것은 누를 것이 없다.
   */
  function actionCell(item: ImageItem): Cell {
    if (item.rightsStatus === 'rejected') return { v: '—', kind: 'dim' };
    if (rightsConfirmed(item.rightsStatus)) {
      return { v: '승인', kind: 'ok', onPress: () => void approve(item.id) };
    }
    return { v: '폐기', kind: 'bad', onPress: () => void reject(item.id) };
  }

  const items = data?.items ?? [];
  const pending = data?.summary.pending ?? 0;
  const lowMatch = items.filter((i) => i.matchConfidence < MATCH_FLOOR).length;

  const rows: TableRow[] = items.map((item) => ({
    key: item.id,
    cells: [
      { v: item.vendorName, bold: true, kind: 'none' },
      { v: item.source, kind: rightsConfirmed(item.rightsStatus) ? 'dim' : 'bad' },
      { v: RIGHTS_LABEL[item.rightsStatus], badge: RIGHTS_KIND[item.rightsStatus] },
      {
        v: item.matchConfidence.toFixed(2),
        bold: true,
        kind: item.matchConfidence < MATCH_FLOOR ? 'bad' : 'none',
      },
      { v: item.createdAt.slice(0, 10), kind: 'dim' },
      actionCell(item),
    ],
  }));

  return (
    <Page
      title="이미지 자동 수급"
      sub="권리 확인이 필수 관문 · 미확인은 노출되지 않아요"
      action={{ label: '새로 고침', onPress: reload }}
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          {/* 처리가 거절당하면 그 이유부터 맨 위에 — v3.27 「지금 봐야 할 것이 맨 위」. */}
          {actionNote ? (
            <StatusBanner
              tone="bad"
              title="처리하지 못했어요"
              detail={actionNote}
              cta={{ label: '닫기', onPress: () => setActionNote(null) }}
            />
          ) : null}

          <StatusBanner
            tone={pending === 0 ? 'ok' : 'warn'}
            title={
              pending === 0
                ? '노출을 막고 있는 것이 없어요'
                : `권리 미확인 ${pending}건이 노출을 막고 있어요`
            }
            detail={
              pending === 0
                ? '수집된 사진의 권리가 모두 확인됐어요.'
                : '권리 확인 전에는 승인할 수 없어요. 출처를 확인하거나 폐기하면 돼요.'
            }
          />

          <KpiRow
            items={[
              { label: '수집', value: `${data.summary.total}장`, note: '전체' },
              { label: '권리 확인', value: `${data.summary.licensed}장`, note: '노출 가능', kind: 'ok' },
              { label: '권리 미확인', value: `${pending}장`, note: '노출 차단 중', kind: pending === 0 ? 'ok' : 'bad' },
              { label: '매칭 신뢰도 낮음', value: `${lowMatch}장`, note: `${MATCH_FLOOR} 미만`, kind: 'brand' },
            ]}
          />

          <CardGrid>
            <Card
              title="승인 대기"
              sub="권리 확인이 끝난 것만 승인할 수 있어요"
              full
              note="권리 미확인은 승인 버튼이 아예 뜨지 않아요. 출처를 보강하거나 폐기만 할 수 있어요."
            >
              <DataTable cols={COLS} rows={rows} empty="승인을 기다리는 사진이 없어요" />
            </Card>

            <Card title="권리 확인 경로" sub="자동 확인이 되는 출처">
              <Rows
                items={[
                  { key: 'homepage', name: '업체 공식 채널', meta: '홈페이지 · 인스타그램 · 블로그', num: '자동', numKind: 'ok' },
                  { key: 'provided', name: '업체 제공', meta: 'WP-BIZ-005 자료 제공으로 받은 것', num: '자동', numKind: 'ok' },
                  { key: 'public', name: '공공 데이터', meta: '공공누리 1~4유형', num: '자동', numKind: 'ok' },
                  { key: 'crawl', name: '크롤링', meta: '출처를 특정할 수 없는 것', num: '불가', numKind: 'bad' },
                ]}
              />
            </Card>
          </CardGrid>
        </>
      ) : null}
    </Page>
  );
}
