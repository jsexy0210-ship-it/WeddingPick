import type { MyReportListResponse } from '@weddingpick/api-contract';
import { TERMS, manwon } from '@weddingpick/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { listMyReports } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { formatMonthDayDot } from '@/features/common/format-date';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { Badge, Band, ListRow, Section, type BadgeTone } from '@/features/wedding/screen-kit';
import { ActionButton } from '@weddingpick/ui';
import strings from '../../../../../spec/strings.ko.json';

const S = {
  title: TERMS.myReports,
  seeAll: '전체 보기',
  empty: '아직 제보한 것이 없어요',
} as const;

function badgeOf(report: MyReportListResponse['reports'][number]): { label: string; tone: BadgeTone } {
  if (report.inUse) return { label: '반영됨', tone: 'ok' };
  if (report.needsCheck) return { label: '확인 필요', tone: 'wait' };

  return { label: '반영 전', tone: 'none' };
}

/** 결제인증 화면 안에서 최근 제보와 전체 내역 진입점을 함께 보여준다. */
export function MyReportSummary() {
  const [reports, setReports] = useState<MyReportListResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const loadVersion = useRef(0);

  const load = useCallback(() => {
    const version = ++loadVersion.current;
    if (!isServerConfigured) return;
    setLoadFailed(false);
    listMyReports()
      .then((next) => {
        if (version === loadVersion.current) setReports(next);
      })
      .catch(() => {
        if (version === loadVersion.current) setLoadFailed(true);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        loadVersion.current += 1;
      };
    }, [load])
  );

  if (!isServerConfigured) return null;

  const recent = reports?.reports.slice(0, 3) ?? [];

  return (
    <>
      <Band />
      <Section title={S.title} action={{ label: S.seeAll, onPress: () => router.push('/my/reports' as never) }}>
        {loadFailed ? (
          <ActionButton label={strings.common['cta.retry']} hint={strings.journey.loadFailed} onPress={load} />
        ) : null}
        {reports === null ? (
          loadFailed ? null : <DelayedLoader size={28} />
        ) : recent.length === 0 ? (
          <ListRow title={S.empty} titleColor="textAssistive" divider={false} />
        ) : (
          recent.map((report) => {
            const badge = badgeOf(report);

            return (
              <ListRow
                key={report.id}
                title={report.subject}
                titleBold
                sub={[report.amount != null ? manwon(report.amount) : report.kindLabel, formatMonthDayDot(report.reportedAt)]
                  .filter(Boolean)
                  .join(' · ')}
                subLines={1}
                right={<Badge label={badge.label} tone={badge.tone} />}
                onPress={() => router.push('/my/reports' as never)}
              />
            );
          })
        )}
      </Section>
    </>
  );
}
