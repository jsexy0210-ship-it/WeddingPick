import type { MyReport } from '@weddingpick/api-contract';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { ErrorView } from '@weddingpick/ui';
import { listMyReports } from '@/api/client';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { EmptyBox, Hero, NoteBox, Row, Rows, Section, SubScreen } from '@/features/settings/my-kit';

/** 시안 12b-remaining #10 «내 후기 · WP-REV-004»의 renderVals. */
const S = {
  title: '내 후기',
  hero: (n: number) => [`${n}곳에`, '후기를 남겼어요'],
  heroEmpty: ['아직 남긴 후기가', '없어요'],
  written: '쓴 후기',
  writable: '쓸 수 있는 곳',
  write: '쓰기',
  /** 시안 «Pick 인증 완료 · 3월 4일». `REPORT_KIND_LABEL`은 배지용이라 띄어쓰지 않아 여기서는 쓰지 않는다. */
  verified: 'Pick 인증 완료',
  /** 아직 보이지 않는 후기 — 서버가 `inUse: false`로 알려준 것만 적는다. */
  hidden: '확인 중',
  emptyWritable: 'Pick 인증을 하면 그 업체에 후기를 쓸 수 있어요',
  noteTitle: '후기는 언제든 고칠 수 있어요',
  noteBody: '고치면 수정됨 표시가 함께 보여요.',
  loadError: '내 후기를 불러오지 못했어요',
} as const;

/** «2026.07». 후기 행의 작성 시기 — 시안 «2026.07 · 도움돼요 14»의 앞 절반. */
function yearMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 7).replace('-', '.');
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** «3월 4일». Pick 인증을 끝낸 날 — 시안 «Pick 인증 완료 · 3월 4일». */
function monthDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 내 후기 · WP-REV-004. 시안 12b-remaining #10.
 *
 *   Hero → «쓴 후기»(업체명 · 작성 시기) → «쓸 수 있는 곳»(Pick 인증 완료 + «쓰기» 배지) → note
 *
 * 두 목록 모두 `/v1/me/reports`(내 제보 내역) 한 번으로 만든다 — 후기만 따로 주는 엔드포인트가
 * 없고, 그 응답에 후기(`kind: 'review'`)와 Pick 인증(`kind: 'payment_proof'`)이 이미 다 있다.
 *
 * **시안에 있지만 서버가 주지 않아 비워둔 것**
 *   - 썸네일: `myReportSchema`에 이미지가 없다. 업체 이미지를 따로 부르면 목록 한 줄마다 요청이
 *     하나씩 붙는다 — 행을 글자만으로 둔다.
 *   - «도움돼요 14» · «반론 1» 배지: 도움돼요 수와 반론 수가 계약에 없다. 지어내지 않는다.
 *     대신 서버가 «지금 쓰이고 있는가»(`inUse`)는 알려주므로 그것만 «확인 중»으로 적는다.
 *
 * 행을 누르면 그 업체의 후기 목록으로 간다. 시안이 가리키는 후기 상세(WP-REV-003)는 아직 화면이
 * 없고, 고치기 화면(`edit-review`)은 별점 · 제목 · 본문을 params로 받는데 `/v1/me/reports`가 그 셋을
 * 주지 않는다 — 없는 값을 채워 보내는 대신 글이 실제로 보이는 자리로 보낸다.
 */
export default function MyReviewsScreen() {
  const [reports, setReports] = useState<MyReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void listMyReports()
      .then((response) => {
        setError(null);
        setReports(response.reports);
      })
      .catch((caught: Error) => setError(caught.message ?? S.loadError));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorView message={error} onRetry={load} />;
  if (reports === null) return <DelayedLoadingView />;

  const written = reports.filter((report) => report.kind === 'review');
  /* 이미 후기를 쓴 업체는 «쓸 수 있는 곳»에서 뺀다 — 한 사람이 한 업체에 하나다(reviews 계약). */
  const reviewed = new Set(written.map((report) => report.vendorId).filter(Boolean));
  const writable = reports.filter(
    (report) =>
      report.kind === 'payment_proof' &&
      report.vendorId !== null &&
      report.inUse &&
      !reviewed.has(report.vendorId)
  );

  return (
    <SubScreen title={S.title}>
      <Hero lines={written.length > 0 ? S.hero(written.length) : S.heroEmpty} />

      {written.length > 0 ? (
        <Section title={S.written}>
          <Rows>
            {written.map((report) => (
              <Row
                key={report.id}
                name={report.subject}
                meta={yearMonth(report.reportedAt)}
                tail={report.inUse ? undefined : S.hidden}
                tailBadge={report.inUse ? undefined : 'wait'}
                chevron={report.vendorId !== null}
                onPress={
                  report.vendorId === null
                    ? undefined
                    : () => router.push(`/search/${report.vendorId}/reviews`)
                }
              />
            ))}
          </Rows>
        </Section>
      ) : null}

      <Section title={S.writable}>
        {writable.length > 0 ? (
          <Rows>
            {writable.map((report) => (
              <Row
                key={report.id}
                name={report.subject}
                meta={`${S.verified} · ${monthDay(report.reportedAt)}`}
                tail={S.write}
                tailBadge="brand"
                onPress={() => router.push(`/search/${report.vendorId}/write-review`)}
                accessibilityLabel={`${report.subject} 후기 쓰기`}
              />
            ))}
          </Rows>
        ) : (
          <EmptyBox>{S.emptyWritable}</EmptyBox>
        )}
      </Section>

      <Section>
        <NoteBox title={S.noteTitle} body={S.noteBody} />
      </Section>
    </SubScreen>
  );
}
