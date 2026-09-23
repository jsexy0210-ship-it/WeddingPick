/**
 * Pick — Pick한 업체 목록. WP-PICK-001.
 *
 * 피그마 `Pick.tsx`(2026-09-14 정본 · 최상위 규칙 1)대로 그린다. 헤더(«Pick» + «N곳» 회색 텍스트
 * + 부제 + 배우자 함께-보기 상자) → 비교 배너(2곳 이상 고르면) → 업종 칩 → 카드 목록.
 * 카드는 검색 결과와 같은 틀(썸네일 104×116 · 정보 안쪽 14)이고 아래에 CTA 띠가 붙는다.
 *
 * 그 앞에는 루트 시안 07-pick #17a의 «13개 중 N개를 결정했어요» 진행바 + 업종별 행 목록이
 * 있었다. 피그마가 그 자리를 이긴다 — 업종별 후보 화면(`/pick/[category]`)은 그대로 있고
 * 업종 칩이 그 역할(업종으로 걸러 보기)을 이 화면 안에서 한다.
 *
 * **피그마를 그대로 옮기지 않은 것.**
 * - 카드의 해시태그 · 별점 · 인기 수 · 금액은 서버가 후보에 주지 않는다
 *   (`vendorCandidateSchema`) — 만들어 넣지 않는다. 그 자리에는 후보 메모(`note`)가 있으면 적는다.
 * - 배지 «인기 · 신규»는 우리 값이 없다. 같은 자리에 **«함께»**(배우자도 고른 곳)를 세운다.
 * - «Pick하기»는 우리 말로 **«결정하기»**다 — 이 화면의 카드는 이미 Pick한 곳이고,
 *   용어집이 Pick을 후보 담기 행동으로 정해 두었다. 결정은 확인 시트(`/pick/confirm`)가 한다.
 * - 결정한 카드의 «상담하기»는 만들지 않는다 — 이용약관 제3조, 고지 후 구현 대기.
 *   «상담취소» 자리는 «결정 취소»이고 한 번 더 묻는다(위험한 조작).
 * - 검색 Root 제목은 2026-09-20 전달 정본의 «업체 탐색»을 쓴다.
 */
import type { CandidateListResponse, CurrentUser, VendorCandidate } from '@weddingpick/api-contract';
import {
  TERMS,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@weddingpick/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  Border,
  Layout,
  LetterSpacing,
  LineHeight,
  MARK_HEART_PATH,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  RatingStars,
  Spacing,
  ThemedText,
  ThemedView,
  VendorImage,
  readWebInteractionState,
  useTheme,
} from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import {
  addCandidate,
  decideCategory,
  getCurrentUser,
  listCandidates,
  removeCandidate,
  removeDecision,
} from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import { DialogToast } from '@/components/confirm-alert-toast';
import {
  PICK_COMPARE_ADD_LABEL,
  PICK_COMPARE_BANNER_HINT,
  PICK_COMPARE_MAX,
  PICK_COMPARE_REMOVE_LABEL,
  PICK_SUBTITLE,
  PICK_VERIFY_LABEL,
  compareBasketLabel,
  pickCountLabel,
} from '@/features/pick/canonical-rules';
import { PickSectionTabs, type PickSection } from '@/features/pick/pick-section-tabs';
import { vendorImageCategory } from '@/features/search/vendor-image-category';
import { isWebShellScreen } from '@/features/webshell/config';
import { WebShellView } from '@/features/webshell/WebShellView';
import { RecommendationsContent } from '../(home)/recommendations';

/* 문구 — spec/strings.ko.json `pick`. 피그마 `Pick.tsx`에서 왔다. */
const SUBTITLE = PICK_SUBTITLE;
const PRICE_REPORT = PICK_VERIFY_LABEL;
const COMPARE_HINT = PICK_COMPARE_BANNER_HINT;
const COMPARE_ALL = '비교하기';
const CHIP_ALL = '전체';
const ACTION_COMPARE = PICK_COMPARE_ADD_LABEL;
const ACTION_COMPARING = PICK_COMPARE_REMOVE_LABEL;
const ACTION_DECIDE = '결정하기';
const ACTION_UNDECIDE = '결정 취소';
const BADGE_SHARED = '함께';
const EMPTY_TITLE = '아직 Pick한 업체가 없어요';
const EMPTY_BODY = '검색에서 마음에 드는 업체를 Pick해보세요';
const EMPTY_CTA = `업체 ${TERMS.search}하기`;
const UNDECIDE_TITLE = '결정을 취소할까요?';
const UNDECIDE_BODY = '웨딩노트의 결정 상태가 풀려요. 언제든 다시 결정할 수 있어요.';
const MIN_COMPARE = 2;

type Filter = VendorCategory | 'all';

type Row = {
  candidate: VendorCandidate;
  /** 이 업종이 결정됐는가. */
  groupDecided: boolean;
  /** 이 후보가 그 결정인가. */
  isDecided: boolean;
};

type UndoCandidate = {
  candidate: VendorCandidate;
  /** 후보 삭제의 FK cascade로 같이 풀린 최종 결정을 되살려야 하는가. */
  wasDecided: boolean;
};

export default function PickScreen() {
  const { section: sectionParam, category: categoryParam } = useLocalSearchParams<{
    section?: string | string[];
    category?: string | string[];
  }>();
  const requestedSection = Array.isArray(sectionParam) ? sectionParam[0] : sectionParam;
  const rawCategory = Array.isArray(categoryParam) ? categoryParam[0] : categoryParam;
  const requestedCategory =
    rawCategory && VENDOR_CATEGORIES.includes(rawCategory as VendorCategory)
      ? (rawCategory as VendorCategory)
      : null;
  const section: PickSection =
    requestedSection === 'recommendations' || requestedSection === 'compare' ? requestedSection : 'pick';
  const theme = useTheme();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [page, setPage] = useState<CandidateListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  /** 비교함에 담은 업체(vendorId). 최대 PICK_COMPARE_MAX. */
  const [compare, setCompare] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [undoCandidate, setUndoCandidate] = useState<UndoCandidate | null>(null);

  const load = useCallback(() => {
    // 하이브리드 웹뷰 쉘 POC로 이 화면을 대체할 때는 이 밑 자료를 안 쓴다 —
    // 훅 순서를 지키려고 호출 자체는 남기고, 몸통만 건너뛴다.
    if (isWebShellScreen('pick')) return;

    getCurrentUser()
      .then(async (current) => {
        setError(null);
        setMe(current);
        setPage(current.weddingId ? await listCandidates(current.weddingId) : null);
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  /* 결정 시트에서 돌아오면 목록이 바뀌어 있다 — 화면에 올 때마다 다시 읽는다. */
  useFocusEffect(load);

  // 하이브리드 웹뷰 쉘 POC. `EXPO_PUBLIC_WEBSHELL_SCREENS`에 "pick"이 없으면
  // (기본값) 이 분기는 타지 않고 기존 네이티브 화면 그대로다.
  if (isWebShellScreen('pick')) {
    return <WebShellView path="/pick" />;
  }

  const rows: Row[] = (page?.groups ?? []).flatMap((group) =>
    group.candidates.map((candidate) => ({
      candidate,
      groupDecided: group.state === 'decided',
      isDecided: group.decidedVendorId === candidate.vendorId,
    }))
  );
  /* 칩은 후보가 있는 업종만, 그룹 순서대로(피그마 `categories` — Pick 목록에서 뽑는다). */
  const categories = (page?.groups ?? [])
    .filter((group) => group.candidates.length > 0)
    .map((group) => group.category);
  const visible = filter === 'all' ? rows : rows.filter((row) => row.candidate.category === filter);
  const partner = me?.spouseLinked ? (me.partnerDisplayName ?? TERMS.spouse) : null;
  const weddingId = me?.weddingId ?? null;

  function showToast(message: string, undo: UndoCandidate | null = null) {
    setUndoCandidate(undo);
    setToast(message);
  }

  function toggleCompare(vendorId: string) {
    setCompare((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else if (next.size < PICK_COMPARE_MAX) next.add(vendorId);
      else showToast(`한 번에 ${PICK_COMPARE_MAX}곳까지 비교할 수 있어요`);
      return next;
    });
  }

  function startCompare() {
    router.push({ pathname: '/search/compare', params: { ids: Array.from(compare).join(',') } });
  }

  /** 최종 결정은 확인 시트(WP-PICK-005)가 한다 — 여기서 먼저 결정 기록을 만들지 않는다. */
  function goDecide(candidate: VendorCandidate) {
    router.push({
      pathname: '/pick/confirm',
      params: {
        category: candidate.category,
        vendorId: candidate.vendorId,
        vendorName: candidate.vendorName,
        shared: candidate.addedByPartner ? '1' : '0',
      },
    });
  }

  /** 결정 취소는 되돌릴 수 있는 조작이라 DLG-B 확인을 쓴다. */
  function askUndecide(candidate: VendorCandidate) {
    confirmAlert(UNDECIDE_TITLE, UNDECIDE_BODY, [
      { text: '그대로 둘게요', style: 'cancel' },
      { text: ACTION_UNDECIDE, onPress: () => undecide(candidate.category) },
    ]);
  }

  async function undecide(category: VendorCategory) {
    if (!weddingId) return;
    setBusy(true);
    try {
      await removeDecision(weddingId, category);
      showToast('결정을 취소했어요');
      load();
    } catch {
      showToast('결정을 취소하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  function askUnpick(row: Row) {
    const { candidate, isDecided } = row;
    const who = partner && partner !== TERMS.spouse ? `${partner}님` : TERMS.spouse;
    const impacts = [
      isDecided ? '최종 결정도 함께 취소돼요.' : null,
      candidate.addedByPartner ? `${who} 목록에서도 함께 사라져요.` : null,
      '다시 Pick할 수 있어요.',
    ].filter(Boolean);

    confirmAlert('후보에서 뺄까요?', impacts.join(' '), [
      { text: '그대로 둘게요', style: 'cancel' },
      { text: '빼기', onPress: () => confirmUnpick(candidate, isDecided) },
    ]);
  }

  async function confirmUnpick(candidate: VendorCandidate, wasDecided: boolean) {
    if (!weddingId) return;
    setBusy(true);
    try {
      await removeCandidate(weddingId, candidate.id);
      setCompare((prev) => {
        const next = new Set(prev);
        next.delete(candidate.vendorId);
        return next;
      });
      showToast('후보에서 뺐어요', { candidate, wasDecided });
      load();
    } catch {
      showToast('후보를 빼지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  async function undoUnpick(target: UndoCandidate) {
    if (!weddingId) return;
    const { candidate, wasDecided } = target;
    let candidateRestored = false;
    setBusy(true);
    try {
      await addCandidate(weddingId, candidate.vendorId, candidate.note ?? undefined);
      candidateRestored = true;
      if (wasDecided) {
        await decideCategory(weddingId, {
          category: candidate.category,
          vendorId: candidate.vendorId,
        });
      }
      showToast(wasDecided ? 'Pick과 결정을 되돌렸어요' : '다시 Pick했어요');
    } catch {
      showToast(
        candidateRestored && wasDecided
          ? '다시 Pick했지만 결정을 복구하지 못했어요.'
          : '다시 Pick하지 못했어요. 잠시 후 다시 시도해주세요.'
      );
    } finally {
      load();
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.wrapper, { maxWidth: MaxContentWidth }]}>
          <PickSectionTabs active={section} />
          {section === 'recommendations' ? (
            <RecommendationsContent requestedCategory={requestedCategory} />
          ) : error ? (
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
          ) : section === 'compare' ? (
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <CompareBasket
                rows={rows.filter((row) => compare.has(row.candidate.vendorId))}
                onRemove={(vendorId) => toggleCompare(vendorId)}
                onCompare={startCompare}
                onOpenPick={() => router.replace('/pick')}
              />
              <View style={styles.bottomSpacer} />
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <Header me={me} partner={partner} total={page?.total ?? 0} />

              {/* 비교 배너 — 피그마 `compareIds.length >= 2`: 잉크 면 · radius 16 · 안쪽 16/14. */}
              {compare.size >= MIN_COMPARE ? (
                <View style={[styles.compareBanner, { backgroundColor: theme.tintSurface, borderColor: theme.tintBorder }]}>
                  <View style={styles.compareText}>
                    <ThemedText type="t7" themeColor="tint" style={styles.bold}>
                      {compareBasketLabel(compare.size)}
                    </ThemedText>
                    <View style={styles.compareHint}>
                      <ThemedText type="micro" themeColor="textSecondary" style={styles.regular}>
                        {COMPARE_HINT}
                      </ThemedText>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={COMPARE_ALL}
                    onPress={startCompare}
                    style={({ pressed }) => [
                      styles.compareBtn,
                      { backgroundColor: theme.tint },
                      pressed ? styles.pressed : null,
                    ]}>
                    <ThemedText type="t7" style={[styles.bold, { color: theme.onTint }]}>
                      {COMPARE_ALL}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}

              {rows.length === 0 ? (
                <Empty />
              ) : (
                <>
                  {/* 업종 칩 — 피그마 `px-4 py-2.5 rounded-full text-sm font-semibold`: 40 · 좌우 16. */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                    contentContainerStyle={styles.chipRow}>
                    <CategoryChip label={CHIP_ALL} active={filter === 'all'} onPress={() => setFilter('all')} />
                    {categories.map((category) => (
                      <CategoryChip
                        key={category}
                        label={VENDOR_CATEGORY_LABEL[category]}
                        active={filter === category}
                        onPress={() => setFilter(category)}
                      />
                    ))}
                  </ScrollView>

                  <View style={styles.list}>
                    {visible.map((row) => (
                      <CandidateCard
                        key={row.candidate.id}
                        row={row}
                        comparing={compare.has(row.candidate.vendorId)}
                        compareFull={compare.size >= PICK_COMPARE_MAX}
                        busy={busy}
                        onCompare={() => toggleCompare(row.candidate.vendorId)}
                        onDecide={() => goDecide(row.candidate)}
                        onUndecide={() => askUndecide(row.candidate)}
                        onRemove={() => askUnpick(row)}
                      />
                    ))}
                  </View>
                </>
              )}
              <View style={styles.bottomSpacer} />
            </ScrollView>
          )}
        </View>
      </SafeAreaView>

      <DialogToast
        message={toast}
        docked
        actionLabel={undoCandidate ? '되돌리기' : null}
        onAction={undoCandidate ? () => void undoUnpick(undoCandidate) : null}
        onHidden={() => {
          setToast(null);
          setUndoCandidate(null);
        }}
      />
    </ThemedView>
  );
}

/* ────────────────────────────────────────────
   Header — 피그마 `px-5 pb-5 pt-6`: 제목 24/700 + «N곳» 배지 · 부제 14 ·
   배우자 상자(radius 16 · 회색 면 · 안쪽 16/12 · 아바타 32 둘 · «Pick 인증»)
──────────────────────────────────────────── */
function Header({ me, partner, total }: { me: CurrentUser; partner: string | null; total: number }) {
  const theme = useTheme();

  return (
    <View style={styles.head}>
      <View style={styles.titleRow}>
        {/* 규격서: «Pick» 24/700 lh 32 ls -0.6 · 배지 12/700 흰 글자 lh 16 pad 4 12 · 부제 14/400 #868B94 lh 20. */}
        <ThemedText type="f26" style={[styles.bold, styles.title]}>
          {TERMS.pick}
        </ThemedText>
        <ThemedText type="f14" themeColor="textAssistive" style={styles.bold}>
          {pickCountLabel(total)}
        </ThemedText>
      </View>
      <View style={styles.headBody}>
        <ThemedText type="f14" themeColor="textAssistive">
          {SUBTITLE}
        </ThemedText>

        {/*
          함께-보기 상자는 배우자가 연결됐을 때만 선다 — 피그마의 «준혁님과 함께 보고 있어요»는
          배우자가 있는 시안값이다. «Pick 인증»는 업체 무관 전역 진입이라 Pick 인증 동의 화면으로
          바로 보낸다(폐기된 별도 제보 화면을 거치지 않는다).
        */}
        {partner ? (
          <View style={[styles.partnerBox, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.partnerLeft}>
              <View style={styles.avatars}>
                <Avatar initial={me.displayName?.[0] ?? null} background={theme.text} ring={theme.backgroundElement} />
                <Avatar
                  initial={partner[0] ?? null}
                  background={theme.textAssistive}
                  ring={theme.backgroundElement}
                  overlap
                />
              </View>
              {/* 규격서: «12/600 #1A1C20 · lh 16». */}
              <ThemedText type="f12" numberOfLines={1} style={[styles.semibold, styles.partnerText]}>
                {partnerWith(partner, '함께 보고 있어요')}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => router.push('/capture/payment/consent?from=pick')}
              accessibilityRole="button"
              accessibilityLabel={PICK_VERIFY_LABEL}
              style={(state) => {
                const { hovered, focused } = readWebInteractionState(state);
                return [
                  styles.priceReportLink,
                  hovered ? { opacity: 0.8 } : null,
                  focused
                    ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: 2 }
                    : null,
                ];
              }}>
              <ProductSymbol name="link" size={Layout.iconSmall} color={theme.tint} />
              {/* 규격서: «Pick 인증» 12/700 키 컬러 lh 16 · 고리 14. */}
              <ThemedText type="f12" themeColor="tint" style={styles.bold}>
                {PRICE_REPORT}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** 이름 첫 글자 원 32 — 피그마 `h-8 w-8 rounded-full ring-2 ring-secondary`, 둘째는 -8 겹침. */
function Avatar({
  initial,
  background,
  ring,
  overlap = false,
}: {
  initial: string | null;
  background: string;
  ring: string;
  overlap?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.avatar, { backgroundColor: background, borderColor: ring }, overlap ? styles.avatarOverlap : null]}>
      {initial ? (
        /* 규격서: 아바타 글자 «11/700 #FFFFFF · lh 17». */
        <ThemedText type="f11" style={[styles.bold, { color: theme.onInk }]}>
          {initial}
        </ThemedText>
      ) : (
        /* 이름을 아직 안 정했으면 빈 원 대신 사람 기호. */
        <ProductSymbol name="person" size={Layout.iconField} color={theme.onInk} />
      )}
    </View>
  );
}

/**
 * «준호님과 함께 보고 있어요» · «배우자와 함께 보고 있어요». 이름을 모르면 «배우자님»이라
 * 부르지 않는다.
 */
function partnerWith(partner: string, tail: string): string {
  return partner === TERMS.spouse ? `${partner}와 ${tail}` : `${partner}님과 ${tail}`;
}

/* ────────────────────────────────────────────
   업종 칩 — 켬은 잉크 채움 · 흰 글자, 끔은 회색 면 · 보조색 글자
──────────────────────────────────────────── */
function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? theme.text : theme.backgroundElement },
        pressed ? styles.pressed : null,
      ]}>
      {/* 규격서: 칩 «14/600 · lh 20 · pad 10 16». */}
      <ThemedText type="f14" numberOfLines={1} style={[styles.semibold, { color: active ? theme.onInk : theme.textAssistive }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/* ────────────────────────────────────────────
   카드 — 검색 결과 카드와 같은 틀 + 아래 CTA 띠(border-top · 안쪽 12/10 · 단추 40 · radius 22)
──────────────────────────────────────────── */
function CandidateCard({
  row,
  comparing,
  compareFull,
  busy,
  onCompare,
  onDecide,
  onUndecide,
  onRemove,
}: {
  row: Row;
  comparing: boolean;
  compareFull: boolean;
  busy: boolean;
  onCompare: () => void;
  onDecide: () => void;
  onUndecide: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const { candidate, groupDecided, isDecided } = row;
  const compareDisabled = !comparing && compareFull;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.background,
          borderColor: isDecided ? theme.tint : theme.border,
          borderWidth: isDecided ? 1.5 : Border.hairline,
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${candidate.vendorName} 자세히 보기`}
        onPress={() => router.push(`/search/${candidate.vendorId}`)}
        style={styles.cardBody}>
        <View style={styles.thumbCol}>
          <VendorImage
            source={candidate.imageUrl ? { uri: candidate.imageUrl } : undefined}
            category={vendorImageCategory(candidate.category)}
            width={Layout.thumbSearchWidth}
            height={Layout.thumbSearchHeight}
            radius={Radius.thumb}
          />
          {candidate.addedByPartner ? (
            <View style={[styles.badge, { backgroundColor: theme.text }]}>
              <ThemedText type="f10" style={[styles.bold, { color: theme.onInk }]}>
                {BADGE_SHARED}
              </ThemedText>
            </View>
          ) : null}
          {/* 결정 완료 상태 — 03-pick 정본: 코랄 테두리 + 썸네일 우상단 체크. */}
          {isDecided ? (
            <View style={[styles.decidedCheck, { backgroundColor: theme.tint }]}>
              <ProductSymbol name="check" size={Layout.iconSmall} color={theme.onTint} />
            </View>
          ) : null}
        </View>

        <View style={styles.info}>
          <View style={styles.headRow}>
            <View style={styles.headText}>
              {/* 규격서: 업종 «10/700 #868B94 · lh 15 · ls 0.5px» · 이름 «16/700 · lh 22 · mar 2 0 0 0». */}
              <ThemedText type="f10" themeColor="textAssistive" style={[styles.bold, styles.tracked]}>
                {VENDOR_CATEGORY_LABEL[candidate.category]}
              </ThemedText>
              <ThemedText type="f16" numberOfLines={1} style={[styles.bold, styles.name]}>
                {candidate.vendorName}
              </ThemedText>
            </View>
            {/* × — 후보에서 뺀다. 피그마 `text-muted-foreground/40 p-1`. 실제 빼기는 UnpickSheet가 묻는다. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${candidate.vendorName} 빼기`}
              hitSlop={Spacing.two}
              onPress={onRemove}
              style={styles.removeBtn}>
              <View style={styles.removeIcon}>
                <ProductSymbol name="close" size={Layout.iconField} color={theme.textAssistive} />
              </View>
            </Pressable>
          </View>
          <View style={styles.location}>
            <ProductSymbol name="pin" size={Layout.iconMicro} color={theme.textAssistive} />
            {/* 규격서: 지역 «12/400 #868B94 · lh 16 · mar 6 0 0 0». */}
            <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1}>
              {candidate.region}
            </ThemedText>
          </View>
          {/* 정본(대메뉴_Pick.dc.html) — 5점 별점(2026-09-23 복원). 확인된 후기가 모자라면 rating이 null이라 안 그린다. */}
          {candidate.rating ? (
            <RatingStars value={candidate.rating.average} count={candidate.rating.count} />
          ) : null}
          {candidate.note ? (
            /* 규격서 해시태그 줄 자리 «10/500 #868B94 · lh 15 · mar 8 0 0 0». */
            <ThemedText type="f10" themeColor="textAssistive" numberOfLines={1} style={[styles.medium, styles.note]}>
              {candidate.note}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>

      <View style={[styles.ctaStrip, { borderTopColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: comparing, disabled: compareDisabled }}
          accessibilityLabel={`${candidate.vendorName} ${comparing ? ACTION_COMPARING : ACTION_COMPARE}`}
          disabled={compareDisabled}
          onPress={onCompare}
          style={({ pressed }) => [
            styles.compareLink,
            compareDisabled ? styles.disabled : null,
            pressed ? styles.pressed : null,
          ]}>
          <ThemedText
            type="f12"
            style={[
              styles.bold,
              { color: comparing ? theme.tint : compareDisabled ? theme.textDisabled : theme.textAssistive },
            ]}>
            {comparing ? ACTION_COMPARING : ACTION_COMPARE}
          </ThemedText>
        </Pressable>

        {isDecided ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${candidate.vendorName} ${ACTION_UNDECIDE}`}
            disabled={busy}
            onPress={onUndecide}
            style={({ pressed }) => [
              styles.decisionCta,
              { backgroundColor: theme.tint, borderColor: theme.tint },
              pressed ? styles.pressed : null,
              busy ? styles.busy : null,
            ]}>
            <ThemedText type="f12" style={[styles.bold, { color: theme.onTint }]}>
              {ACTION_UNDECIDE}
            </ThemedText>
          </Pressable>
        ) : !groupDecided ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${candidate.vendorName} ${ACTION_DECIDE}`}
            onPress={onDecide}
            style={({ pressed }) => [
              styles.decisionCta,
              { backgroundColor: theme.background, borderColor: theme.border },
              pressed ? styles.pressed : null,
            ]}>
            <ThemedText type="f12" style={[styles.bold, { color: theme.text }]}>
              {ACTION_DECIDE}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Pick 루트의 비교함. 담긴 업체를 한곳에서 빼거나 2~3곳 비교로 이어간다. */
function CompareBasket({
  rows,
  onRemove,
  onCompare,
  onOpenPick,
}: {
  rows: readonly Row[];
  onRemove: (vendorId: string) => void;
  onCompare: () => void;
  onOpenPick: () => void;
}) {
  const theme = useTheme();
  const canCompare = rows.length >= MIN_COMPARE;

  return (
    <View>
      <View style={styles.rootTitleRow}>
        <ThemedText type="f26" style={[styles.bold, styles.rootTitle]}>
          비교함
        </ThemedText>
      </View>
      <View style={styles.compareBasketBody}>
        {rows.length === 0 ? (
          <View style={styles.compareEmpty}>
            <ThemedText type="f16" style={styles.bold}>비교할 업체를 담아주세요</ThemedText>
            <ThemedText type="f13" themeColor="textAssistive" style={styles.compareEmptyBody}>
              나의 Pick에서 2~3곳을 담으면 금액과 조건을 나란히 볼 수 있어요
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenPick}
              style={({ pressed }) => [
                styles.comparePrimary,
                { backgroundColor: theme.text },
                pressed ? styles.pressed : null,
              ]}>
              <ThemedText type="f14" style={[styles.bold, { color: theme.onInk }]}>나의 Pick 보기</ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            <ThemedText type="f13" themeColor="textAssistive">
              {compareBasketLabel(rows.length)} · 최대 {PICK_COMPARE_MAX}곳
            </ThemedText>
            <View style={styles.compareBasketList}>
              {rows.map(({ candidate }) => (
                <View
                  key={candidate.vendorId}
                  style={[styles.compareBasketRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${candidate.vendorName} 상세 보기`}
                    onPress={() => router.push(`/search/${candidate.vendorId}`)}
                    style={styles.compareBasketInfo}>
                    <ThemedText type="f11" themeColor="textAssistive" style={styles.bold}>
                      {VENDOR_CATEGORY_LABEL[candidate.category]}
                    </ThemedText>
                    <ThemedText type="f16" numberOfLines={1} style={styles.bold}>{candidate.vendorName}</ThemedText>
                    <ThemedText type="f12" numberOfLines={1} themeColor="textAssistive">{candidate.region}</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${candidate.vendorName} 비교에서 빼기`}
                    hitSlop={Spacing.two}
                    onPress={() => onRemove(candidate.vendorId)}
                    style={styles.compareBasketRemove}>
                    <ProductSymbol name="close" size={Layout.iconField} color={theme.textAssistive} />
                  </Pressable>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canCompare }}
              disabled={!canCompare}
              onPress={onCompare}
              style={({ pressed }) => [
                styles.comparePrimary,
                { backgroundColor: canCompare ? theme.tint : theme.backgroundElement },
                pressed && canCompare ? styles.pressed : null,
              ]}>
              <ThemedText
                type="f14"
                style={[styles.bold, { color: canCompare ? theme.onTint : theme.textDisabled }]}>
                {canCompare ? `${rows.length}곳 비교하기` : '한 곳 더 담아주세요'}
              </ThemedText>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────
   비어 있음 — 피그마 `py-20 gap-4`: 회색 원 64 + 하트 32 · 제목 · 부제 · 잉크 pill 단추
──────────────────────────────────────────── */
function Empty() {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyMark, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.emptyHeart}>
          <Svg width={Layout.iconEmpty} height={Layout.iconEmpty} viewBox="0 0 24 24" fill="none">
            <Path d={MARK_HEART_PATH} stroke={theme.textAssistive} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      </View>
      <View style={styles.emptyText}>
        <ThemedText type="t6" style={styles.bold}>
          {EMPTY_TITLE}
        </ThemedText>
        <ThemedText type="t7" themeColor="textAssistive" style={styles.emptyBody}>
          {EMPTY_BODY}
        </ThemedText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={EMPTY_CTA}
        onPress={() => router.push('/search')}
        style={({ pressed }) => [styles.emptyCta, { backgroundColor: theme.text }, pressed ? styles.pressed : null]}>
        <ThemedText type="t7" style={[styles.bold, { color: theme.onInk }]}>
          {EMPTY_CTA}
        </ThemedText>
      </Pressable>
    </View>
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

/* ────────────────────────────────────────────
   스타일 — 값은 피그마 `Pick.tsx`(2026-09-14 정본). 12 · 14 · 20 · 40처럼 사다리에 없는
   값은 같은 값의 기존 토큰을 주석과 함께 쓴다(저장소 관례).
──────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center' },
  wrapper: { flex: 1, width: '100%' },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1 },
  errorBox: { padding: Layout.gutter, gap: Layout.rowPaddingY },
  /* 바깥 `pb-8` = 32. */
  bottomSpacer: { height: Spacing.five },

  bold: { fontWeight: 700 },
  /* 규격서의 굵기 600 · 500 — spec/tokens.json typography.$weights의 피그마 예외. */
  semibold: { fontWeight: 600 },
  medium: { fontWeight: 500 },
  regular: { fontWeight: 400 },
  /* 규격서 «ls 0.5px» — 업종 라벨. */
  tracked: { letterSpacing: LetterSpacing.p05 },
  /* Root 제목행은 홈·MY와 같은 26/700 · 56 · 좌우 24. */
  title: { letterSpacing: LetterSpacing.n065 },
  pressed: { transform: [{ scale: 0.97 }] },
  busy: { opacity: 0.6 },
  /* 비교함이 찼을 때의 «비교하기» `opacity-40`. */
  disabled: { opacity: 0.4 },

  head: { paddingBottom: Layout.listGap },
  /* Root 제목행: Back 없음 · 56 · 좌우 24. */
  titleRow: {
    height: Layout.navBar,
    paddingHorizontal: Layout.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.iconTextGap,
  },
  headBody: {
    paddingHorizontal: Layout.gutter,
  },
  /* 03-pick shareBar: mt 16 · radius 10 · 안쪽 16/12. */
  partnerBox: {
    marginTop: Spacing.three,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Layout.inlineGap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  /* 아바타 묶음 ↔ 글 `gap-2.5` = 10(같은 값의 iconTextGap). */
  partnerLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.iconTextGap,
  },
  partnerText: { flexShrink: 1 },
  avatars: { flexDirection: 'row' },
  /* `h-8 w-8 ring-2` — 32 원 · 테두리 2(같은 값의 Border.focus). */
  avatar: {
    width: Layout.avatarRow,
    height: Layout.avatarRow,
    borderRadius: Radius.pill,
    borderWidth: Border.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* `-space-x-2` — 둘째가 8 겹친다. */
  avatarOverlap: { marginLeft: -Spacing.two },
  /* «Pick 인증» `flex items-center gap-1`. */
  priceReportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: Layout.touchTarget,
    justifyContent: 'center',
  },

  // ── 03-pick 비교 배너: mx 24 · mb 16 · radius 10 · px 16 · py 14 ──
  compareBanner: {
    marginHorizontal: Layout.gutter,
    borderWidth: Border.hairline,
    marginBottom: Spacing.three,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    /* 상하 14 — 같은 값의 fieldPaddingX. */
    paddingVertical: Layout.fieldPaddingX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  compareText: { flex: 1, minWidth: 0 },
  /* 부제 `mt-0.5 text-white/50`. */
  compareHint: { marginTop: Spacing.half, opacity: 0.5 },
  /* 03-pick bannerBtn: height 36 · radius 6 · px 16. */
  compareBtn: {
    height: Layout.chip,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
  },

  rootTitleRow: {
    height: Layout.navBar,
    paddingHorizontal: Layout.gutter,
    justifyContent: 'center',
  },
  rootTitle: { letterSpacing: LetterSpacing.n065 },
  compareBasketBody: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.listGap,
    gap: Spacing.three,
  },
  compareBasketList: { gap: Spacing.two },
  compareBasketRow: {
    minHeight: 84,
    borderWidth: Border.hairline,
    borderRadius: Radius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  compareBasketInfo: { flex: 1, minWidth: 0, gap: Spacing.half },
  compareBasketRemove: {
    width: Layout.touchTarget,
    height: Layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  compareEmpty: {
    alignItems: 'center',
    paddingVertical: Layout.pickEmptyPaddingY,
  },
  compareEmptyBody: {
    marginTop: Spacing.one,
    marginBottom: Spacing.four,
    textAlign: 'center',
  },
  comparePrimary: {
    minHeight: Layout.ctaPick,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 업종 칩 `gap-2 px-5 pb-4` ──
  /* 세로 스크롤 안의 가로 스크롤 — 늘어나지 않게 잡는다. 안 잡으면 칩 줄이 남는 높이를 다 먹는다. */
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Layout.pageX,
    paddingBottom: Spacing.three,
  },
  /* `px-4 py-2.5 text-sm` — 40(같은 값의 controlMedium) · 좌우 16. */
  chip: {
    height: Layout.controlMedium,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 카드 목록 `space-y-3 px-5` — 카드 사이 12 ──
  /* 규격서 「div 430×884 pad 0 20 0 20」. */
  list: {
    paddingHorizontal: Layout.pageX,
    gap: Layout.inlineGap,
  },
  /* 03-pick card: radius 10 · hairline border · shadow 없음. */
  card: {
    borderRadius: Radius.medium,
    borderWidth: Border.hairline,
    overflow: 'hidden',
  },
  cardBody: { flexDirection: 'row' },
  /* 왼쪽 열 `p-2` 안에 썸네일 104×116 — 열 폭 120. */
  thumbCol: { padding: Spacing.two, flexShrink: 0 },
  /* 배지 `absolute left-3.5 top-3.5 px-2 py-0.5` — 열 기준 14(같은 값의 chipPaddingX). */
  badge: {
    position: 'absolute',
    top: Layout.chipPaddingX,
    left: Layout.chipPaddingX,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  /* 03-pick 정본: 결정 완료는 썸네일 우상단 24px 코랄 체크. */
  decidedCheck: {
    position: 'absolute',
    top: Layout.inlineGap,
    right: Layout.inlineGap,
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 오른쪽 정보 `flex-1 p-3.5` — 안쪽 14(같은 값의 fieldPaddingX). */
  info: {
    flex: 1,
    minWidth: 0,
    padding: Layout.fieldPaddingX,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  headText: { flex: 1, minWidth: 0 },
  /* 규격서: 이름 «lh 22 · mar 2 0 0 0». */
  name: { marginTop: Spacing.half, lineHeight: LineHeight.lh22 },
  /* × `p-1 rounded-full`. */
  removeBtn: {
    padding: Spacing.one,
    borderRadius: Radius.pill,
    flexShrink: 0,
  },
  removeIcon: { opacity: 0.4 },
  /* 핀 + 지역 `mt-1.5 gap-1` — 위 6(같은 값의 menuGroupGap). */
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Layout.menuGroupGap,
  },
  /* 메모 — 피그마 해시태그 줄 자리 `mt-2`. */
  note: { marginTop: Spacing.two },

  /* 03-pick 정본: 비교는 텍스트 링크, 오른쪽 행동만 버튼. */
  ctaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderTopWidth: Border.hairline,
    paddingHorizontal: Layout.fieldPaddingX,
    paddingTop: Spacing.two,
    paddingBottom: Layout.iconTextGap,
  },
  compareLink: {
    minHeight: Layout.controlMedium,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionCta: {
    height: Layout.controlMedium,
    borderRadius: Radius.small,
    borderWidth: Border.hairline,
    paddingHorizontal: Layout.toastPaddingX,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 비어 있음 `py-20 gap-4` ──
  empty: {
    alignItems: 'center',
    paddingVertical: Layout.pickEmptyPaddingY,
    paddingHorizontal: Layout.gutter,
    gap: Spacing.three,
  },
  emptyMark: {
    width: Layout.emptyMark,
    height: Layout.emptyMark,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 하트 `text-muted-foreground/30`. */
  emptyHeart: { opacity: 0.3 },
  emptyText: { alignItems: 'center' },
  emptyBody: { marginTop: Spacing.one },
  /* `mt-1 rounded-full px-6 py-3`. */
  emptyCta: {
    marginTop: Spacing.one,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Layout.inlineGap,
  },
});
