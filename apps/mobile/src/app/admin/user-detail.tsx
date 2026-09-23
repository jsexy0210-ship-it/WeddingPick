/**
 * WP-ADM 회원 상세(360뷰). `/admin/user-detail?id=<userId>`.
 *
 * 2026-09-23 대표 지시 「회원에 대한 모든 활동과 모든 정보를 내가 확인할 수 있어야
 * 한다」에서 시작했다. `users.tsx`(앱 회원 목록)의 요약 모달에서 「이 회원의 모든
 * 활동 보기」를 누르면 온다 — 모달은 목록 행에 이미 있는 값만 보여줄 수 있어
 * 웨딩·Pick·후기·결제 제보·업체 소유 확인·문의·리워드는 담을 자리가 없었다.
 *
 * 서버(`member-admin.ts`)가 표 하나로 합쳐 내려준다 — 이 화면은 그것을 구역별
 * 카드로 나눠 그릴 뿐이다. 새 표를 만들지 않았듯 새 판단도 만들지 않는다:
 * 각 구역은 이미 있는 관리자 화면(업체 소유 확인 · 문의 등)과 같은 라벨을 쓴다.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { formatCount, formatWon, INQUIRY_CATEGORY_RULES, VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
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
  type TableRow,
} from './_ui';

type MemberDetail = {
  id: string;
  displayName: string;
  provider: string | null;
  email: string | null;
  nickname: string | null;
  createdAt: string;
  activatedAt: string | null;
  lastLoginAt: string | null;
  deletedAt: string | null;
  isOperator: boolean;
  withdrawal: { status: string; failure: { message: string; attemptCount: number } | null } | null;

  weddings: { id: string; role: 'owner' | 'partner'; weddingDate: string | null; createdAt: string }[];
  candidateCount: number;
  candidates: { id: string; vendorName: string; category: string; addedAt: string; addedByThisMember: boolean }[];
  decisions: { category: string; vendorName: string; decidedAt: string }[];
  reviews: { id: string; vendorName: string; overall: number; status: string; createdAt: string }[];
  paymentProofs: { id: string; merchantName: string; vendorName: string | null; paidAmount: number; paidAt: string }[];
  vendorClaims: { id: string; vendorName: string; status: string; createdAt: string }[];
  consultationCount: number;
  inquiries: { id: string; category: string; status: string; receivedAt: string }[];

  referral: { code: string | null; invitedCount: number; qualifiedCount: number };
  rewardGrants: { id: string; kind: string; amountKrw: number; status: string; createdAt: string }[];
  rewardPayouts: { id: string; amountKrw: number; status: string; requestedAt: string; settledAt: string | null }[];
};

const WEDDING_ROLE_LABEL: Record<'owner' | 'partner', string> = { owner: '내가 만든 웨딩', partner: '배우자가 만든 웨딩' };
/* CLAIM_STATUS_LABEL · REVIEW_STATUS_LABEL과 같은 값을 쓰지만, 운영자가 읽는 자리라 짧게 줄인 말이다. */
const CLAIM_STATUS_LABEL: Record<string, string> = { pending: '확인 대기', approved: '승인', rejected: '반려' };
const REVIEW_STATUS_LABEL: Record<string, string> = { published: '게시 중', under_objection: '이의 확인 중', removed: '내려감' };
const INQUIRY_STATUS_LABEL: Record<string, string> = { received: '접수', in_review: '확인 중', answered: '답변 완료', closed: '종료됨' };
const REWARD_GRANT_STATUS_LABEL: Record<string, string> = { earned: '지급 대기', held: '보류', paid: '지급 완료', blocked: '차단됨' };
const REWARD_PAYOUT_STATUS_LABEL: Record<string, string> = { requested: '요청됨', sent: '보냄', settled: '정산 완료', failed: '실패' };

const WEDDING_COLS: Col[] = [
  { key: 'role', label: '역할', width: 200 },
  { key: 'weddingDate', label: '예식일', width: 140 },
  { key: 'createdAt', label: '만든 날', width: 160, grow: true },
];
const CANDIDATE_COLS: Col[] = [
  { key: 'vendor', label: '업체', width: 220, grow: true },
  { key: 'category', label: '업종', width: 120 },
  { key: 'who', label: '누가 담았나', width: 140 },
  { key: 'addedAt', label: '담은 날', width: 160 },
];
const DECISION_COLS: Col[] = [
  { key: 'category', label: '업종', width: 120 },
  { key: 'vendor', label: '결정한 곳', width: 220, grow: true },
  { key: 'decidedAt', label: '결정한 날', width: 160 },
];
const REVIEW_COLS: Col[] = [
  { key: 'vendor', label: '업체', width: 220, grow: true },
  { key: 'overall', label: '별점', width: 90, align: 'right' },
  { key: 'status', label: '상태', width: 130 },
  { key: 'createdAt', label: '쓴 날', width: 160 },
];
const PROOF_COLS: Col[] = [
  { key: 'merchant', label: '영수증 가맹점명', width: 220, grow: true },
  { key: 'vendor', label: '매칭된 업체', width: 200 },
  { key: 'amount', label: '결제 금액', width: 130, align: 'right' },
  { key: 'paidAt', label: '낸 날짜', width: 160 },
];
const CLAIM_COLS: Col[] = [
  { key: 'vendor', label: '업체', width: 220, grow: true },
  { key: 'status', label: '상태', width: 130 },
  { key: 'createdAt', label: '신청한 날', width: 160 },
];
const INQUIRY_COLS: Col[] = [
  { key: 'category', label: '분류', width: 200, grow: true },
  { key: 'status', label: '상태', width: 130 },
  { key: 'receivedAt', label: '접수일', width: 160 },
];
const GRANT_COLS: Col[] = [
  { key: 'kind', label: '종류', width: 150, grow: true },
  { key: 'amount', label: '금액', width: 130, align: 'right' },
  { key: 'status', label: '상태', width: 130 },
  { key: 'createdAt', label: '생긴 날', width: 160 },
];
const PAYOUT_COLS: Col[] = [
  { key: 'amount', label: '금액', width: 130, align: 'right', grow: true },
  { key: 'status', label: '상태', width: 130 },
  { key: 'requestedAt', label: '요청일', width: 160 },
  { key: 'settledAt', label: '정산일', width: 160 },
];

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch(`/v1/admin/users/${id}`)
      .then((d) => {
        if (cancelled) return;
        setData(d as MemberDetail);
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
  }, [id, rev]);

  const reload = () => setRev((r) => r + 1);

  if (!id) {
    return (
      <Page title="회원 상세">
        <LoadError message="회원 id가 없어요." onRetry={reload} />
      </Page>
    );
  }

  const weddingRows: TableRow[] =
    data?.weddings.map((w) => ({
      key: w.id,
      cells: [
        { v: WEDDING_ROLE_LABEL[w.role] },
        { v: w.weddingDate ?? '(안 정함)', kind: w.weddingDate ? 'none' : 'dim' },
        { v: formatMonthDayTimeDot(w.createdAt), kind: 'dim' },
      ],
    })) ?? [];

  const candidateRows: TableRow[] =
    data?.candidates.map((c) => ({
      key: c.id,
      cells: [
        { v: c.vendorName, bold: true },
        { v: VENDOR_CATEGORY_LABEL[c.category as keyof typeof VENDOR_CATEGORY_LABEL] ?? c.category },
        { v: c.addedByThisMember ? '본인' : '배우자' },
        { v: formatMonthDayTimeDot(c.addedAt), kind: 'dim' },
      ],
    })) ?? [];

  const decisionRows: TableRow[] =
    data?.decisions.map((d, i) => ({
      key: `${d.category}-${i}`,
      cells: [
        { v: VENDOR_CATEGORY_LABEL[d.category as keyof typeof VENDOR_CATEGORY_LABEL] ?? d.category },
        { v: d.vendorName, bold: true },
        { v: formatMonthDayTimeDot(d.decidedAt), kind: 'dim' },
      ],
    })) ?? [];

  const reviewRows: TableRow[] =
    data?.reviews.map((r) => ({
      key: r.id,
      cells: [
        { v: r.vendorName, bold: true },
        { v: `★${r.overall}`, kind: 'brand' },
        {
          v: REVIEW_STATUS_LABEL[r.status] ?? r.status,
          badge: r.status === 'published' ? 'ok' : r.status === 'under_objection' ? 'warn' : 'bad',
        },
        { v: formatMonthDayTimeDot(r.createdAt), kind: 'dim' },
      ],
    })) ?? [];

  const proofRows: TableRow[] =
    data?.paymentProofs.map((p) => ({
      key: p.id,
      cells: [
        { v: p.merchantName },
        { v: p.vendorName ?? '(매칭 안 됨)', kind: p.vendorName ? 'none' : 'dim' },
        { v: formatWon(p.paidAmount), mono: true },
        { v: formatMonthDayTimeDot(p.paidAt), kind: 'dim' },
      ],
    })) ?? [];

  const claimRows: TableRow[] =
    data?.vendorClaims.map((c) => ({
      key: c.id,
      cells: [
        { v: c.vendorName, bold: true },
        {
          v: CLAIM_STATUS_LABEL[c.status] ?? c.status,
          badge: c.status === 'approved' ? 'ok' : c.status === 'rejected' ? 'bad' : 'warn',
        },
        { v: formatMonthDayTimeDot(c.createdAt), kind: 'dim' },
      ],
    })) ?? [];

  const inquiryRows: TableRow[] =
    data?.inquiries.map((q) => ({
      key: q.id,
      cells: [
        { v: INQUIRY_CATEGORY_RULES[q.category as keyof typeof INQUIRY_CATEGORY_RULES]?.label ?? q.category },
        {
          v: INQUIRY_STATUS_LABEL[q.status] ?? q.status,
          badge: q.status === 'answered' || q.status === 'closed' ? 'ok' : 'warn',
        },
        { v: formatMonthDayTimeDot(q.receivedAt), kind: 'dim' },
      ],
    })) ?? [];

  const grantRows: TableRow[] =
    data?.rewardGrants.map((g) => ({
      key: g.id,
      cells: [
        { v: g.kind },
        { v: formatWon(g.amountKrw), mono: true },
        {
          v: REWARD_GRANT_STATUS_LABEL[g.status] ?? g.status,
          badge: g.status === 'paid' ? 'ok' : g.status === 'blocked' ? 'bad' : 'warn',
        },
        { v: formatMonthDayTimeDot(g.createdAt), kind: 'dim' },
      ],
    })) ?? [];

  const payoutRows: TableRow[] =
    data?.rewardPayouts.map((p) => ({
      key: p.id,
      cells: [
        { v: formatWon(p.amountKrw), mono: true },
        {
          v: REWARD_PAYOUT_STATUS_LABEL[p.status] ?? p.status,
          badge: p.status === 'settled' ? 'ok' : p.status === 'failed' ? 'bad' : 'warn',
        },
        { v: formatMonthDayTimeDot(p.requestedAt), kind: 'dim' },
        { v: p.settledAt ? formatMonthDayTimeDot(p.settledAt) : '—', kind: 'dim' },
      ],
    })) ?? [];

  return (
    <Page
      title={data ? data.displayName || '(이름 없음)' : '회원 상세'}
      sub={data ? [data.email, data.nickname].filter(Boolean).join(' · ') || data.id : undefined}
      action={{ label: '새로 고침', onPress: reload }}
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <KpiRow
            items={[
              { label: '웨딩', value: `${formatCount(data.weddings.length)}건` },
              { label: 'Pick 후보', value: `${formatCount(data.candidateCount)}곳`, note: `결정 ${data.decisions.length}건` },
              { label: '쓴 후기', value: `${formatCount(data.reviews.length)}건` },
              { label: '결제 제보', value: `${formatCount(data.paymentProofs.length)}건` },
              { label: '상담 기록', value: `${formatCount(data.consultationCount)}건` },
              { label: '보낸 문의', value: `${formatCount(data.inquiries.length)}건` },
            ]}
          />

          {data.withdrawal ? (
            <CardGrid>
              <Card title="탈퇴 상태" full note="탈퇴 요청이 있는 회원이에요 — apps/admin/withdrawals가 처리를 맡는다.">
                <Text>
                  {data.withdrawal.status}
                  {data.withdrawal.failure ? ` · 삭제 실패 ${formatCount(data.withdrawal.failure.attemptCount)}회 — ${data.withdrawal.failure.message}` : ''}
                </Text>
              </Card>
            </CardGrid>
          ) : null}

          <CardGrid>
            <Card title="웨딩" sub="owner 또는 partner로 걸린 것" full>
              <DataTable cols={WEDDING_COLS} rows={weddingRows} empty="만든 웨딩이 없어요" />
            </Card>

            <Card title="Pick 후보" sub={`최근 ${formatCount(data.candidates.length)}건`} full>
              <DataTable cols={CANDIDATE_COLS} rows={candidateRows} empty="담은 후보가 없어요" />
            </Card>

            <Card title="결정한 업체" full>
              <DataTable cols={DECISION_COLS} rows={decisionRows} empty="아직 결정한 업종이 없어요" />
            </Card>

            <Card title="쓴 후기" full>
              <DataTable cols={REVIEW_COLS} rows={reviewRows} empty="쓴 후기가 없어요" />
            </Card>

            <Card title="결제 제보" sub="가맹점명은 영수증에 찍힌 그대로" full>
              <DataTable cols={PROOF_COLS} rows={proofRows} empty="낸 결제 제보가 없어요" />
            </Card>

            <Card title="업체 소유 확인 신청" full>
              <DataTable cols={CLAIM_COLS} rows={claimRows} empty="신청한 적이 없어요" />
            </Card>

            <Card title="보낸 문의" sub="문의하기 · 고객지원 · 정보 오류 제보가 모두 여기로" full>
              <DataTable cols={INQUIRY_COLS} rows={inquiryRows} empty="보낸 문의가 없어요" />
            </Card>

            <Card
              title="리워드"
              sub={
                data.referral.code
                  ? `추천코드 ${data.referral.code} · 초대 ${formatCount(data.referral.invitedCount)}명 · 조건 충족 ${formatCount(data.referral.qualifiedCount)}명`
                  : '추천코드 없음'
              }
              full
            >
              <DataTable cols={GRANT_COLS} rows={grantRows} empty="받은 보상이 없어요" />
            </Card>

            <Card title="Npay 정산 요청" full>
              <DataTable cols={PAYOUT_COLS} rows={payoutRows} empty="정산 요청이 없어요" />
            </Card>
          </CardGrid>
        </>
      ) : null}
    </Page>
  );
}
