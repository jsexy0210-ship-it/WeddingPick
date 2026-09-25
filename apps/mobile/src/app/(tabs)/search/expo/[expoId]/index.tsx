import { daysUntil } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getExpo, type ExpoDetail } from '@/api/client';
import { openExternal } from '@/features/open-external';
import { useDepthBack } from '@/features/navigation/depth-back';
import { Dock, Section, SubScreen } from '@/features/settings/my-kit';
import {
  Border,
  ErrorView,
  Layout,
  ProductSymbol,
  Radius,
  Skeleton,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/** 정본 my.jsx frame-013 문구. */
const S = {
  title: '박람회',
  apply: '주최사 사전등록 열기',
  closed: '종료된 박람회예요',
  items: '이런 게 있어요',
  note: '주최사 공지에서 모아요. 방문 전에 한 번 더 확인해주세요.',
  calendar: '캘린더에 추가',
} as const;

/** 스켈레톤 — 박람회 상세 페이지 뼈대. */
function ExpoDetailSkeleton() {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Skeleton height={19} width="30%" />
      <Skeleton height={35} width="80%" />
      <ThemedView type="backgroundElement" style={styles.card}>
        <Skeleton height={22} width="30%" />
        <Skeleton height={19} width="60%" />
        <Skeleton height={19} width="50%" />
      </ThemedView>
      <ThemedView type="backgroundElement" style={styles.card}>
        <Skeleton height={22} width="20%" />
        <Skeleton height={19} width="70%" />
        <Skeleton height={19} width="55%" />
      </ThemedView>
      <ThemedView type="backgroundElement" style={styles.card}>
        <Skeleton height={22} width="20%" />
        <Skeleton height={19} width="50%" />
      </ThemedView>
    </ScrollView>
  );
}

/**
 * 박람회 상세 · WP-LNG-006 — `docs/design/React_Native/my.jsx` frame-013(박람회 상세).
 *
 *   hero 240 → 제목 24/33 + D-day 18/700 코랄 → 정보 카드(날짜 · 시간 · 장소 · 주최)
 *   → 「이런 게 있어요」(코랄 점 목록) + 주최사 안내 → 하단 «주최사 사전등록 열기».
 *
 * 정본에 없는 요소는 뺐다 — 상태 배지 · 알림 받기 · 박람회 소개 · 출처 줄 · 공식 홈페이지 링크.
 * «캘린더에 추가»는 CLAUDE.md가 예외로 못 박은 달력 외부 연결이라 지우지 않고 안내 아래 한 줄로 둔다.
 * 정본의 «입장» 행과 태그 칩(«사전등록 무료»)은 계약에 값이 없어 그리지 않는다.
 */
export default function ExpoDetailScreen() {
  const depthBack = useDepthBack();
  const theme = useTheme();
  const { expoId } = useLocalSearchParams<{ expoId: string }>();
  const [expo, setExpo] = useState<ExpoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!expoId) return;
    setError(null);
    setExpo(null);
    getExpo(expoId)
      .then(setExpo)
      .catch(() => setError('박람회 정보를 불러오지 못했어요'));
  }, [expoId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (error) {
    return (
      <ErrorView
        title={error}
        onRetry={load}
        retryLabel="다시 시도"
        onBack={depthBack}
        backLabel="돌아가기"
      />
    );
  }

  if (!expo) {
    return (
      <SubScreen title={S.title}>
        <ExpoDetailSkeleton />
      </SubScreen>
    );
  }

  const isClosed = expo.status === 'closed';
  const link = expo.applyUrl ?? expo.officialWebsiteUrl;
  const info = [
    { k: '날짜', v: dateRange(expo.startsAt, expo.endsAt) },
    { k: '시간', v: `${kstTime(expo.startsAt)}~${kstTime(expo.endsAt)}` },
    { k: '장소', v: expo.venue },
    { k: '주최', v: expo.organizer },
  ];

  return (
    <SubScreen
      title={S.title}
      contentStyle={styles.content}
      dock={
        <Dock
          primary={{
            label: isClosed ? S.closed : S.apply,
            icon: isClosed ? undefined : (
              <View style={styles.external}>
                <ProductSymbol name="chevronRight" size={Layout.iconField} color={theme.onTint} />
              </View>
            ),
            disabled: isClosed || !link,
            onPress: () => {
              // 공식 신청 링크 — 앱을 떠나지 않는 In-App Browser로 연다(대표 정정, expo-agent-spec.md).
              if (link) void openExternal(link, { title: expo.title });
            },
          }}
        />
      }>
      {/* 정본 artHero — 너비 100% · 높이 240. */}
      <View style={[styles.hero, { backgroundColor: theme.imagePlaceholder }]}>
        {expo.thumbnailUrl ? (
          <Image source={{ uri: expo.thumbnailUrl }} style={styles.heroImage} resizeMode="cover" accessibilityLabel={expo.title} />
        ) : null}
      </View>

      <Section style={styles.titleSection}>
        <View style={styles.titleRow}>
          <ThemedText type="f24" style={[styles.bold, styles.grow]}>
            {expo.title}
          </ThemedText>
          <ThemedText type="f18" themeColor={isClosed ? 'textDisabled' : 'tint'} numeric style={styles.bold}>
            {dday(expo)}
          </ThemedText>
        </View>
      </Section>

      {/* 정본 expoInfo — listCard 안 52 행 · 키 84(14 muted) · 값 15. */}
      <Section>
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {info.map((row, index) => (
            <View
              key={row.k}
              style={[
                styles.infoRow,
                index < info.length - 1 ? { borderBottomWidth: Border.hairline, borderBottomColor: theme.border } : null,
              ]}>
              <ThemedText type="f14" themeColor="textAssistive" style={styles.infoKey}>
                {row.k}
              </ThemedText>
              <ThemedText type="f15" numeric style={styles.grow}>
                {row.v}
              </ThemedText>
            </View>
          ))}
        </View>
      </Section>

      <Section title={expo.benefits.length > 0 ? S.items : undefined}>
        {expo.benefits.length > 0 ? (
          <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
            {expo.benefits.map((benefit, index) => (
              <View
                key={benefit}
                style={[
                  styles.itemRow,
                  index < expo.benefits.length - 1
                    ? { borderBottomWidth: Border.hairline, borderBottomColor: theme.border }
                    : null,
                ]}>
                <View style={[styles.dot, { backgroundColor: theme.tint }]} />
                <ThemedText type="f15" style={styles.grow}>
                  {benefit}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
        <ThemedText type="f13" themeColor="textAssistive">
          {S.note}
        </ThemedText>
        {/* CLAUDE.md 예외 — 달력 앱으로 넘기는 자리는 지우지 않는다. 정본에 자리가 없어 안내 아래 한 줄로 둔다. */}
        {!isClosed ? (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/search/expo/${expoId}/calendar`)}>
            <ThemedText type="f13" themeColor="tint" style={styles.bold}>
              {S.calendar}
            </ThemedText>
          </Pressable>
        ) : null}
      </Section>
    </SubScreen>
  );
}

/** «2026.09.19(토)~09.20(일)» — 정본 expoInfo 날짜. 시각은 KST로 읽는다. */
function dateRange(startIso: string, endIso: string): string {
  const start = kst(startIso);
  const end = kst(endIso);
  if (!start || !end) return `${startIso}~${endIso}`;
  const pad = (value: number) => String(value).padStart(2, '0');
  const head = `${start.year}.${pad(start.month)}.${pad(start.day)}(${WEEKDAY[start.weekday]})`;
  if (start.year === end.year && start.month === end.month && start.day === end.day) return head;
  return `${head}~${pad(end.month)}.${pad(end.day)}(${WEEKDAY[end.weekday]})`;
}

/** «10:00» — KST 시:분. */
function kstTime(iso: string): string {
  const at = kst(iso);
  if (!at) return '';
  return `${String(at.hour).padStart(2, '0')}:${String(at.minute).padStart(2, '0')}`;
}

function kst(iso: string) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  const at = new Date(time + 9 * 60 * 60 * 1000);
  return {
    year: at.getUTCFullYear(),
    month: at.getUTCMonth() + 1,
    day: at.getUTCDate(),
    weekday: at.getUTCDay(),
    hour: at.getUTCHours(),
    minute: at.getUTCMinutes(),
  };
}

/** 정본 expoDday «D-2» · 진행 중 · 종료. */
function dday(expo: ExpoDetail): string {
  if (expo.status === 'closed') return '종료';
  if (expo.status === 'ongoing') return '진행 중';
  const days = daysUntil(expo.startsAt.slice(0, 10));
  return days <= 0 ? '오늘' : `D-${days}`;
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const;

const styles = StyleSheet.create({
  /* hero가 헤더 바로 아래에 붙는다 — 정본 scroll 위 여백 16은 hero 다음 sec부터다. */
  content: { paddingTop: 0 },
  scrollContent: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  hero: { width: '100%', height: 240, overflow: 'hidden', marginBottom: Spacing.three },
  heroImage: { width: '100%', height: '100%' },
  titleSection: { gap: Spacing.two },
  /* 정본 expoTitleRow — baseline · 사이 12. artTitle 24/33. */
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Layout.inlineGap },
  bold: { fontWeight: 700 },
  grow: { flex: 1, minWidth: 0 },
  card: { borderWidth: Border.hairline, borderRadius: Radius.medium, overflow: 'hidden' },
  /* 정본 kv → LI — 최소 52 · 0 16 · gap 12. */
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
  },
  infoKey: { width: 84 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
  },
  /* 정본 scopeDot 5 코랄. */
  dot: { width: 5, height: 5, borderRadius: Radius.pill },
  /* 정본 icoExternal — 꺾쇠를 -45° 돌려 바깥 화살표로 쓴다. */
  external: { transform: [{ rotate: '-45deg' }] },
});
