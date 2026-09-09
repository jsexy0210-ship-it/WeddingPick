import type { CandidateListResponse, CurrentUser, VendorSummary } from '@weddingpick/api-contract';
import {
  TERMS,
  PREPARATION_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  priceLine,
  withInstrument,
  type VendorCategory,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  ProductSymbol,
  ProgressBar,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  VendorImage,
  readWebInteractionState,
  useTheme,
} from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { getCurrentUser, listCandidates, searchVendors } from '@/api/client';
import { vendorImageCategory } from '@/features/search/vendor-image-category';
import { isWebShellScreen } from '@/features/webshell/config';
import { WebShellView } from '@/features/webshell/WebShellView';

/**
 * Pick 홈 · WP-PICK-001. 시안 05-root #9b · 07-pick #17a · #17b.
 *
 * 카테고리별 진행 상태 + 배우자와 둘 다 고른 곳을 한눈에 보는 화면.
 * 이 화면에서 업체를 결정하지 않는다 — 카테고리 화면으로 들어가서 결정한다.
 *
 * 두 상태:
 *   1. 후보 있음(#17a) — 진행 요약 + 업종 행 4(비교하기 / 결정 완료 / 검색하기) + 둘 다 고른 곳
 *   2. 비어 있음(#17b) — 안내 + 웨딩홀 제안 카드 + 나머지 업종 행(«N곳» + chevron)
 *
 * **지금 좁힐 것 하나만 코랄로 지목한다**(#17a tagDesc). 나머지 행의 행동 라벨은 회색이고,
 * 결정 완료도 초록이 아니라 회색이다(CHANGELOG v3.21 홈 코랄 축소).
 *
 * 문구는 `spec/strings.ko.json` `pick.*`을 따른다. 섹션 제목에 서브카피를 두지 않는다(SPEC §11.2).
 */

/** 화면에 늘어놓는 업종. «기타»는 준비 항목이 아니라 뺀다. */
const PICK_CATEGORIES: readonly VendorCategory[] = PREPARATION_CATEGORIES;

/** 비어 있음 상태가 먼저 제안하는 업종(#17b «웨딩홀부터 볼까요»). */
const STARTER_CATEGORY: VendorCategory = 'hall';
const STARTER_COUNT = 3;

/**
 * 시안 값 중 `Layout`에 이름이 없는 것. 토큰이 생기면 여기만 지운다.
 *
 * - 헤더 아바타 22 — spec/tokens.json `size.avatar`는 26이고 #9b 헤더의 작은 아바타는 22다.
 * - 행 썸네일 52 — spec/tokens.json `size.thumbList`가 아직 `Layout`으로 안 나왔다.
 * - 제안 카드 이미지 96.
 */
const HEADER_AVATAR = 22;
const THUMB_LIST = 52;
const STARTER_IMAGE = 96;

/** 행 안의 행동 라벨. spec/strings.ko.json pick.* · 시안 #17a pickCats */
const ACTION_COMPARE = '비교하기';
const ACTION_SEE = '후보 보기';
const ACTION_DONE = '결정 완료';
const ACTION_SEARCH = `${TERMS.search}하기`;
const SUB_NONE = '후보 없음';

export default function PickScreen() {
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [page, setPage] = useState<CandidateListResponse | null>(null);
  const [starters, setStarters] = useState<VendorSummary[]>([]);
  /** 비어 있음 상태의 업종별 업체 수(#17b «286곳»). 못 읽은 업종은 꼬리 없이 chevron만. */
  const [categoryTotals, setCategoryTotals] = useState<Partial<Record<VendorCategory, number>>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    // 하이브리드 웹뷰 쉘 POC로 이 화면을 대체할 때는 이 밑 자료를 안 쓴다 —
    // 훅 순서를 지키려고 호출 자체는 남기고, 몸통만 건너뛴다.
    if (isWebShellScreen('pick')) return;

    getCurrentUser()
      .then(async (current) => {
        setError(null);
        setMe(current);
        const next = current.weddingId ? await listCandidates(current.weddingId) : null;
        setPage(next);

        // 비어 있을 때만 제안 카드와 업종별 수를 가져온다. 실패해도 화면은 뜬다 —
        // 카드 없이 CTA만, 꼬리 없이 chevron만 남는다.
        if ((next?.total ?? 0) === 0) {
          try {
            const result = await searchVendors({ category: STARTER_CATEGORY });
            setStarters(result.vendors.slice(0, STARTER_COUNT));
          } catch {
            setStarters([]);
          }
          const totals: Partial<Record<VendorCategory, number>> = {};
          await Promise.all(
            PICK_CATEGORIES.filter((cat) => cat !== STARTER_CATEGORY).map((cat) =>
              searchVendors({ category: cat })
                .then((result) => {
                  totals[cat] = result.total;
                })
                .catch(() => undefined)
            )
          );
          setCategoryTotals(totals);
        }
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
  const partner = me?.spouseLinked ? (me.partnerDisplayName ?? TERMS.spouse) : null;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.wrapper, { maxWidth: MaxContentWidth }]}>
          <Header partner={partner} />

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
              <DelayedLoader size={40} />
            </View>
          ) : !me.weddingId || !page || !hasAnyPick ? (
            /* ── 비어 있음 · #17b ── */
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <EmptyHero />
              <StarterSection vendors={starters} />
              <SectionBand />
              <EmptyCategoryList totals={categoryTotals} exclude={STARTER_CATEGORY} />
              <View style={styles.bottomSpacer} />
            </ScrollView>
          ) : (
            /* ── 후보 있음 · #17a ── */
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <ProgressSection page={page} />
              <CategoryList page={page} />
              {sharedCandidates.length > 0 && sharedGroup ? (
                <>
                  <SectionBand />
                  <SharedSection group={sharedGroup} sharedCandidates={sharedCandidates} />
                </>
              ) : null}
              <View style={styles.bottomSpacer} />
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

/* ────────────────────────────────────────────
   Header — 제목 + 배우자 연결 표시
──────────────────────────────────────────── */
function Header({ partner }: { partner: string | null }) {
  const theme = useTheme();

  return (
    <View style={styles.header}>
      <ThemedText type="t4">{TERMS.pick}</ThemedText>
      {partner ? (
        <View style={styles.partnerChip}>
          <View style={[styles.partnerAvatar, { backgroundColor: theme.tintSubtle }]}>
            <ThemedText type="badge" themeColor="tint">
              {partner[0]}
            </ThemedText>
          </View>
          <ThemedText type="t7" themeColor="textSecondary" style={styles.bold}>
            {partnerWith(partner, '함께')}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

/**
 * «준호님과 함께» · «배우자와 함께». 이름을 모르면 «배우자님»이라 부르지 않는다.
 */
function partnerWith(partner: string, tail: string): string {
  return partner === TERMS.spouse ? `${partner}와 ${tail}` : `${partner}님과 ${tail}`;
}

/* ────────────────────────────────────────────
   Progress Section — 진행 요약 · #17a: h26 + 진행바 6 + «1/4 결정»
──────────────────────────────────────────── */
function ProgressSection({ page }: { page: CandidateListResponse }) {
  const { decided, total } = page.progress;
  const ratio = total > 0 ? decided / total : 0;

  return (
    <View style={styles.hero}>
      <ThemedText type="t2">{`${total}개 중 ${decided}개를\n결정했어요`}</ThemedText>
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <ProgressBar value={ratio} height={PROGRESS_HEIGHT} />
        </View>
        <ThemedText type="t7" themeColor="textAssistive" numeric style={styles.bold}>
          {`${decided}/${total} 결정`}
        </ThemedText>
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────
   Category List — 업종별 진행 목록 · #17a pickCats
──────────────────────────────────────────── */
type GroupRow = CandidateListResponse['groups'][number];

type RowState = {
  sub: string;
  action: string;
  /** 후보가 있고 아직 결정 전 — «지금 좁힐 것» 후보. */
  active: boolean;
  onPress: () => void;
};

function rowState(cat: VendorCategory, group: GroupRow | undefined): RowState {
  const n = group?.candidates.length ?? 0;

  if (!group || n === 0) {
    return {
      sub: SUB_NONE,
      action: ACTION_SEARCH,
      active: false,
      onPress: () => router.push({ pathname: '/search', params: { category: cat } }),
    };
  }

  if (group.state === 'decided') {
    const decidedName =
      group.candidates.find((c) => c.vendorId === group.decidedVendorId)?.vendorName ?? '';
    return {
      sub: decidedName ? `${withInstrument(decidedName)} 결정` : ACTION_DONE,
      action: ACTION_DONE,
      active: false,
      onPress: () => router.push({ pathname: '/pick/[category]', params: { category: cat } }),
    };
  }

  const shared = group.candidates.filter((c) => c.addedByPartner).length;
  return {
    sub: shared > 0 ? `후보 ${n}곳 · 둘 다 고른 곳 ${shared}` : `후보 ${n}곳 · 나만 골랐어요`,
    // 한 곳뿐이면 비교를 권하지 않는다(§8) — 후보를 보러 들어가는 말로 바꾼다.
    action: group.comparable ? ACTION_COMPARE : ACTION_SEE,
    active: true,
    onPress: () => router.push({ pathname: '/pick/[category]', params: { category: cat } }),
  };
}

function CategoryList({ page }: { page: CandidateListResponse }) {
  const groupMap = new Map(page.groups.map((g) => [g.category, g]));
  const rows = PICK_CATEGORIES.map((cat) => ({ cat, state: rowState(cat, groupMap.get(cat)) }));
  /* 코랄은 지금 좁힐 것 하나 — 후보가 있고 결정 전인 첫 업종. */
  const focusIndex = rows.findIndex((row) => row.state.active);

  return (
    <View style={styles.categorySection}>
      {rows.map((row, index) => (
        <CategoryRow
          key={row.cat}
          label={VENDOR_CATEGORY_LABEL[row.cat]}
          sub={row.state.sub}
          action={row.state.action}
          tone={index === focusIndex ? 'now' : 'muted'}
          onPress={row.state.onPress}
        />
      ))}
    </View>
  );
}

function CategoryRow({
  label,
  sub,
  action,
  tone,
  onPress,
}: {
  label: string;
  sub: string | null;
  action: string;
  tone: 'now' | 'muted';
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${action}`}
        style={(state) => {
          const { hovered, focused } = readWebInteractionState(state);
          return [
            styles.categoryRow,
            hovered ? { backgroundColor: theme.backgroundSelected } : null,
            focused ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: -2 } : null,
          ];
        }}>
        <View style={styles.categoryInfo}>
          <ThemedText type="t5" numberOfLines={1}>
            {label}
          </ThemedText>
          {sub ? (
            <ThemedText type="t7" themeColor="textAssistive" numeric numberOfLines={1}>
              {sub}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText
          type="t6"
          themeColor={tone === 'now' ? 'tint' : 'textAssistive'}
          style={[styles.bold, styles.nowrap]}>
          {action}
        </ThemedText>
        <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />
      </Pressable>
      <Divider />
    </View>
  );
}

/** 비어 있음(#17b emptyCats) — 이름 · «N곳» · chevron. 누르면 그 업종 검색으로. */
function EmptyCategoryList({
  totals,
  exclude,
}: {
  totals: Partial<Record<VendorCategory, number>>;
  exclude: VendorCategory;
}) {
  const theme = useTheme();
  return (
    <View style={styles.categorySection}>
      {PICK_CATEGORIES.filter((cat) => cat !== exclude).map((cat) => {
        const label = VENDOR_CATEGORY_LABEL[cat];
        const total = totals[cat];
        return (
          <View key={cat}>
            <Pressable
              onPress={() => router.push({ pathname: '/search', params: { category: cat } })}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${TERMS.search}`}
              style={(state) => {
                const { hovered, focused } = readWebInteractionState(state);
                return [
                  styles.categoryRow,
                  hovered ? { backgroundColor: theme.backgroundSelected } : null,
                  focused ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: -2 } : null,
                ];
              }}>
              <ThemedText type="t5" numberOfLines={1} style={styles.categoryInfo}>
                {label}
              </ThemedText>
              {total !== undefined ? (
                <ThemedText type="t6" themeColor="textAssistive" numeric style={styles.nowrap}>
                  {`${total}곳`}
                </ThemedText>
              ) : null}
              <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />
            </Pressable>
            <Divider />
          </View>
        );
      })}
    </View>
  );
}

/* ────────────────────────────────────────────
   Shared Section — 둘 다 고른 곳 · #17a: s20 · 행 52 썸네일 · CTA 52
──────────────────────────────────────────── */
function SharedSection({
  group,
  sharedCandidates,
}: {
  group: GroupRow;
  sharedCandidates: GroupRow['candidates'];
}) {
  const categoryLabel = VENDOR_CATEGORY_LABEL[group.category] ?? group.categoryLabel;
  const totalCount = group.candidates.length;

  /* 비교는 WP-CMP-001 시트에서 후보를 고른 뒤 시작한다(SPEC §13.11 — Pick 탭 진입은 내 후보만). */
  function goCompare() {
    router.push({ pathname: '/pick/compare', params: { category: group.category } });
  }

  return (
    <View style={styles.sharedSection}>
      <ThemedText type="t4">둘 다 고른 곳</ThemedText>
      <View style={styles.list}>
        {sharedCandidates.map((candidate) => (
          <SharedVendorRow key={candidate.id} candidate={candidate} categoryLabel={categoryLabel} />
        ))}
      </View>
      <ActionButton
        variant="primary"
        size="xlarge"
        label={`${categoryLabel} ${totalCount}곳 비교하기`}
        onPress={goCompare}
      />
    </View>
  );
}

function SharedVendorRow({
  candidate,
  categoryLabel,
}: {
  candidate: GroupRow['candidates'][number];
  categoryLabel: string;
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
            source={candidate.imageUrl ? { uri: candidate.imageUrl } : undefined}
            category={vendorImageCategory(candidate.category)}
            width={THUMB_LIST}
            height={THUMB_LIST}
            radius={Radius.small}
          />
        </View>
        <View style={styles.vendorInfo}>
          <ThemedText type="t5" numberOfLines={1}>
            {candidate.vendorName}
          </ThemedText>
          {/* 후보 목록에는 실 제보 건수·금액이 안 실린다(api-contract candidates.ts) — 지역 · 업종만 적는다 */}
          <ThemedText type="t7" themeColor="textAssistive" numeric numberOfLines={1}>
            {`${candidate.region} · ${categoryLabel}`}
          </ThemedText>
        </View>
      </Pressable>
      <Divider />
    </View>
  );
}

/* ────────────────────────────────────────────
   Empty State — 비어 있음 · #17b
──────────────────────────────────────────── */
function EmptyHero() {
  return (
    <View style={styles.emptyHero}>
      <ThemedText type="t2">{'아직 Pick한 곳이\n없어요'}</ThemedText>
      <ThemedText type="body" themeColor="textSecondary">
        마음에 드는 곳을 담아두면 여기서 비교할 수 있어요
      </ThemedText>
    </View>
  );
}

function StarterSection({ vendors }: { vendors: VendorSummary[] }) {
  const label = VENDOR_CATEGORY_LABEL[STARTER_CATEGORY];

  return (
    <View style={styles.starterSection}>
      <ThemedText type="t4">{`${label}부터 볼까요`}</ThemedText>
      {vendors.length > 0 ? (
        <View style={styles.starterGrid}>
          {vendors.map((vendor) => (
            <StarterCard key={vendor.id} vendor={vendor} />
          ))}
        </View>
      ) : null}
      <ActionButton
        variant="primary"
        size="xlarge"
        label={`${label} ${TERMS.search}`}
        onPress={() => router.push({ pathname: '/search', params: { category: STARTER_CATEGORY } })}
      />
    </View>
  );
}

function StarterCard({ vendor }: { vendor: VendorSummary }) {
  const theme = useTheme();
  /* 금액 한 줄 — 검색 · 상세 · 비교와 같은 규칙(priceLine). 0층·1층은 회색. */
  const line = priceLine(vendor.paidPrice, vendor.guidePrice);

  return (
    <Pressable
      onPress={() => router.push(`/search/${vendor.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${vendor.name} 상세 보기`}
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
          source={vendor.imageUrl ? { uri: vendor.imageUrl } : undefined}
          category={vendorImageCategory(vendor.category)}
          height={STARTER_IMAGE}
          radius={Radius.small}
        />
      </View>
      <ThemedText type="t6" numberOfLines={1} style={styles.bold}>
        {vendor.name}
      </ThemedText>
      <ThemedText type="t7" themeColor="textAssistive" numeric numberOfLines={1}>
        {line.text}
      </ThemedText>
    </Pressable>
  );
}

/* ────────────────────────────────────────────
   공통 컴포넌트
──────────────────────────────────────────── */
function SectionBand() {
  const theme = useTheme();
  return <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />;
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
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

/** 시안 track 6. */
const PROGRESS_HEIGHT = 6;

/* ────────────────────────────────────────────
   스타일 — 값은 05-root #9b · 07-pick #17a · #17b
──────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center' },
  wrapper: { flex: 1, width: '100%' },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1 },
  errorBox: { padding: Layout.gutter, gap: Layout.rowPaddingY },
  bottomSpacer: { height: Spacing.five },

  bold: { fontWeight: 700 },
  nowrap: { flexShrink: 0 },

  /* 헤더 56 · padding 0 20 0 24 · 하단선 없음 */
  header: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Layout.gutter,
    paddingRight: Layout.gutter - Spacing.one,
  },
  partnerChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + Spacing.half },
  partnerAvatar: {
    width: HEADER_AVATAR,
    height: HEADER_AVATAR,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 진행 요약 · padding 12 24 26 · gap 12 */
  hero: {
    paddingTop: Layout.rowPaddingY,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.four + Spacing.half,
    gap: Layout.rowPaddingY,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Layout.cardGap },
  progressTrack: { flex: 1 },

  /* 업종 목록 · padding 0 24 28 · 행 gap 12 · padding 14 0 · 행 사이 2 */
  categorySection: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap, gap: Spacing.half },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.rowPaddingY,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Layout.rowPaddingY + Spacing.half,
  },
  categoryInfo: { flex: 1, minWidth: 0, gap: Spacing.half },
  divider: { height: 1 },

  /* 밴드 16 · 아래 28 (위 28은 앞 섹션의 paddingBottom) */
  band: { height: Layout.sectionBand, marginBottom: Layout.sectionGap },

  /* 둘 다 고른 곳 · gap 12 · 행 gap 12 · padding 12 0 */
  sharedSection: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap, gap: Layout.rowPaddingY },
  list: { gap: Spacing.half },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.rowPaddingY,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Layout.rowPaddingY,
  },
  vendorThumb: { width: THUMB_LIST, height: THUMB_LIST, borderRadius: Radius.small, overflow: 'hidden' },
  vendorInfo: { flex: 1, minWidth: 0, gap: Spacing.half + 1 },

  /* 비어 있음 · padding 12 24 26 · gap 10 */
  emptyHero: {
    paddingTop: Layout.rowPaddingY,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.four + Spacing.half,
    gap: Layout.cardGap,
  },

  /* 제안 카드 · 섹션 gap 12 · 아래 28 · 카드 사이 10 · 카드 안 8 · 이미지 96 radius 6 */
  starterSection: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap, gap: Layout.rowPaddingY },
  starterGrid: { flexDirection: 'row', gap: Layout.cardGap },
  starterCard: { flex: 1, minWidth: 0, gap: Spacing.two },
  starterImage: { width: '100%', height: STARTER_IMAGE, borderRadius: Radius.small, overflow: 'hidden' },
});
