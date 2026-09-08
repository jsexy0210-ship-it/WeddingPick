import type { CandidateListResponse, CurrentUser } from '@weddingpick/api-contract';
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  FontSize,
  Layout,
  LineHeight,
  MaxContentWidth,
  ProgressBar,
  Radius,
  ThemedText,
  ThemedView,
  VendorImage,
  readWebInteractionState,
  useTheme,
  Spinner,
} from '@weddingpick/ui';
import { getCurrentUser, listCandidates } from '@/api/client';
import { vendorImageCategory } from '@/features/search/vendor-image-category';
import { isWebShellScreen } from '@/features/webshell/config';
import { WebShellView } from '@/features/webshell/WebShellView';

/**
 * Pick 홈 · WP-PICK-001.
 *
 * 카테고리별 진행 상태 + 배우자와 둘 다 고른 곳을 한눈에 보는 화면.
 * 이 화면에서 업체를 결정하지 않는다 — 카테고리 화면으로 들어가서 결정한다.
 *
 * 두 상태:
 *   1. 후보 있음 — 진행 요약 + 카테고리 목록 + 둘 다 고른 곳
 *   2. 비어 있음 — 안내 + 웨딩홀 제안 카드 + 빈 카테고리 목록
 */
export default function PickScreen() {
  const theme = useTheme();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [page, setPage] = useState<CandidateListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    // 하이브리드 웹뷰 쉘 POC로 이 화면을 대체할 때는 이 밑 자료를 안 쓴다 —
    // 훅 순서를 지키려고 호출 자체는 남기고, 몸통만 건너뛴다.
    if (isWebShellScreen('pick')) return;

    getCurrentUser()
      .then(async (current) => {
        setError(null);
        setMe(current);
        if (!current.weddingId) {
          setPage(null);
          return;
        }
        setPage(await listCandidates(current.weddingId));
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  useEffect(load, [load]);

  // 하이브리드 웹뷰 쉘 POC. `EXPO_PUBLIC_WEBSHELL_SCREENS`에 "pick"이 없으면
  // (기본값) 이 분기는 타지 않고 기존 네이티브 화면 그대로다.
  if (isWebShellScreen('pick')) {
    return <WebShellView path="/pick" />;
  }

  // 배우자와 둘 다 고른 곳: addedByPartner=true인 후보가 있는 첫 번째 그룹
  const sharedGroup = page?.groups.find((g) => g.candidates.some((c) => c.addedByPartner));
  const sharedCandidates = sharedGroup?.candidates.filter((c) => c.addedByPartner) ?? [];

  const hasAnyPick = (page?.total ?? 0) > 0;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.wrapper, { maxWidth: MaxContentWidth }]}>
          {/* ── 헤더 (고정) ── */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <ThemedText style={styles.headerTitle}>Pick</ThemedText>
            {me?.spouseLinked ? (
              <View style={styles.avatars}>
                <View style={[styles.avatar, { backgroundColor: theme.tintSubtle }]}>
                  <ThemedText style={[styles.avatarInitial, { color: theme.tint }]}>
                    {me.displayName?.[0] ?? 'MY'}
                  </ThemedText>
                </View>
                <View style={[styles.avatar, styles.avatarPartner, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText style={[styles.avatarInitial, { color: theme.textSecondary }]}>
                    {me.partnerDisplayName?.[0] ?? '배'}
                  </ThemedText>
                </View>
              </View>
            ) : null}
          </View>

          {/* ── 스크롤 콘텐츠 ── */}
          {error ? (
            <ScrollView contentContainerStyle={styles.scroll}>
              <View style={styles.errorBox}>
                <ThemedText type="t2">불러오지 못했어요</ThemedText>
                <ThemedText type="t6" themeColor="textSecondary">
                  {error}
                </ThemedText>
                <RetryLink onPress={load} />
              </View>
            </ScrollView>
          ) : !me ? (
            <View style={styles.loadingCenter}>
              <Spinner size={40} />
            </View>
          ) : !me.weddingId || !page || !hasAnyPick ? (
            /* ── 비어 있음 상태 ── */
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <EmptyHero />
              <StarterSection />
              <SectionBand />
              <EmptyCategoryList />
            </ScrollView>
          ) : (
            /* ── 후보 있음 상태 ── */
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <ProgressSection page={page} />
              <CategoryList page={page} />
              {sharedCandidates.length > 0 && sharedGroup ? (
                <>
                  <SectionBand />
                  <SharedSection
                    group={sharedGroup}
                    sharedCandidates={sharedCandidates}
                  />
                </>
              ) : null}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

/* ────────────────────────────────────────────
   Progress Section — 진행 요약
──────────────────────────────────────────── */
function ProgressSection({ page }: { page: CandidateListResponse }) {
  const { decided, total } = page.progress;
  const ratio = total > 0 ? decided / total : 0;

  return (
    <View style={styles.progressSection}>
      <ThemedText type="t2">
        {`${total}개 중 ${decided}개를\n결정했어요`}
      </ThemedText>
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <ProgressBar value={ratio} height={6} />
        </View>
        <ThemedText
          style={styles.progressLabel}
          themeColor="textAssistive"
          numeric>
          {`${decided}/${total}`}
        </ThemedText>
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────
   Category List — 카테고리별 진행 목록
──────────────────────────────────────────── */
function CategoryList({ page }: { page: CandidateListResponse }) {
  const groupMap = new Map(page.groups.map((g) => [g.category, g]));

  return (
    <View style={styles.categorySection}>
      {VENDOR_CATEGORIES.map((cat, idx) => (
        <CategoryRow
          key={cat}
          cat={cat}
          group={groupMap.get(cat)}
          isLast={idx === VENDOR_CATEGORIES.length - 1}
        />
      ))}
    </View>
  );
}

function CategoryRow({
  cat,
  group,
  isLast,
}: {
  cat: VendorCategory;
  group: GroupRow | undefined;
  isLast: boolean;
}) {
  const theme = useTheme();
  const label = VENDOR_CATEGORY_LABEL[cat];

  let subText: string;
  let actionText: string;
  let actionColor: string;
  let onPress: () => void;

  if (!group) {
    // 후보 없음
    subText = '후보 없음';
    actionText = '둘러보기';
    actionColor = theme.textAssistive;
    onPress = () => router.push({ pathname: '/search', params: { category: cat } });
  } else if (group.state === 'decided') {
    const decidedName =
      group.candidates.find((c) => c.vendorId === group.decidedVendorId)?.vendorName ?? '';
    subText = decidedName ? `${decidedName}으로 결정` : '결정 완료';
    actionText = '결정 완료';
    actionColor = theme.positive;
    onPress = () =>
      router.push({
        pathname: '/pick/[category]',
        params: { category: cat },
      });
  } else {
    const sharedCount = group.candidates.filter((c) => c.addedByPartner).length;
    const n = group.candidates.length;
    const sharedNote =
      sharedCount > 0 ? ` · 둘 다 고른 곳 ${sharedCount}` : n > 0 ? ' · 나만 골랐어요' : '';
    subText = n > 0 ? `후보 ${n}곳${sharedNote}` : '후보 없음';
    actionText = group.comparable ? '비교하기' : `${n}곳`;
    actionColor = sharedCount > 0 ? theme.tint : theme.textAssistive;
    onPress = () =>
      router.push({
        pathname: '/pick/[category]',
        params: { category: cat },
      });
  }

  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label} 카테고리 보기`}
        style={(state) => {
          const { hovered, focused } = readWebInteractionState(state);
          return [
            styles.categoryRow,
            hovered ? { backgroundColor: theme.backgroundSelected } : null,
            focused ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: -2 } : null,
          ];
        }}>
        <View style={styles.categoryInfo}>
          <ThemedText style={styles.categoryName}>{label}</ThemedText>
          <ThemedText style={styles.categorySub} themeColor="textAssistive">
            {subText}
          </ThemedText>
        </View>
        <ThemedText style={[styles.categoryAction, { color: actionColor }]}>
          {actionText}
        </ThemedText>
        <ChevronRight color={theme.textDisabled} />
      </Pressable>
      {!isLast ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
    </View>
  );
}

/* ────────────────────────────────────────────
   Shared Section — 둘 다 고른 곳
──────────────────────────────────────────── */
type GroupRow = CandidateListResponse['groups'][number];

function SharedSection({
  group,
  sharedCandidates,
}: {
  group: GroupRow;
  sharedCandidates: GroupRow['candidates'];
}) {
  const theme = useTheme();
  const categoryLabel = VENDOR_CATEGORY_LABEL[group.category as VendorCategory] ?? group.categoryLabel;
  const totalCount = group.candidates.length;

  function goCompare() {
    router.push({
      pathname: '/pick/[category]',
      params: { category: group.category },
    });
  }

  return (
    <View style={styles.sharedSection}>
      <ThemedText style={styles.sectionTitle}>둘 다 고른 곳</ThemedText>
      <View>
        {sharedCandidates.map((candidate, idx) => (
          <SharedVendorRow
            key={candidate.id}
            candidate={candidate}
            category={group.category as VendorCategory}
            isLast={idx === sharedCandidates.length - 1}
          />
        ))}
      </View>
      <Pressable
        onPress={goCompare}
        accessibilityRole="button"
        style={(state) => {
          const { hovered, focused } = readWebInteractionState(state);
          return [
            styles.ctaPrimary,
            { backgroundColor: theme.tint, opacity: hovered ? 0.9 : 1 },
            focused ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: 2 } : null,
          ];
        }}>
        <ThemedText style={[styles.ctaLabel, { color: theme.onTint }]}>
          {`${categoryLabel} ${totalCount}곳 비교`}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function SharedVendorRow({
  candidate,
  category,
  isLast,
}: {
  candidate: GroupRow['candidates'][number];
  category: VendorCategory;
  isLast: boolean;
}) {
  const theme = useTheme();

  return (
    <View>
      <Pressable
        onPress={() => router.push(`/search/${candidate.vendorId}`)}
        accessibilityRole="button"
        accessibilityLabel={`${candidate.vendorName} 상세 보기`}
        style={(state) => {
          const { hovered, focused } = readWebInteractionState(state);
          return [
            styles.vendorRow,
            hovered ? { backgroundColor: theme.backgroundSelected } : null,
            focused ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: -2 } : null,
          ];
        }}>
        <View style={styles.vendorThumb}>
          <VendorImage
            category={vendorImageCategory(category)}
            width={52}
            height={52}
            radius={Radius.small}
          />
        </View>
        <View style={styles.vendorInfo}>
          <ThemedText style={styles.vendorName} numberOfLines={1}>
            {candidate.vendorName}
          </ThemedText>
          <ThemedText style={styles.vendorMeta} themeColor="textAssistive" numberOfLines={1}>
            {candidate.region}
          </ThemedText>
        </View>
      </Pressable>
      {!isLast ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
    </View>
  );
}

/* ────────────────────────────────────────────
   Empty State — 비어 있음
──────────────────────────────────────────── */
function EmptyHero() {
  return (
    <View style={styles.emptyHero}>
      <ThemedText type="t2">{'아직 Pick한 곳이\n없어요'}</ThemedText>
      <ThemedText style={styles.emptySubtitle} themeColor="textSecondary">
        마음에 드는 곳을 담아두면 여기서 비교할 수 있어요
      </ThemedText>
    </View>
  );
}

function StarterSection() {
  const theme = useTheme();
  // 웨딩홀 카테고리 기준으로 빠른 진입 제안
  const starters: VendorCategory[] = ['hall', 'sdm', 'snap'];

  return (
    <View style={styles.starterSection}>
      <ThemedText style={styles.sectionTitle}>웨딩홀부터 볼까요</ThemedText>
      <View style={styles.starterGrid}>
        {starters.map((cat) => (
          <StarterCard key={cat} cat={cat} />
        ))}
      </View>
      <Pressable
        onPress={() => router.push({ pathname: '/search', params: { category: 'hall' } })}
        accessibilityRole="button"
        style={(state) => {
          const { hovered, focused } = readWebInteractionState(state);
          return [
            styles.ctaPrimary,
            { backgroundColor: theme.tint, opacity: hovered ? 0.9 : 1 },
            focused ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: 2 } : null,
          ];
        }}>
        <ThemedText style={[styles.ctaLabel, { color: theme.onTint }]}>
          웨딩홀 둘러보기
        </ThemedText>
      </Pressable>
    </View>
  );
}

function StarterCard({ cat }: { cat: VendorCategory }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/search', params: { category: cat } })}
      accessibilityRole="button"
      accessibilityLabel={`${VENDOR_CATEGORY_LABEL[cat]} 검색`}
      style={(state) => {
        const { hovered, focused } = readWebInteractionState(state);
        return [
          styles.starterCard,
          hovered ? { opacity: 0.85 } : null,
          focused ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: 2 } : null,
        ];
      }}>
      <View style={styles.starterImage}>
        <VendorImage
          category={vendorImageCategory(cat)}
          width={undefined}
          height={96}
          radius={Radius.small}
        />
      </View>
      <ThemedText style={styles.starterName} numberOfLines={1}>
        {VENDOR_CATEGORY_LABEL[cat]}
      </ThemedText>
    </Pressable>
  );
}

function EmptyCategoryList() {
  return (
    <View style={styles.categorySection}>
      {VENDOR_CATEGORIES.map((cat, idx) => (
        <EmptyCategoryRow key={cat} cat={cat} isLast={idx === VENDOR_CATEGORIES.length - 1} />
      ))}
    </View>
  );
}

function EmptyCategoryRow({ cat, isLast }: { cat: VendorCategory; isLast: boolean }) {
  const theme = useTheme();

  return (
    <View>
      <Pressable
        onPress={() => router.push({ pathname: '/search', params: { category: cat } })}
        accessibilityRole="button"
        accessibilityLabel={`${VENDOR_CATEGORY_LABEL[cat]} 검색`}
        style={(state) => {
          const { hovered, focused } = readWebInteractionState(state);
          return [
            styles.categoryRow,
            hovered ? { backgroundColor: theme.backgroundSelected } : null,
            focused ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: -2 } : null,
          ];
        }}>
        <ThemedText style={[styles.categoryName, { flex: 1 }]}>
          {VENDOR_CATEGORY_LABEL[cat]}
        </ThemedText>
        <ThemedText style={styles.categorySub} themeColor="textAssistive">
          후보 없음
        </ThemedText>
        <ChevronRight color={theme.textDisabled} />
      </Pressable>
      {!isLast ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
    </View>
  );
}

/* ────────────────────────────────────────────
   공통 컴포넌트
──────────────────────────────────────────── */
function SectionBand() {
  const theme = useTheme();
  return (
    <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
  );
}

function RetryLink({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={(state) => {
        const { focused } = readWebInteractionState(state);
        return focused
          ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: 2 }
          : null;
      }}>
      {(state) => {
        const { hovered } = readWebInteractionState(state);
        return (
          <ThemedText type="t6" style={{ color: theme.tint, textDecorationLine: hovered ? 'underline' : 'none' }}>
            다시 시도
          </ThemedText>
        );
      }}
    </Pressable>
  );
}

function ChevronRight({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="m9 6 6 6-6 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ────────────────────────────────────────────
   스타일
──────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center' },
  wrapper: { flex: 1, width: '100%' },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1 },
  errorBox: { padding: Layout.gutter, gap: 12 },

  /* 헤더 */
  header: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
  },
  headerTitle: { fontSize: FontSize.t4, lineHeight: LineHeight.t4, fontWeight: '700' },
  avatars: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPartner: { marginLeft: -10 },
  avatarInitial: { fontSize: FontSize.badge, fontWeight: '700' },

  /* 진행 요약 */
  progressSection: {
    paddingTop: 12,
    paddingHorizontal: Layout.gutter,
    paddingBottom: 26,
    gap: 12,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1 },
  progressLabel: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, fontWeight: '700' },

  /* 카테고리 목록 */
  categorySection: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionGap,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: Layout.rowMinHeight,
    paddingVertical: 14,
  },
  categoryInfo: { flex: 1, minWidth: 0, gap: 2 },
  categoryName: { fontSize: FontSize.t5, lineHeight: LineHeight.t5, fontWeight: '700' },
  categorySub: { fontSize: FontSize.t7, lineHeight: LineHeight.t7 },
  categoryAction: {
    fontSize: FontSize.t6,
    lineHeight: LineHeight.t6,
    fontWeight: '700',
    flexShrink: 0,
  },
  divider: { height: 1 },

  /* 밴드 */
  band: { height: Layout.sectionBand, marginBottom: Layout.sectionGap },

  /* 둘 다 고른 곳 */
  sharedSection: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionGap,
    gap: 12,
  },
  sectionTitle: { fontSize: FontSize.t4, lineHeight: LineHeight.t4, fontWeight: '700' },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: Layout.rowMinHeight,
    paddingVertical: 12,
  },
  vendorThumb: { width: 52, height: 52, borderRadius: Radius.small, overflow: 'hidden' },
  vendorInfo: { flex: 1, minWidth: 0, gap: 3 },
  vendorName: { fontSize: FontSize.t5, lineHeight: LineHeight.t5, fontWeight: '700' },
  vendorMeta: { fontSize: FontSize.t7, lineHeight: LineHeight.t7 },

  /* CTA */
  ctaPrimary: {
    height: Layout.controlXLarge,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { fontSize: FontSize.t5, lineHeight: LineHeight.t5, fontWeight: '700' },

  /* 빈 상태 */
  emptyHero: {
    paddingTop: 12,
    paddingHorizontal: Layout.gutter,
    paddingBottom: 26,
    gap: 10,
  },
  emptySubtitle: { fontSize: FontSize.t6, lineHeight: FontSize.t6 * 1.5 },

  /* 스타터 섹션 */
  starterSection: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionGap,
    gap: 12,
  },
  starterGrid: { flexDirection: 'row', gap: 10 },
  starterCard: { flex: 1, minWidth: 0, gap: 8 },
  starterImage: { width: '100%', height: 96, borderRadius: Radius.small, overflow: 'hidden' },
  starterName: { fontSize: FontSize.t6, lineHeight: LineHeight.t6, fontWeight: '700' },
});
