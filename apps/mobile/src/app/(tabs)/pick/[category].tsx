import type { CandidateListResponse, VendorCandidate } from '@weddingpick/api-contract';
import {
  TERMS,
  VENDOR_CATEGORY_LABEL,
  withInstrument,
  withParticle,
  type VendorCategory,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  EmptyView,
  ErrorView,
  Layout,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  Skeleton,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  VendorImage,
  readWebInteractionState,
  useTheme,
} from '@weddingpick/ui';
import { getCurrentUser, listCandidates, removeCandidate } from '@/api/client';
import { BackButton } from '@/components/back-button';
import { UnpickSheet } from '@/features/pick/pick-sheets';
import { vendorImageCategory } from '@/features/search/vendor-image-category';

/**
 * 업종별 Pick 목록 · WP-PICK-002. 시안 09-core-loop.dc.html #10c.
 *
 *   nav 56   뒤로 · «스튜디오 Pick» · «편집»
 *   hero     «3곳 중 2곳은 준호님도 골랐어요» + «둘 다 고른 곳부터 비교해보세요»
 *   카드      썸네일 72 · 배지(둘 다 고른 곳 / 나만 Pick) · 이름 18 · 지역 14 · 체크 26 · 메모
 *            둘 다 고른 곳은 coral 1.5px 테두리
 *   dock 92  «N곳 비교하기» 52(tokens size.ctaPrimary) — 체크한 후보 2~3곳
 *
 * 체크는 **비교 후보 선택**이다(SPEC §13.11 — Pick 탭 진입은 그 업종의 내 후보만 · 체크로 2~3곳).
 * 최종 결정은 카드 아래 «최종 결정»으로 WP-PICK-005 시트에 넘긴다 — 결정 자체는 그 시트가 한다.
 * «편집»을 누르면 카드마다 «빼기»가 나오고, 빼기는 WP-SHT-003 시트로 한 번 묻는다.
 */

const MAX_COMPARE = 3;
const MIN_COMPARE = 2;

/** 시안 #10c 카드 썸네일 72 · 체크 26 · 배우자 테두리 1.5. Layout에 이름이 없는 값. */
const CARD_THUMB = 72;
const CHECK_SIZE = 26;
const SHARED_BORDER = 1.5;

/** 문구. spec/strings.ko.json pick.* · 시안 #10c */
const BADGE_SHARED = '둘 다 고른 곳';
const BADGE_MINE = `나만 ${TERMS.pick}`;
const NO_MEMO = '메모 없음';
const DECIDE = '최종 결정';
const REMOVE = '빼기';
const EDIT = '편집';
const EDIT_DONE = '완료';

function CandidateCardSkeleton() {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.track }]}>
      <Skeleton height={19} width="60%" />
      <Skeleton height={16} width="40%" />
      <Skeleton height={14} width="30%" />
    </View>
  );
}

export default function CategoryPickScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [partner, setPartner] = useState<string | null>(null);
  const [group, setGroup] = useState<CandidateListResponse['groups'][number] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** 비교할 후보(vendorId). 시안: 체크 26. */
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState(false);
  const [unpickTarget, setUnpickTarget] = useState<VendorCandidate | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getCurrentUser()
      .then(async (user) => {
        setPartner(user.spouseLinked ? (user.partnerDisplayName ?? TERMS.spouse) : null);
        if (!user.weddingId) {
          setGroup(null);
          setLoaded(true);
          return;
        }
        setWeddingId(user.weddingId);
        const res = await listCandidates(user.weddingId);
        const found = res.groups.find((g) => g.category === category) ?? null;
        setGroup(found);
        setLoaded(true);
      })
      .catch((e: Error) => setError(e.message));
  }, [category]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [load]);

  const categoryLabel =
    category ? (VENDOR_CATEGORY_LABEL[category as VendorCategory] ?? category) : '';

  if (error) {
    return (
      <ErrorView
        title="목록을 불러오지 못했어요"
        message={error}
        onRetry={load}
        retryLabel="다시 시도"
        onBack={() => router.back()}
        backLabel="돌아가기"
      />
    );
  }

  const isDecided = group?.state === 'decided';
  const decidedVendorId = group?.decidedVendorId ?? null;
  const candidates = group?.candidates ?? [];
  const sharedCount = candidates.filter((c) => c.addedByPartner).length;

  function toggleSelect(candidate: VendorCandidate) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(candidate.vendorId)) next.delete(candidate.vendorId);
      else if (next.size < MAX_COMPARE) next.add(candidate.vendorId);
      else setToast(`한 번에 ${MAX_COMPARE}곳까지 비교할 수 있어요`);
      return next;
    });
  }

  /** 최종 결정은 확인 시트(WP-PICK-005)가 한다 — 여기서 먼저 저장하지 않는다. */
  function goDecide(candidate: VendorCandidate) {
    router.push({
      pathname: '/pick/confirm',
      params: {
        category,
        vendorId: candidate.vendorId,
        vendorName: candidate.vendorName,
        shared: candidate.addedByPartner ? '1' : '0',
      },
    });
  }

  async function confirmUnpick() {
    if (!unpickTarget || !weddingId) return;
    setRemoving(true);
    try {
      await removeCandidate(weddingId, unpickTarget.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(unpickTarget.vendorId);
        return next;
      });
      load();
    } catch {
      setToast('후보를 빼지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setRemoving(false);
      setUnpickTarget(null);
    }
  }

  function startCompare() {
    router.push({ pathname: '/search/compare', params: { ids: Array.from(selected).join(',') } });
  }

  const heroTitle = isDecided
    ? `${withParticle(categoryLabel, '은는')}\n결정했어요`
    : partner && sharedCount > 0
      ? `${candidates.length}곳 중 ${sharedCount}곳은\n${partner === TERMS.spouse ? partner : `${partner}님`}도 골랐어요`
      : `후보 ${candidates.length}곳을\n담아뒀어요`;
  const heroSub = isDecided
    ? (decidedVendorName(candidates, decidedVendorId) ?? '웨딩픽 밖에서 이미 정한 업종이에요')
    : sharedCount > 0
      ? '둘 다 고른 곳부터 비교해보세요'
      : candidates.length >= MIN_COMPARE
        ? '두 곳을 골라 비교해보세요'
        : null;

  const canCompare = selected.size >= MIN_COMPARE;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* nav 56 · 뒤로 40 + 제목 18 + «편집» 16 700 */}
        <View style={styles.navBar}>
          <BackButton />
          <ThemedText type="t5" numberOfLines={1} style={styles.navTitle}>
            {categoryLabel} {TERMS.pick}
          </ThemedText>
          {!isDecided && candidates.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={editing ? EDIT_DONE : EDIT}
              hitSlop={Spacing.two}
              onPress={() => setEditing((on) => !on)}
              style={styles.navAction}>
              <ThemedText type="t6" themeColor="textSecondary" style={styles.bold}>
                {editing ? EDIT_DONE : EDIT}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* hero · padding 12 24 24 · gap 8 */}
          {loaded ? (
            <View style={styles.hero}>
              <ThemedText type="t2">{heroTitle}</ThemedText>
              {heroSub ? (
                <ThemedText type="body" themeColor="textSecondary">{heroSub}</ThemedText>
              ) : null}
            </View>
          ) : null}

          <View style={styles.cards}>
            {!loaded ? (
              <>
                <CandidateCardSkeleton />
                <CandidateCardSkeleton />
                <CandidateCardSkeleton />
              </>
            ) : candidates.length === 0 ? (
              <EmptyView
                title="아직 Pick한 곳이 없어요"
                description="마음에 드는 곳을 담아두면 여기서 비교할 수 있어요"
                actionLabel={`${categoryLabel} ${TERMS.search}`}
                onAction={() => router.push({ pathname: '/search', params: { category } })}
              />
            ) : (
              candidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  isDecidedVendor={candidate.vendorId === decidedVendorId}
                  isDecided={isDecided}
                  checked={selected.has(candidate.vendorId)}
                  editing={editing}
                  partner={partner}
                  onToggle={() => toggleSelect(candidate)}
                  onDecide={() => goDecide(candidate)}
                  onRemove={() => setUnpickTarget(candidate)}
                />
              ))
            )}
          </View>
          <View style={styles.bottomPad} />
        </ScrollView>

        {/* dock 92 + safeBottom · «N곳 비교하기» — 체크 2~3곳일 때만 산다 */}
        {!isDecided && candidates.length >= MIN_COMPARE ? (
          <ThemedView
            style={[
              styles.dock,
              {
                borderTopColor: colors.border,
                minHeight: Layout.dock + insets.bottom,
                paddingBottom: Layout.sectionGap + insets.bottom,
              },
            ]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canCompare }}
              disabled={!canCompare}
              onPress={startCompare}
              style={({ pressed }) => [
                styles.dockBtn,
                { backgroundColor: colors.tint, opacity: !canCompare ? 0.4 : pressed ? 0.8 : 1 },
              ]}>
              <ThemedText type="t5" themeColor="onTint">
                {canCompare ? `${selected.size}곳 비교하기` : `${MIN_COMPARE}곳을 골라 비교하기`}
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />
      <UnpickSheet
        candidate={unpickTarget}
        partnerName={partner === TERMS.spouse ? null : partner}
        busy={removing}
        onConfirm={() => void confirmUnpick()}
        onDismiss={() => setUnpickTarget(null)}
      />
    </ThemedView>
  );
}

/** «더채플 강남으로 정했어요». 정한 업체가 후보에 없거나(삭제) 애초에 없으면 null. */
function decidedVendorName(
  candidates: readonly { vendorId: string; vendorName: string }[],
  decidedVendorId: string | null
): string | null {
  if (decidedVendorId === null) return null;

  const name = candidates.find((c) => c.vendorId === decidedVendorId)?.vendorName;

  return name ? `${withInstrument(name)} 정했어요` : null;
}

function CandidateCard({
  candidate,
  isDecidedVendor,
  isDecided,
  checked,
  editing,
  partner,
  onToggle,
  onDecide,
  onRemove,
}: {
  candidate: VendorCandidate;
  isDecidedVendor: boolean;
  isDecided: boolean;
  checked: boolean;
  editing: boolean;
  partner: string | null;
  onToggle: () => void;
  onDecide: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const shared = candidate.addedByPartner;
  const memo = candidate.note
    ? (partner ? `${partner === TERMS.spouse ? partner : `${partner}님`} 메모 · ${candidate.note}` : candidate.note)
    : NO_MEMO;

  return (
    <View
      style={[
        styles.card,
        shared || isDecidedVendor
          ? { borderColor: theme.tint, borderWidth: SHARED_BORDER }
          : { borderColor: theme.track },
      ]}>
      <View style={styles.cardTop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${candidate.vendorName} 상세 보기`}
          onPress={() => router.push(`/search/${candidate.vendorId}`)}
          style={(state) => {
            const { focused } = readWebInteractionState(state);
            return [
              styles.cardMain,
              focused ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: 2 } : null,
            ];
          }}>
          <View style={styles.thumb}>
            <VendorImage
              source={candidate.imageUrl ? { uri: candidate.imageUrl } : undefined}
              category={vendorImageCategory(candidate.category)}
              width={CARD_THUMB}
              height={CARD_THUMB}
              radius={Radius.small}
            />
          </View>
          <View style={styles.cardBody}>
            {/* 배지 §12.3 — 공용 Badge(22 · padding 4 9 · radius 4) */}
            <Badge kind={isDecidedVendor || shared ? 'brand' : 'none'} style={styles.badge}>
              {isDecidedVendor ? '결정' : shared ? BADGE_SHARED : BADGE_MINE}
            </Badge>
            <ThemedText type="t5" numberOfLines={1}>{candidate.vendorName}</ThemedText>
            {/* 후보 목록에는 실 제보 금액이 안 실린다(api-contract candidates.ts) — 지역만 적는다 */}
            <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
              {candidate.region}
            </ThemedText>
          </View>
        </Pressable>

        {/* 체크 26 · radius 6 — 비교 후보 선택 */}
        {!isDecided ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={`${candidate.vendorName} 비교에 넣기`}
            hitSlop={Spacing.two}
            onPress={onToggle}
            style={[
              styles.check,
              checked
                ? { backgroundColor: theme.tint }
                : { borderWidth: SHARED_BORDER, borderColor: theme.track },
            ]}>
            {checked ? <ProductSymbol name="check" size={Layout.iconChipClose} color={theme.onTint} /> : null}
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

      <View style={styles.cardFoot}>
        <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1} style={styles.memo}>
          {memo}
        </ThemedText>
        {!isDecided ? (
          editing ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${candidate.vendorName} ${REMOVE}`} hitSlop={Spacing.two} onPress={onRemove}>
              <ThemedText type="t7" themeColor="negative" style={styles.bold}>{REMOVE}</ThemedText>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel={`${candidate.vendorName} ${DECIDE}`} hitSlop={Spacing.two} onPress={onDecide}>
              <ThemedText type="t7" themeColor="textSecondary" style={styles.bold}>{DECIDE}</ThemedText>
            </Pressable>
          )
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  bold: { fontWeight: 700 },

  /* nav 56 · padding 0 20 0 12 · gap 4 */
  navBar: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingLeft: Layout.navPaddingLeft,
    paddingRight: Layout.navPaddingRight,
  },
  navTitle: { flex: 1, minWidth: 0 },
  navAction: { minHeight: Layout.touchTarget, justifyContent: 'center', paddingLeft: Spacing.two },

  content: { flexGrow: 1 },
  /* hero · padding 12 24 24 · gap 8 */
  hero: {
    paddingTop: Layout.rowPaddingY,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Spacing.two,
  },
  /* 카드 목록 · padding 0 24 · 카드 사이 12 */
  cards: { paddingHorizontal: Layout.gutter, gap: Layout.rowPaddingY },
  bottomPad: { height: Spacing.four },

  /* 카드 · radius 10 · padding 18 · 테두리 1 gray300 (둘 다 고른 곳 1.5 coral) */
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three + Spacing.half,
    borderWidth: 1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Layout.rowPaddingY },
  cardMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: Layout.rowPaddingY },
  thumb: { width: CARD_THUMB, height: CARD_THUMB, borderRadius: Radius.small, overflow: 'hidden' },
  cardBody: { flex: 1, minWidth: 0, gap: Spacing.one },
  badge: { alignSelf: 'flex-start' },
  check: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 시안: hr margin 14 0 12 */
  cardDivider: { height: 1, marginTop: Layout.sectionHeadGap, marginBottom: Layout.rowPaddingY },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  memo: { flex: 1, minWidth: 0 },

  /*
   * dock 92 · border-top 1 · padding 12 24. 높이를 92로 박으면 노치 기기에서 CTA가 홈
   * 인디케이터에 물린다 — `screen-kit`의 Dock처럼 minHeight·paddingBottom에 safeBottom을
   * 더한다(화면이 34 같은 수를 상수로 들지 않는다).
   */
  dock: {
    minHeight: Layout.dock,
    borderTopWidth: 1,
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    paddingBottom: Layout.sectionGap,
  },
  /*
   * 시안 09-core-loop 10c(WP-PICK-002) dock 버튼은 «2곳 비교하기» height 56이다.
   * `size.ctaPick`이 그 값이고, tokens.json이 「업체 상세·비교의 Pick CTA 전용 —
   * Pick하기 · N곳 비교하기」로 적어둔 바로 그 버튼이다. 화면당 Primary CTA는
   * 여전히 하나다.
   */
  dockBtn: {
    height: Layout.ctaPick,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

