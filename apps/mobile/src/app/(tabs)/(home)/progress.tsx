import type { CurrentUser, DecisionListResponse } from '@weddingpick/api-contract';
import { dDay, formatMonthDayDot } from '@weddingpick/domain';
import { router } from 'expo-router';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAppBootstrap, listDecisions } from '@/api/client';
import {
  Badge,
  type BadgeKind,
  ErrorView,
  Layout,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  SkeletonView,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import {
  categoryStatuses,
  currentCategory,
  decidedCount,
  HOME_TOTAL,
  type CategoryStatus,
} from '@/features/home/state';

/**
 * 준비 현황 전체. WP-HOME-009 · SPEC §13.9.
 *
 * 홈 4칸의 «전체 보기»가 오는 곳이고, **진입은 홈 한 곳뿐이다.** 웨딩일정 메뉴의
 * 준비현황(WP-OUR-002)은 폐기하고 여기로 옮겼다 — 같은 내용을 두 탭에서 보여주면
 * 사용자가 어디서 봐야 할지 헷갈린다.
 *
 * 레이아웃은 `08-schedule-sub.dc.html` 7번(준비현황) 그대로다.
 *
 *   히어로       «12개 중 / N개를 끝냈어요» 26/35 두 줄 + «예식까지 D일 남았어요» 16
 *   그룹 제목    14/19 700 #868B94 (small)
 *   행           업종 18/24 · 메타 14 · 배지(4 9 · r4 · 14 700) · chevron 18 · 구분선 1
 *   결정 완료    메타 «업체명 · 05.16(토)» · 배지 «완료»(success)
 *   진행 중      메타 «후보 N곳» · 현재 업종만 bold + coral 배지 «좁히는 중» · 나머지 «모으는 중»
 *   아직 시작 전  배지 «시작 전» 회색
 *
 * 비어 있는 그룹은 제목까지 접는다. 빈 자리를 제목으로 알리지 않는다.
 */

type ProgressData = {
  me: CurrentUser | null;
  statuses: CategoryStatus[];
  current: CategoryStatus['category'] | null;
  /** 앱에서 정한 업종의 결정일. key = category. 앱 밖에서 정한 것은 없다. */
  decidedAt: Record<string, string>;
};

export default function ProgressScreen() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void getAppBootstrap()
      .then(async (boot) => {
        const statuses = categoryStatuses({
          candidates: boot.candidates,
          preparedCategories: boot.member?.preparedCategories ?? [],
        });
        const current = currentCategory(statuses, boot.candidates?.nextCategory ?? null);
        /*
         * 결정일은 결정 목록에만 있다. 못 받아도 화면은 뜬다 — 날짜 한 칸이 빠질
         * 뿐이고, 그 칸은 원래 «있으면» 적는 자리다.
         */
        const decisions: DecisionListResponse | null =
          boot.member?.weddingId == null
            ? null
            : await listDecisions(boot.member.weddingId).catch(() => null);
        const decidedAt: Record<string, string> = {};

        for (const decision of decisions?.decisions ?? []) {
          decidedAt[decision.category] = decision.decidedAt;
        }

        setData({ me: boot.member, statuses, current, decidedAt });
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : '준비 현황을 불러오지 못했어요');
      });
  }, []);

  useEffect(load, [load]);

  /* 다시 시도 — 오류를 지우고 스켈레톤으로 돌아간 뒤 다시 부른다. */
  const retry = useCallback(() => {
    setError(null);
    setData(null);
    load();
  }, [load]);

  if (error !== null) return <ErrorView message={error} onRetry={retry} />;
  if (data === null) return <SkeletonView />;

  const done = data.statuses.filter((row) => row.state === 'decided');
  const going = data.statuses.filter((row) => row.state !== 'decided' && row.pickCount > 0);
  const before = data.statuses.filter((row) => row.state !== 'decided' && row.pickCount === 0);
  const decided = decidedCount(data.statuses);
  const weddingDate = data.me?.weddingDate ?? null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <NavBar title="준비 현황" onBack={() => router.back()} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.hero}>
            <ThemedText type="t2">
              {`${HOME_TOTAL}개 중`}
              {'\n'}
              {`${decided}개를 끝냈어요`}
            </ThemedText>
            <ThemedText type="t6" themeColor="textSecondary" numberOfLines={1}>
              {weddingLine(weddingDate)}
            </ThemedText>
          </ThemedView>

          {done.length === 0 ? null : (
            <Group title="결정 완료">
              {done.map((row) => (
                <Row
                  key={row.category}
                  label={row.label}
                  meta={decidedMeta(row.decidedName, data.decidedAt[row.category] ?? null)}
                  badge="완료"
                  tone="done"
                  onPress={() => router.push(`/pick?category=${row.category}`)}
                />
              ))}
            </Group>
          )}

          {going.length === 0 ? null : (
            <Group title="진행 중">
              {going.map((row) => (
                <Row
                  key={row.category}
                  label={row.label}
                  meta={`후보 ${row.pickCount}곳`}
                  badge={row.category === data.current ? '좁히는 중' : '모으는 중'}
                  tone={row.category === data.current ? 'now' : 'none'}
                  onPress={() => router.push(`/pick?category=${row.category}`)}
                />
              ))}
            </Group>
          )}

          {before.length === 0 ? null : (
            <Group title="아직 시작 전">
              {before.map((row) => (
                <Row
                  key={row.category}
                  label={row.label}
                  meta={null}
                  /* 아직 아무 데도 담지 않았을 때(0개 구간)는 첫 업종이 «먼저»다 — 홈 4칸과 같은 말. */
                  badge={row.category === data.current ? '먼저' : '시작 전'}
                  tone={row.category === data.current ? 'now' : 'none'}
                  onPress={() => router.push(`/pick?category=${row.category}`)}
                />
              ))}
            </Group>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/* ---------------------------------------------------------------- 조각 */

/** 히어로 둘째 줄. 시안 «예식까지 140일 남았어요». 오늘·지난 뒤는 도메인 문장 그대로. */
function weddingLine(weddingDate: string | null): string {
  if (weddingDate === null) return '예식일 미정';

  const day = dDay(weddingDate);

  return day.kind === 'upcoming' ? `예식까지 ${day.days}일 남았어요` : day.text;
}

/** 결정 완료 행의 메타. «업체명 · 05.16(토)». 앱 밖에서 정했다고 체크만 한 업종은 둘 다 없어 null. */
function decidedMeta(name: string | null, decidedAt: string | null): string | null {
  const parts = [name, decidedAt === null ? null : formatMonthDayDot(decidedAt)].filter(
    (part): part is string => part !== null
  );

  return parts.length === 0 ? null : parts.join(' · ');
}

function NavBar({ title, onBack }: { title: string; onBack: () => void }) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.nav}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="뒤로"
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <ProductSymbol name="chevronLeft" size={Layout.iconTab} color={theme.text} />
      </Pressable>
      <ThemedText type="t5" numberOfLines={1} style={styles.navTitle}>
        {title}
      </ThemedText>
      {/* 오른쪽 빈 자리 — 제목이 가운데에 앉게 한다. */}
      <View style={styles.back} />
    </ThemedView>
  );
}

/** 그룹. 시안 grp small — 제목 14/19 700 #868B94, 행 사이 2. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ThemedView style={styles.group}>
      <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
        {title}
      </ThemedText>
      <View style={styles.list}>{children}</View>
    </ThemedView>
  );
}

type RowTone = 'done' | 'now' | 'none';

/**
 * 배지 종류. 시안 badge(k): 완료 ok · 현재 업종 brand · 그 밖 none.
 *
 * 완료가 초록인 것은 이 화면(WP-HOME-009)만이다 — 홈 4칸은 코랄 네 곳 규칙(SPEC §13.13)
 * 때문에 완료를 짙은 회색으로 낮췄고, 여기는 상태색 토큰(status.success «결정 완료»)을 그대로 쓴다.
 */
function badgeKind(tone: RowTone): BadgeKind {
  if (tone === 'done') return 'ok';
  if (tone === 'now') return 'brand';

  return 'none';
}

/**
 * 한 행. 시안 row — 업종 18/24(현재 업종만 700) · 메타 14/19 #868B94 · 배지 · chevron 18.
 *
 * 메타가 있으면 위 정렬 · 상하 14, 없으면 가운데 정렬 · 상하 12. 업종 이름은 시작 전이어도
 * 흐리게 하지 않는다 — 상태는 배지가 말한다.
 */
function Row({
  label,
  meta,
  badge,
  tone,
  onPress,
}: {
  label: string;
  meta: string | null;
  badge: string;
  tone: RowTone;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Fragment>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${badge}${meta === null ? '' : ` ${meta}`}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          meta === null ? styles.rowCentered : styles.rowWithMeta,
          pressed && styles.pressed,
        ]}>
        <View style={styles.rowBody}>
          <ThemedText type="t5" numberOfLines={1} style={tone === 'now' ? styles.bold : styles.regular}>
            {label}
          </ThemedText>
          {meta === null ? null : (
            <ThemedText type="t7" numeric themeColor="textAssistive" numberOfLines={1}>
              {meta}
            </ThemedText>
          )}
        </View>
        <Badge kind={badgeKind(tone)} style={meta === null ? undefined : styles.badgeWithMeta}>
          {badge}
        </Badge>
        <View style={meta === null ? null : styles.chevronWithMeta}>
          <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />
        </View>
      </Pressable>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
    </Fragment>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  /* navBack 56 · padding 0 20 0 12 · gap 8 — component.navBack. 뒤로 40 원형. */
  nav: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Layout.navPaddingLeft,
    paddingRight: Layout.navPaddingRight,
    gap: Layout.navGap,
  },
  back: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { flex: 1, textAlign: 'center' },

  content: { paddingBottom: Spacing.two },
  /* 시안 padHero: padding 12 24 24 · gap 8. */
  hero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    paddingBottom: Layout.gutter,
    gap: Spacing.two,
  },
  /* 시안 padSec: padding 0 24 24 · gap 10. 행 사이 2. */
  group: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four, gap: Layout.cardGap },
  list: { gap: Spacing.half },
  /* 시안 row: gap 12 · min-height 56 · 메타 있으면 위 정렬 · 상하 14, 없으면 가운데 · 상하 12. */
  row: {
    flexDirection: 'row',
    gap: Spacing.three - 4,
    minHeight: Layout.rowMinHeight,
  },
  rowCentered: { alignItems: 'center', paddingVertical: Layout.rowPaddingY },
  rowWithMeta: { alignItems: 'flex-start', paddingVertical: Layout.sectionHeadGap },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  bold: { fontWeight: 700 },
  regular: { fontWeight: 400 },
  /* 시안 badge margin-top 2 · chevron은 첫 줄(18/24) 가운데에 맞춘다. */
  badgeWithMeta: { marginTop: Spacing.half },
  chevronWithMeta: { paddingTop: 3 },
  divider: { height: 1 },
  pressed: { opacity: 0.8 },
});
