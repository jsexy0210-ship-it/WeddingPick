import type { CurrentUser, DecisionListResponse } from '@weddingpick/api-contract';
import { dDay, formatDateDot, PREPARATION_STATE_LABEL } from '@weddingpick/domain';
import { router } from 'expo-router';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAppBootstrap, listDecisions } from '@/api/client';
import {
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
 *   히어로       12개 중 N개를 끝냈어요 + 예식까지 D일
 *   결정 완료    업체명(없으면 «결정 완료») + 결정일 + 완료 배지
 *   진행 중      후보 N곳 · 현재 업종만 코랄 bold + 좁히는 중 배지
 *   아직 시작 전  회색 · 시작 전
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
            <ThemedText type="t2">{`${HOME_TOTAL}개 중 ${decided}개를 끝냈어요`}</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              {weddingDate === null ? '예식일 미정' : dDay(weddingDate).text}
            </ThemedText>
          </ThemedView>

          {done.length === 0 ? null : (
            <Group title="결정 완료">
              {done.map((row) => (
                <Row
                  key={row.category}
                  label={row.label}
                  value={row.decidedName ?? PREPARATION_STATE_LABEL.decided}
                  meta={data.decidedAt[row.category] === undefined ? null : formatDateDot(data.decidedAt[row.category]!)}
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
                  value={`후보 ${row.pickCount}곳`}
                  meta={null}
                  badge="좁히는 중"
                  tone={row.category === data.current ? 'now' : 'going'}
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
                  value="시작 전"
                  meta={null}
                  badge={null}
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

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ThemedView style={styles.group}>
      <ThemedText type="t4">{title}</ThemedText>
      <View style={styles.list}>{children}</View>
    </ThemedView>
  );
}

type RowTone = 'done' | 'now' | 'going' | 'none';

/**
 * 한 행. 업종 · 값 · (결정일) · 배지 · chevron.
 *
 * 현재 업종만 코랄 bold다. 완료는 초록이 아니라 `textSecondary`, 시작 전은 회색.
 */
function Row({
  label,
  value,
  meta,
  badge,
  tone,
  onPress,
}: {
  label: string;
  value: string;
  meta: string | null;
  badge: string | null;
  tone: RowTone;
  onPress: () => void;
}) {
  const theme = useTheme();
  const valueColor =
    tone === 'now' ? 'tint' : tone === 'none' ? 'textDisabled' : tone === 'done' ? 'textSecondary' : 'text';

  return (
    <Fragment>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${value}${badge === null ? '' : ` ${badge}`}`}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <ThemedText
          type="t7"
          themeColor={tone === 'none' ? 'textDisabled' : 'textAssistive'}
          numberOfLines={1}
          style={styles.rowLabel}>
          {label}
        </ThemedText>
        <View style={styles.rowBody}>
          <ThemedText
            type="t6"
            numberOfLines={1}
            themeColor={valueColor}
            style={tone === 'now' ? styles.bold : undefined}>
            {value}
          </ThemedText>
          {meta === null ? null : (
            <ThemedText type="t7" numeric themeColor="textAssistive" numberOfLines={1}>
              {meta}
            </ThemedText>
          )}
        </View>
        {badge === null ? null : (
          <View
            style={[
              styles.badge,
              { backgroundColor: tone === 'done' ? theme.backgroundSelected : theme.backgroundElement },
            ]}>
            <ThemedText
              type="t7"
              numberOfLines={1}
              themeColor={tone === 'done' ? 'textSecondary' : 'text'}
              style={styles.bold}>
              {badge}
            </ThemedText>
          </View>
        )}
        <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />
      </Pressable>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
    </Fragment>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  /* header 56 · 뒤로가기 40 원형 안의 24 아이콘이 거터선에 앉는다. */
  nav: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.gutter - (Layout.iconButton - Layout.iconTab) / 2,
    gap: Spacing.two,
  },
  back: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { flex: 1, textAlign: 'center' },

  content: { paddingBottom: Spacing.six },
  hero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: 14,
    paddingBottom: Layout.sectionGap,
    gap: Spacing.two,
  },
  group: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap, gap: Layout.gap2col },
  list: { gap: Spacing.half },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Layout.rowPaddingY,
  },
  rowLabel: { width: 76 },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  bold: { fontWeight: 700 },
  /* 배지: height 22 · padding 4 9 · radius 4 · 한 줄 nowrap. */
  badge: {
    height: 22,
    paddingHorizontal: 9,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  divider: { height: 1 },
  pressed: { opacity: 0.8 },
});
