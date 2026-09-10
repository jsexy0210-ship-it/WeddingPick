/**
 * WP-ADM-016 이메일 회신 자동 매칭
 *
 * 시안 `22-admin-ops.dc.html` 4번. 업체가 보낸 메일을 어느 문의에 붙였는지와 확신도를
 * 보여준다. **확신도 0.85 미만만 확인 필요로 남긴다**(ADMIN.md WP-ADM-016) — 나머지는
 * 이미 붙었고 사람이 볼 것이 없다.
 *
 * 목록은 읽기 전용이다. 서버에 반영·재시도 엔드포인트가 없어서(`admin.ts`에 GET 하나뿐)
 * 누를 것을 만들지 않는다 — 눌러도 아무 일이 없는 버튼은 상태를 잘못 말한다.
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

type MatchStatus = 'matched' | 'unmatched' | 'applied' | 'failed';
type EmailItem = {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  matchStatus: MatchStatus;
  matchedVendor: string | null;
  parseConfidence: number;
  retryCount: number;
};

type EmailData = {
  summary: { total: number; matched: number; unmatched: number; applied: number; failed: number };
  items: EmailItem[];
};

const STATUS_LABEL: Record<MatchStatus, string> = {
  matched: '자동 연결',
  unmatched: '확인 필요',
  applied: '반영됨',
  failed: '확인 필요',
};

const STATUS_KIND: Record<MatchStatus, Kind> = {
  matched: 'ok',
  unmatched: 'warn',
  applied: 'ok',
  failed: 'bad',
};

/** 이 아래는 자동으로 붙이지 않고 확인 필요로 남긴다(ADMIN.md). */
const CONFIDENCE_FLOOR = 0.85;

const COLS: Col[] = [
  { key: 'from', label: '보낸 사람', width: 220 },
  { key: 'subject', label: '제목', width: 300, grow: true },
  { key: 'vendor', label: '붙인 문의', width: 220 },
  { key: 'received', label: '수신', width: 120 },
  { key: 'confidence', label: '확신도', width: 90, align: 'right' },
  { key: 'status', label: '상태', width: 100 },
];

export default function EmailMatchingScreen() {
  const [data, setData] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/data/email-matching')
      .then((d) => {
        if (cancelled) return;
        setData(d as EmailData);
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
  const needsCheck = items.filter((i) => i.parseConfidence < CONFIDENCE_FLOOR).length;
  const autoMatched = items.length - needsCheck;
  const avgConfidence = items.length === 0
    ? 0
    : items.reduce((sum, i) => sum + i.parseConfidence, 0) / items.length;

  const rows: TableRow[] = items.map((item) => ({
    key: item.id,
    cells: [
      { v: item.from, mono: true },
      { v: item.subject || '(제목 없음)', kind: item.subject ? 'none' : 'dim' },
      {
        v: item.matchedVendor ?? '붙이지 못했어요',
        kind: item.matchedVendor ? 'none' : 'bad',
      },
      { v: item.receivedAt.slice(0, 10), kind: 'dim' },
      {
        v: item.parseConfidence.toFixed(2),
        bold: true,
        kind: item.parseConfidence < CONFIDENCE_FLOOR ? 'bad' : 'ok',
      },
      { v: STATUS_LABEL[item.matchStatus], badge: STATUS_KIND[item.matchStatus] },
    ],
  }));

  return (
    <Page
      title="이메일 회신 자동 매칭"
      sub="업체 회신을 어느 문의에 붙였는지"
      action={{ label: '새로 고침', onPress: reload }}
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <StatusBanner
            tone={needsCheck === 0 ? 'ok' : 'warn'}
            title={
              needsCheck === 0
                ? '확인할 것이 없어요'
                : `확신도 낮음 ${needsCheck}건만 확인하면 돼요`
            }
            detail={
              needsCheck === 0
                ? `받은 회신이 모두 확신도 ${CONFIDENCE_FLOOR} 이상으로 붙었어요.`
                : `나머지 ${autoMatched}건은 자동으로 붙었고 문의 담당자에게 이미 알림이 갔어요.`
            }
          />

          <PendingBackendNotice actions="반영 · 재시도" />

          <KpiRow
            items={[
              { label: '수신', value: `${data.summary.total}통`, note: '업체 회신' },
              { label: '자동 매칭', value: `${autoMatched}통`, note: `확신도 ${CONFIDENCE_FLOOR} 이상`, kind: 'ok' },
              {
                label: '확신도 낮음',
                value: `${needsCheck}통`,
                note: needsCheck === 0 ? '확인할 것이 없어요' : '수동 연결 필요',
                kind: needsCheck === 0 ? 'ok' : 'brand',
              },
              { label: '평균 확신도', value: avgConfidence.toFixed(2), note: '수신 전체' },
            ]}
          />

          <CardGrid>
            <Card
              title="수신 목록"
              sub="최근 순"
              full
              note={`확신도 ${CONFIDENCE_FLOOR} 미만은 자동으로 붙이지 않고 확인 필요로 남겨요.`}
            >
              <DataTable cols={COLS} rows={rows} empty="받은 회신이 없어요" />
            </Card>
          </CardGrid>
        </>
      ) : null}
    </Page>
  );
}
