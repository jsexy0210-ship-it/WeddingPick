/**
 * WP-ADM-002 일일 브리핑 — 이제 「대시보드」 화면의 아래쪽 절반이다.
 *
 * 시안 `docs/design/html/웨딩픽 관리자 운영.dc.html` WP-ADM-002.
 * 서버가 주는 최근 24시간 판정·비용만 보여준다. 복구·수익은 이 응답에 없으므로
 * 수치를 만들어 채우지 않는다.
 *
 * **2026-09-15 대표 확정 — 「대시보드」(옛 `/admin/home`)와 한 화면으로 묶였다**(위아래,
 * 탭이 아니다). 대시보드가 「지금 이 순간의 상태」고 브리핑이 「하루치 요약」이라 같은
 * 성격이라 굳이 갈라 둘 이유가 없다는 것이 대표님 판단이다. 이 파일의 본체는
 * `BriefingPanel`로 옮기고 `home.tsx`가 그 안에서 이어 그린다. 자체 서버 응답을
 * 쓰므로 새로고침은 이 패널 것만 따로 둔다.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AdminSpacing as A, Colors, FontSize, LineHeight } from '@weddingpick/ui';
import { Redirect } from 'expo-router';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import {
  Card,
  CardGrid,
  EmptyState,
  KpiRow,
  LoadError,
  Rows,
  StatusBanner,
  type RowItem,
} from './_ui';
import { formatCount } from '@weddingpick/domain';

type BriefingRow = { workflow: string; decider: string; decisions: number; failed: number; costUsd: number | null };
type BriefingData = {
  briefing: BriefingRow[];
  budgetStatus: { feature: string; spentUsd: number; budgetUsd: number | null; state: string }[];
};

/** 실제 `/v1/admin/briefing` 응답만 표시한다. 없는 수치를 평온한 0으로 채우지 않는다. */
function isBriefingData(d: unknown): d is BriefingData {
  const o = d as Partial<BriefingData> | null;
  return (
    typeof o === 'object' &&
    o !== null &&
    Array.isArray(o.briefing) &&
    o.briefing.every((row) =>
      typeof row.workflow === 'string' &&
      typeof row.decider === 'string' &&
      typeof row.decisions === 'number' &&
      typeof row.failed === 'number' &&
      (row.costUsd === null || typeof row.costUsd === 'number')
    ) &&
    Array.isArray(o.budgetStatus)
  );
}

const SHAPE_ERROR = '일일 브리핑을 불러오지 못했어요. 다시 시도해 주세요.';
const money = (value: number) => `$${value.toFixed(2)}`;
const DECIDER_LABEL: Record<string, string> = { rule: '규칙', model: '자동 판단', human: '담당자' };

/** `/admin/home`(대시보드)이 위쪽 대시보드 아래에 이어 그리는 패널. */
export function BriefingPanel() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/briefing')
      .then((d) => {
        if (cancelled) return;
        if (!isBriefingData(d)) {
          setData(null);
          setError(SHAPE_ERROR);
          setLoading(false);
          return;
        }
        setData(d);
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

  const rows = data?.briefing ?? [];
  const total = rows.reduce((sum, row) => sum + row.decisions, 0);
  const failed = rows.reduce((sum, row) => sum + row.failed, 0);
  const knownCost = rows.length > 0 && rows.every((row) => row.costUsd !== null);
  const cost = rows.reduce((sum, row) => sum + (row.costUsd ?? 0), 0);
  const processedRows: RowItem[] = rows.map((row) => ({
    key: `${row.workflow}-${row.decider}`,
    dot: row.failed > 0 ? 'warn' : 'ok',
    name: row.workflow,
    meta: DECIDER_LABEL[row.decider] ?? '판정 방식 확인 필요',
    num: `${formatCount(row.decisions)}건`,
    tail: row.failed > 0 ? `확인 ${formatCount(row.failed)}건` : '처리됨',
    tailKind: row.failed > 0 ? 'warn' : 'ok',
  }));
  const pendingRows = processedRows.filter((_, i) => rows[i]?.failed > 0);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <View style={styles.panelHeadText}>
          <Text style={styles.panelTitle}>일일 브리핑</Text>
          {data ? <Text style={styles.panelSub}>최근 24시간</Text> : null}
        </View>
        <Pressable style={styles.panelAction} onPress={reload}>
          <Text style={styles.panelActionLabel}>새로 고침</Text>
        </Pressable>
      </View>

      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <StatusBanner
            tone={failed > 0 ? 'warn' : 'ok'}
            title={
              total === 0
                ? '최근 24시간 판정 내역이 없어요'
                : failed === 0
                  ? '확인할 판정이 없어요'
                  : `확인할 판정 ${formatCount(failed)}건이 있어요`
            }
            detail={`최근 24시간 판정 ${formatCount(total)}건`}
          />

          <KpiRow
            items={[
              { label: '판정', value: `${formatCount(total)}건` },
              {
                label: '처리 비율',
                value: total === 0 ? '—' : `${(((total - failed) / total) * 100).toFixed(1)}%`,
                kind: failed > 0 ? 'warn' : 'ok',
              },
              {
                label: '확인 필요',
                value: `${formatCount(failed)}건`,
                kind: failed > 0 ? 'warn' : 'ok',
              },
              { label: '분석 비용', value: knownCost ? money(cost) : '집계 전', note: '최근 24시간' },
            ]}
          />

          <CardGrid>
            <Card title="무엇이 처리됐나" sub="최근 24시간 판정">
              {processedRows.length === 0 ? (
                <EmptyState title="처리 내역이 없어요" />
              ) : (
                <Rows items={processedRows} />
              )}
            </Card>

            <Card title="확인 필요" sub="아직 끝나지 않은 판정">
              {pendingRows.length === 0 ? (
                <EmptyState title="확인할 것이 없어요" />
              ) : (
                <Rows items={pendingRows} />
              )}
            </Card>
          </CardGrid>
        </>
      ) : null}
    </View>
  );
}

/**
 * 옛 주소(`/admin/briefing`)는 저장된 링크·딥링크가 있을 수 있어 남긴다. 실제 화면은
 * `/admin/home`(대시보드)에 있다 — 그 안의 `BriefingPanel`이 이 파일의 본체다.
 */
export default function BriefingRedirect() {
  return <Redirect href="/admin/home?tab=briefing" />;
}

const styles = StyleSheet.create({
  panel: { gap: 16, paddingTop: A.bodyPaddingTop, paddingHorizontal: A.bodyPaddingX, paddingBottom: A.bodyPaddingX },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  panelHeadText: { flex: 1, minWidth: 0, gap: 2 },
  panelTitle: { fontSize: FontSize.t6, fontWeight: '700', color: Colors.light.text },
  panelSub: { fontSize: FontSize.tab, lineHeight: LineHeight.adminMeta, color: Colors.light.textAssistive },
  panelAction: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 6,
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundSelected,
  },
  panelActionLabel: { fontSize: FontSize.micro, fontWeight: '700', color: Colors.light.textSecondary },
});
