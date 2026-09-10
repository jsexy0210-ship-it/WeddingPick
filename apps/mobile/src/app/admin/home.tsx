/**
 * WP-ADM-001 관리자 홈 — 요약 대시보드
 *
 * 시안 `21-admin.dc.html`의 `dash` 화면. 두 덩어리로 되어 있다.
 *
 *   1. 「안대표가 볼 일」  사람이 결정해야만 진행되는 것. 한 줄을 누르면 그 화면으로 간다.
 *   2. 3열 카드 그리드     `dashCards` — 라벨 + 모드 배지 · 큰 숫자 + 단위 · 한 줄 설명.
 *
 * **화면 순서가 곧 설계다** — 내가 결정해야만 진행되는 것 → 내가 돈을 쓰는 것 →
 * 내가 봐야 하는 지표 → 자동으로 도는 것. 상단 배너가 그 앞에서 상태를 먼저
 * 말하고(v3.27 관리자 공통 규칙), 볼 일이 하나도 없으면 「확인할 것이 없어요」를
 * 그린다 — 빈 큐는 실패가 아니라 목표다.
 *
 * 숫자는 전부 `GET /v1/admin/dashboard`가 실제 큐에서 세어 보낸다. 서버는 뜻
 * (`tone` · `mode`)만 보내고 색은 여기서 토큰으로 고른다.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Layout, LineHeight, ProductSymbol, Radius, Spacing } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';

type QueueTone = 'danger' | 'caution';
type DashCardMode = '위험' | '비용' | '지표' | '자동';

type HumanQueueItem = {
  key: string;
  label: string;
  why: string;
  count: number;
  tone: QueueTone;
};

type DashCard = {
  key: string;
  label: string;
  mode: DashCardMode;
  value: string;
  unit: string;
  note: string;
};

type AutoSegmentKey = 'concluded' | 'failed' | 'human';
type AutoSegment = { key: AutoSegmentKey; label: string; count: number };

type AutoWorkflowRow = {
  workflow: string;
  concluded: number;
  failed: number;
  human: number;
  reverted: number;
  autoPct: number;
};

type AutoReview = {
  ratePct: number | null;
  segments: AutoSegment[];
  keepRatePct: number | null;
  revertedCount: number;
  medianLatencyMs: number | null;
  byWorkflow: AutoWorkflowRow[];
};

type AutoLogRow = {
  id: string;
  decision: string;
  subject: string;
  reasonCode: string;
  confidence: number | null;
  decidedAt: string;
  tone: 'ok' | 'fail' | 'human';
};

type DashboardData = {
  humanQueue: HumanQueueItem[];
  humanTotal: number;
  dashCards: DashCard[];
  auto: AutoReview;
  autoLog: AutoLogRow[];
};

/** 급한 정도 → 점과 건수의 색. 서버가 보내는 것은 뜻뿐이다. */
const TONE_COLOR: Record<QueueTone, string> = {
  danger: Colors.light.negative,
  caution: Colors.light.cautionary,
};

/**
 * 처리 방식 배지. 「자동」이 회색인 것은 의도다 — 정상으로 도는 것은 눈에 띄면
 * 안 된다(ADMIN.md WP-ADM-040 「정상이면 전부 회색」).
 */
const MODE_STYLE: Record<DashCardMode, { bg: string; fg: string }> = {
  위험: { bg: Colors.light.negativeBackground, fg: Colors.light.negative },
  비용: { bg: Colors.light.costBackground, fg: Colors.light.cost },
  지표: { bg: Colors.light.accentBackground, fg: Colors.light.accent },
  자동: { bg: Colors.light.backgroundSelected, fg: Colors.light.textAssistive },
};

/** 자동 검토 막대와 범례. 자동으로 끝난 것 · 못 끝낸 것 · 사람에게 넘어간 것. */
const SEGMENT_COLOR: Record<AutoSegmentKey, string> = {
  concluded: Colors.light.positive,
  failed: Colors.light.negative,
  human: Colors.light.cautionary,
};

/**
 * 판정 배지. 시안 `.ad-bdg`처럼 **옅은 바탕 + 진한 글씨**다 — 통으로 칠하면 목록
 * 여덟 줄이 전부 색 덩어리가 된다. 사람이 정한 건은 그 안에서 눈에 띄어야 한다.
 */
const LOG_STYLE: Record<AutoLogRow['tone'], { bg: string; fg: string }> = {
  ok: { bg: Colors.light.positiveBackground, fg: Colors.light.positive },
  fail: { bg: Colors.light.negativeBackground, fg: Colors.light.negative },
  human: { bg: Colors.light.cautionaryBackground, fg: Colors.light.cautionary },
};

/** 큐 키 → 그 큐를 처리하는 화면. 서버는 경로를 모른다. */
const SCREEN_PATH: Record<string, string> = {
  queue: '/admin/queue',
  rebuttal: '/admin/rebuttal',
  objections: '/admin/objections',
  'pii-reviews': '/admin/pii-reviews',
  'biz-queue': '/admin/biz-queue',
  'ai-usage': '/admin/ai-usage',
  campaigns: '/admin/campaigns',
  'price-stats': '/admin/price-stats',
  users: '/admin/users',
  decisions: '/admin/decisions',
};

/**
 * 판정 시각. **KST로 적는다** — DB의 timestamptz는 UTC로 담기고, 그대로 옮기면
 * 아홉 시간 어긋난 시각을 보게 된다(CLAUDE.md).
 */
function hhmmKst(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** 막대 한 칸의 폭. 전체가 0이면 칸을 그리지 않는다 — 0을 100%로 늘리지 않는다. */
function pctOf(count: number, all: number): `${number}%` {
  return all === 0 ? '0%' : `${(count / all) * 100}%`;
}

/** 3열 그리드. 마지막 줄이 덜 차면 빈 칸으로 메워 카드 폭을 지킨다. */
function rowsOfThree<T>(items: T[]): (T | null)[][] {
  const rows: (T | null)[][] = [];
  for (let i = 0; i < items.length; i += 3) {
    const row: (T | null)[] = items.slice(i, i + 3);
    while (row.length < 3) row.push(null);
    rows.push(row);
  }
  return rows;
}

export default function AdminHomeScreen() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/dashboard')
      .then((d) => {
        if (cancelled) return;
        setData(d as DashboardData);
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

  function reload() { setRev((r) => r + 1); }

  function open(key: string) {
    const path = SCREEN_PATH[key];
    if (path) router.push(path as never);
  }

  const urgent = data ? data.humanQueue.some((q) => q.tone === 'danger' && q.count > 0) : false;
  const total = data?.humanTotal ?? 0;

  /*
   * 상단 배너 — 문제 없으면 초록, 확인할 것이 있으면 주황, 조치가 필요하면 빨강
   * (v3.27 관리자 공통 규칙). 조치가 필요한 큐는 되돌릴 수 없는 결정이 걸린 것들이다.
   */
  const banner = urgent
    ? { fg: Colors.light.negative, bg: Colors.light.negativeBoxBackground, border: Colors.light.negativeBorder, text: `되돌릴 수 없는 결정이 기다리고 있어요 · 모두 ${total}건` }
    : total > 0
      ? { fg: Colors.light.cautionary, bg: Colors.light.cautionaryBoxBackground, border: Colors.light.cautionaryBorder, text: `확인할 것이 ${total}건 있어요` }
      : { fg: Colors.light.positive, bg: Colors.light.positiveBackground, border: Colors.light.positiveBorder, text: '확인할 것이 없어요' };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.topBarTitles}>
          <Text style={styles.title}>요약 대시보드</Text>
          <Text style={styles.subtitle}>자동 검토가 처리한 것과 남은 것</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={reload}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <DelayedLoader active={loading} size={40} style={styles.centered} />

      {!loading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={reload}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && data && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* 지금 봐야 할 것이 맨 위 — 배너가 상태를 먼저 말한다. */}
          <View style={[styles.banner, { backgroundColor: banner.bg, borderColor: banner.border }]}>
            <View style={[styles.bannerDot, { backgroundColor: banner.fg }]} />
            <Text style={[styles.bannerText, { color: banner.fg }]}>{banner.text}</Text>
          </View>

          {/*
            1. 한 줄에 나란히 — 왼쪽 「자동 검토 현황」(1.3) · 오른쪽 「안대표가 볼 일」(1).
            시안의 첫 줄 그대로다. 둘 다 맨 위에 오고, 위의 배너가 그 앞에서 상태를 먼저 말한다.
          */}
          <View style={styles.topRow}>
          {(() => {
            const auto = data.auto;
            const all = auto.segments.reduce((sum, seg) => sum + seg.count, 0);
            return (
              <View style={[styles.card, styles.autoCol]}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitleTight}>자동 검토 현황</Text>
                  <View style={styles.windowBadge}>
                    <Text style={styles.windowBadgeText}>최근 24시간</Text>
                  </View>
                  <Text style={styles.cardHeadNote} numberOfLines={1}>
                    전 메뉴 자동 검토 · 리스크가 큰 건만 사람이 봐요
                  </Text>
                </View>

                {all === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyTitle}>최근 24시간에 판정이 없어요</Text>
                    <Text style={styles.emptySub}>건이 들어오면 자동 검토가 먼저 돌아요</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.rateRow}>
                      <Text style={styles.rateValue}>{auto.ratePct}</Text>
                      <Text style={styles.rateUnit}>%</Text>
                      <Text style={styles.rateLabel}>자동 처리율</Text>
                    </View>

                    <View style={styles.stackedBar}>
                      {auto.segments.map((seg) => (
                        <View
                          key={seg.key}
                          style={{ width: pctOf(seg.count, all), backgroundColor: SEGMENT_COLOR[seg.key] }}
                        />
                      ))}
                    </View>

                    <View style={styles.legendRow}>
                      {auto.segments.map((seg) => (
                        <View key={seg.key} style={styles.legendCell}>
                          <View style={styles.legendHead}>
                            <View style={[styles.legendDot, { backgroundColor: SEGMENT_COLOR[seg.key] }]} />
                            <Text style={styles.legendLabel}>{seg.label}</Text>
                          </View>
                          <Text style={styles.legendValue}>{seg.count}건</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.qualityRow}>
                      <View style={styles.qualityBox}>
                        <Text style={styles.qualityKey}>판정 유지율</Text>
                        <Text style={[styles.qualityValue, { color: Colors.light.positive }]}>
                          {auto.keepRatePct === null ? '—' : `${auto.keepRatePct}%`}
                        </Text>
                        <Text style={styles.qualityNote}>되돌림 {auto.revertedCount}건</Text>
                      </View>
                      <View style={styles.qualityBox}>
                        <Text style={styles.qualityKey}>판정 시간</Text>
                        <Text style={[styles.qualityValue, { color: Colors.light.accent }]}>
                          {auto.medianLatencyMs === null ? '—' : `${(auto.medianLatencyMs / 1000).toFixed(1)}초`}
                        </Text>
                        <Text style={styles.qualityNote}>중앙값</Text>
                      </View>
                      <View style={styles.qualityBox}>
                        <Text style={styles.qualityKey}>사람이 결정</Text>
                        <Text style={styles.qualityValue}>
                          {auto.segments.find((seg) => seg.key === 'human')?.count ?? 0}건
                        </Text>
                        <Text style={styles.qualityNote}>전체 {all}건 중</Text>
                      </View>
                    </View>

                    {/* 워크플로별 자동 처리 비중. 표는 카드 안에서만 가로로 흐른다. */}
                    <View style={styles.tableHead}>
                      <Text style={[styles.th, styles.thGrow]}>워크플로</Text>
                      <Text style={[styles.th, styles.thBar]}>자동 처리 비중</Text>
                      <Text style={[styles.th, styles.thNum]}>자동</Text>
                      <Text style={[styles.th, styles.thNum]}>실패</Text>
                      <Text style={[styles.th, styles.thNum]}>사람</Text>
                      <Text style={[styles.th, styles.thNum]}>되돌림</Text>
                    </View>
                    {auto.byWorkflow.map((w) => {
                      const wAll = w.concluded + w.failed + w.human;
                      return (
                        <View key={w.workflow} style={styles.tableRow}>
                          <Text style={[styles.tdName, styles.thGrow]} numberOfLines={1}>{w.workflow}</Text>
                          <View style={styles.thBarCell}>
                            <View style={styles.miniBar}>
                              <View style={{ width: pctOf(w.concluded, wAll), backgroundColor: Colors.light.positive }} />
                              <View style={{ width: pctOf(w.failed, wAll), backgroundColor: Colors.light.negative }} />
                              <View style={{ width: pctOf(w.human, wAll), backgroundColor: Colors.light.cautionary }} />
                            </View>
                            <Text style={styles.miniBarPct}>{w.autoPct}%</Text>
                          </View>
                          <Text style={[styles.td, styles.thNum, { color: Colors.light.positive }]}>{w.concluded || '—'}</Text>
                          <Text style={[styles.td, styles.thNum, { color: Colors.light.negative }]}>{w.failed || '—'}</Text>
                          <Text style={[styles.td, styles.thNum, { color: Colors.light.cautionary }]}>{w.human || '—'}</Text>
                          <Text style={[styles.td, styles.thNum, styles.tdMuted]}>{w.reverted || '—'}</Text>
                        </View>
                      );
                    })}
                    <Text style={styles.tableNote}>
                      되돌림은 자동 판정을 사람이 취소한 건이에요. 같은 워크플로에서 되돌림이 늘면 그 기준부터 손봐요.
                    </Text>
                  </>
                )}
              </View>
            );
          })()}

          {/* 사람이 결정해야만 진행되는 것. 한 줄을 누르면 그 화면으로 간다. */}
          <View style={[styles.card, styles.humanCol]}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>안대표가 볼 일</Text>
              <Text style={[styles.humanTotal, { color: total === 0 ? Colors.light.textAssistive : banner.fg }]}>
                {total}건
              </Text>
            </View>

            {/* 빈 상태가 정상 상태 — 빈 화면을 두지 않는다. */}
            {total === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>확인할 것이 없어요</Text>
                <Text style={styles.emptySub}>사람이 결정해야 하는 건을 모두 끝냈어요</Text>
              </View>
            ) : (
              data.humanQueue
                .filter((item) => item.count > 0)
                .map((item) => (
                  <Pressable key={item.key} style={styles.queueRow} onPress={() => open(item.key)}>
                    <View style={[styles.queueDot, { backgroundColor: TONE_COLOR[item.tone] }]} />
                    <View style={styles.queueTexts}>
                      <Text style={styles.queueLabel}>{item.label}</Text>
                      <Text style={styles.queueWhy}>{item.why}</Text>
                    </View>
                    <Text style={[styles.queueCount, { color: TONE_COLOR[item.tone] }]}>{item.count}</Text>
                    <ProductSymbol name="chevronRight" size={Layout.iconRow} color={Colors.light.textDisabled} />
                  </Pressable>
                ))
            )}
          </View>
          </View>

          {/* 2. 3열 카드 그리드 — 돈을 쓰는 것 → 봐야 하는 지표 → 자동으로 도는 것 */}
          {rowsOfThree(data.dashCards).map((row, i) => (
            <View key={i} style={styles.cardRow}>
              {row.map((card, j) =>
                card === null ? (
                  <View key={`gap-${j}`} style={styles.gridFill} />
                ) : (
                  <Pressable key={card.key} style={styles.gridCard} onPress={() => open(card.key)}>
                    <View style={styles.gridHead}>
                      <Text style={styles.gridLabel} numberOfLines={1}>{card.label}</Text>
                      <View style={[styles.modeBadge, { backgroundColor: MODE_STYLE[card.mode].bg }]}>
                        <Text style={[styles.modeText, { color: MODE_STYLE[card.mode].fg }]}>{card.mode}</Text>
                      </View>
                    </View>
                    <View style={styles.gridValueRow}>
                      <Text style={styles.gridValue}>{card.value}</Text>
                      <Text style={styles.gridUnit}>{card.unit}</Text>
                    </View>
                    <Text style={styles.gridNote}>{card.note}</Text>
                  </Pressable>
                )
              )}
            </View>
          ))}

          {/* 3. 자동 판정 로그 — 판정 근거가 함께 기록돼요 */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>자동 판정 로그</Text>
              <Text style={styles.cardHeadNote}>판정 근거가 함께 기록돼요</Text>
            </View>

            {data.autoLog.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>기록된 판정이 없어요</Text>
                <Text style={styles.emptySub}>판정이 생기면 무엇으로 · 왜 정했는지 여기에 남아요</Text>
              </View>
            ) : (
              data.autoLog.map((row) => (
                <View key={row.id} style={styles.logRow}>
                  <View style={[styles.verdict, { backgroundColor: LOG_STYLE[row.tone].bg }]}>
                    <Text style={[styles.verdictText, { color: LOG_STYLE[row.tone].fg }]} numberOfLines={1}>
                      {row.decision}
                    </Text>
                  </View>
                  <View style={styles.logTexts}>
                    <Text style={styles.logTitle} numberOfLines={1}>{row.subject}</Text>
                    <Text style={styles.logReason} numberOfLines={2}>{row.reasonCode}</Text>
                  </View>
                  <Text style={styles.logConf}>
                    {row.confidence === null ? '—' : `${Math.round(row.confidence * 100)}%`}
                  </Text>
                  <Text style={styles.logWhen}>{hhmmKst(row.decidedAt)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },

  /* 상단바 76 — size.adminTopBar. 제목과 그 아래 한 줄 설명이 같이 앉는다. */
  topBar: {
    height: Layout.adminTopBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
    gap: Layout.inlineGap,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  topBarTitles: { flex: 1, gap: Spacing.half },
  title: { fontSize: FontSize.t4, lineHeight: LineHeight.t4, fontWeight: '700', color: Colors.light.text },
  subtitle: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: Colors.light.textAssistive },
  refreshBtn: {
    paddingHorizontal: Layout.chipPaddingX,
    paddingVertical: Spacing.two,
    borderRadius: Radius.control,
    backgroundColor: Colors.light.backgroundSelected,
  },
  refreshText: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, color: Colors.light.textSecondary },

  body: { flex: 1 },
  /* 본문 패딩 32 · 카드 간격 20(v3.27 관리자 캔버스). */
  bodyContent: { padding: Spacing.five, gap: Layout.listGap },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  errorText: { fontSize: FontSize.t6, lineHeight: LineHeight.t6, color: Colors.light.negative, marginBottom: Spacing.three },
  retryBtn: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.control,
    backgroundColor: Colors.light.tint,
  },
  retryText: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, fontWeight: '700', color: Colors.light.onTint },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1,
    paddingHorizontal: Layout.cardPadding,
    paddingVertical: Spacing.three,
  },
  bannerDot: { width: Layout.tabPickDot, height: Layout.tabPickDot, borderRadius: Radius.pill },
  bannerText: { flex: 1, fontSize: FontSize.t7, lineHeight: LineHeight.t7, fontWeight: '700' },

  card: {
    backgroundColor: Colors.light.background,
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Layout.iconTextGap, paddingBottom: Spacing.three },
  cardTitle: { flex: 1, fontSize: FontSize.t6, lineHeight: LineHeight.t6, fontWeight: '700', color: Colors.light.text },
  humanTotal: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, fontWeight: '700', fontVariant: ['tabular-nums'] },

  emptyBox: {
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    backgroundColor: Colors.light.backgroundElement,
    paddingVertical: Spacing.five,
    paddingHorizontal: Layout.cardPadding,
  },
  emptyTitle: { fontSize: FontSize.t6, lineHeight: LineHeight.t6, fontWeight: '700', color: Colors.light.text },
  emptySub: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: Colors.light.textAssistive, textAlign: 'center' },

  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    paddingVertical: Layout.rowPaddingY,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  queueDot: { width: Layout.tabPickDot, height: Layout.tabPickDot, borderRadius: Radius.pill },
  queueTexts: { flex: 1, gap: Spacing.half },
  queueLabel: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, fontWeight: '700', color: Colors.light.text },
  queueWhy: { fontSize: FontSize.tab, lineHeight: LineHeight.tab, color: Colors.light.textAssistive },
  queueCount: { fontSize: FontSize.t6, lineHeight: LineHeight.t6, fontWeight: '700', fontVariant: ['tabular-nums'] },

  /* 배지가 제목 바로 옆에 붙는 머리. 오른쪽 설명은 `cardHeadNote`가 밀어낸다. */
  cardTitleTight: { fontSize: FontSize.t6, lineHeight: LineHeight.t6, fontWeight: '700', color: Colors.light.text },
  cardHeadNote: { marginLeft: 'auto', fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: Colors.light.textAssistive },
  windowBadge: {
    borderRadius: Radius.control,
    backgroundColor: Colors.light.accentBackground,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  windowBadgeText: { fontSize: FontSize.tab, lineHeight: LineHeight.tab, fontWeight: '700', color: Colors.light.accent },

  rateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.one },
  /* 40/700 · letter-spacing -1.4 — typography.scale adminHero. */
  rateValue: {
    fontSize: FontSize.adminHero,
    lineHeight: LineHeight.adminHero,
    fontWeight: '700',
    letterSpacing: -1.4,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  rateUnit: { fontSize: FontSize.t6, lineHeight: LineHeight.t6, fontWeight: '700', color: Colors.light.textAssistive },
  rateLabel: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, color: Colors.light.textAssistive, paddingLeft: Spacing.one },

  stackedBar: {
    flexDirection: 'row',
    height: Layout.stackedBar,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundSelected,
    marginTop: Layout.iconTextGap,
    marginBottom: Layout.sectionHeadGap,
  },
  legendRow: { flexDirection: 'row', gap: Layout.iconTextGap, paddingBottom: Layout.inlineGap },
  legendCell: { flex: 1, gap: Spacing.one },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  legendDot: { width: Layout.tabPickDot, height: Layout.tabPickDot, borderRadius: Radius.pill },
  legendLabel: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: Colors.light.textAssistive },
  legendValue: {
    fontSize: FontSize.t5,
    lineHeight: LineHeight.t5,
    fontWeight: '700',
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },

  qualityRow: {
    flexDirection: 'row',
    gap: Layout.iconTextGap,
    paddingTop: Layout.sectionHeadGap,
    paddingBottom: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.light.backgroundSelected,
  },
  qualityBox: {
    flex: 1,
    gap: Spacing.half,
    borderRadius: Radius.medium,
    backgroundColor: Colors.light.backgroundElement,
    paddingHorizontal: Layout.inlineGap,
    paddingVertical: Layout.rowPaddingY,
  },
  qualityKey: { fontSize: FontSize.tab, lineHeight: LineHeight.tab, color: Colors.light.textAssistive },
  qualityValue: {
    fontSize: FontSize.t5,
    lineHeight: LineHeight.t5,
    fontWeight: '700',
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  qualityNote: { fontSize: FontSize.tab, lineHeight: LineHeight.tab, color: Colors.light.textDisabled },

  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.light.backgroundSelected,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  th: { fontSize: FontSize.tab, lineHeight: LineHeight.tab, color: Colors.light.textAssistive },
  thGrow: { flex: 1 },
  thBar: { width: 150 },
  thNum: { width: 56, textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    paddingVertical: Layout.rowPaddingY,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  thBarCell: { width: 150, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  miniBar: {
    flex: 1,
    flexDirection: 'row',
    height: Layout.tabPickDot,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundSelected,
  },
  miniBarPct: {
    width: 34,
    textAlign: 'right',
    fontSize: FontSize.tab,
    lineHeight: LineHeight.tab,
    fontWeight: '700',
    color: Colors.light.textAssistive,
    fontVariant: ['tabular-nums'],
  },
  tdName: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, fontWeight: '700', color: Colors.light.text },
  td: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tdMuted: { color: Colors.light.textAssistive },
  tableNote: {
    fontSize: FontSize.micro,
    lineHeight: LineHeight.micro,
    color: Colors.light.textAssistive,
    paddingTop: Layout.sectionHeadGap,
  },

  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.inlineGap,
    paddingVertical: Layout.rowPaddingY,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  /* 시안 `.ad-bdg` — height 22 · radius 4 · padding 0 7 · 13/700. */
  verdict: {
    width: 58,
    height: Layout.badgeHeight,
    justifyContent: 'center',
    borderRadius: Radius.badge,
    paddingHorizontal: Layout.adminBadgePaddingX,
  },
  verdictText: {
    fontSize: FontSize.micro,
    lineHeight: LineHeight.micro,
    fontWeight: '700',
    textAlign: 'center',
  },
  logTexts: { flex: 1, gap: Spacing.half },
  logTitle: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, fontWeight: '700', color: Colors.light.text },
  logReason: { fontSize: FontSize.tab, lineHeight: LineHeight.tab, color: Colors.light.textAssistive },
  logConf: {
    width: 56,
    textAlign: 'right',
    fontSize: FontSize.micro,
    lineHeight: LineHeight.micro,
    fontWeight: '700',
    color: Colors.light.textStrong,
    fontVariant: ['tabular-nums'],
  },
  logWhen: {
    width: 44,
    textAlign: 'right',
    fontSize: FontSize.tab,
    lineHeight: LineHeight.tab,
    color: Colors.light.textDisabled,
    fontVariant: ['tabular-nums'],
  },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Layout.listGap },
  /* 시안의 «flex:1.3» · «flex:1». 자동 검토 현황이 표를 들고 있어 더 넓다. */
  autoCol: { flex: 1.3, minWidth: 0 },
  humanCol: { flex: 1, minWidth: 0 },

  cardRow: { flexDirection: 'row', gap: Layout.listGap },
  gridFill: { flex: 1 },
  gridCard: {
    flex: 1,
    backgroundColor: Colors.light.background,
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Spacing.two,
  },
  gridHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  gridLabel: { flex: 1, fontSize: FontSize.t7, lineHeight: LineHeight.t7, fontWeight: '700', color: Colors.light.text },
  modeBadge: { borderRadius: Radius.badge, paddingHorizontal: Spacing.one, paddingVertical: Spacing.half },
  modeText: { fontSize: FontSize.adminTag, lineHeight: LineHeight.adminTag, fontWeight: '700' },
  gridValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.one },
  gridValue: { fontSize: FontSize.t2, lineHeight: LineHeight.t2, fontWeight: '700', color: Colors.light.text, fontVariant: ['tabular-nums'] },
  gridUnit: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: Colors.light.textAssistive },
  gridNote: { fontSize: FontSize.tab, lineHeight: LineHeight.tab, color: Colors.light.textAssistive },
});
